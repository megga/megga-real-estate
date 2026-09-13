/**
 * Page publique d'acceptation d'invitation d'équipe — route `/accept-invite/:token`.
 * Aperçu puis réclamation via l'edge function `accept-team-invite` (actions preview / claim).
 * L'UI s'adapte à l'état de session : connecté + email concordant → bouton accepter,
 * mauvais compte → avertissement, non connecté → login/register avec redirect vers cette page.
 *
 * ⛔ QUITTER UNE AGENCE QUI PORTE DES DONNÉES SE CONFIRME (audit du 13.09.2026, point S9).
 * Accepter rattache le compte à l'agence qui invite et le fait sortir de la sienne. Si
 * celle-ci porte des données, elles restent en place mais la personne n'y a plus accès : la
 * page le dit et exige une case cochée avant d'envoyer `confirmLeave: true`. Deux sources,
 * parce que l'aperçu ne peut pas toujours savoir : `leavesAgencyWithData` de l'aperçu
 * (calculé pour l'invité connecté seulement), et le 409 `prior_agency_holds_data` de la
 * réclamation — auquel cas rien n'a bougé côté serveur, et l'avertissement remplace l'erreur.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { MLK } from '@/components/kyc-magic-link/mlkTokens'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'

/**
 * ⛔ LES DEUX ENCRES SÉMANTIQUES, ET POURQUOI ELLES NE SONT PAS DANS `MLK`.
 *
 * `MLK` descend de l'échelle et ne porte que des NEUTRES : une famille qui
 * ENCODE (erreur, avertissement) reste hors direction — mais hors direction ne
 * veut pas dire hors lisibilité. Sur une carte blanche, `#EF4444` rend 3,76:1
 * en encre et `#F59E0B` 2,15 : sous l'AA tous les deux. La règle du dépôt est
 * « la teinte VIVE sur l'aplat, la FONCÉE sur le texte ». Ces deux encres
 * étaient recopiées ici ; elles sont IMPORTÉES depuis le 13.09.2026 de
 * `STATUT_CLAIR`, la source que partagent désormais `DossierTokens.errDarker`,
 * `EtatVide` et les autres surfaces au même rôle.
 */
const ERR_INK = STATUT_CLAIR.errInk
const WARN_INK = STATUT_CLAIR.warnInk

interface InvitationDetails {
  email: string
  role: string
  agencyName: string
  inviterName: string
  expiresAt: string
  /**
   * L'agence actuelle de l'invité porte des données qu'accepter lui ferait quitter. Rendu
   * SEULEMENT à l'invité connecté dont l'e-mail concorde ; absent = inconnu ou sans objet.
   */
  leavesAgencyWithData?: boolean
}

/**
 * Code métier d'une réponse de `functions.invoke`, ou `null` si elle a réussi.
 *
 * ⛔ `functions.invoke` range toute réponse non-2xx dans `error` — une `FunctionsHttpError`
 * au message générique — et laisse `data` à `null` : le code (`prior_agency_holds_data`,
 * `email_mismatch`) ne vit que dans le CORPS, exposé sur `error.context`, la `Response`
 * brute. Sans cette lecture, le 409 se confondrait avec une panne.
 */
async function codeErreur(data: unknown, error: unknown): Promise<string | null> {
  const direct = (data as { error?: unknown } | null)?.error
  if (typeof direct === 'string' && direct) return direct
  if (!error) return null
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const code = ((await ctx.json()) as { error?: unknown } | null)?.error
      if (typeof code === 'string' && code) return code
    } catch {
      // Corps non-JSON (passerelle, page d'erreur) : le code générique ci-dessous suffit.
    }
  }
  return 'unknown'
}

/** Charge l'aperçu de l'invitation puis gère sa réclamation (claim) après contrôle d'email. */
export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('settings')
  const { user } = useAuth()

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  // L'agence quittée porte des données : la réclamation attend une confirmation explicite.
  const [mustConfirmLeave, setMustConfirmLeave] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  useEffect(() => {
    if (!token) return
    const load = async () => {
      setLoading(true)
      const { data, error: err } = await supabase.functions.invoke('accept-team-invite', {
        body: { token, action: 'preview' },
      })

      if (err || data?.error) {
        const errCode = data?.error || 'unknown'
        if (errCode === 'invitation_not_found') setError(t('team.acceptInvite.notFound'))
        else if (errCode === 'invitation_expired') setError(t('team.acceptInvite.expired'))
        else if (errCode === 'invitation_accepted') setError(t('team.acceptInvite.alreadyAccepted'))
        else if (errCode === 'invitation_cancelled') setError(t('team.acceptInvite.cancelled'))
        else setError(t('team.acceptInvite.error'))
      } else {
        setInvitation(data)
        setMustConfirmLeave(data?.leavesAgencyWithData === true)
      }
      setLoading(false)
    }
    load()
  }, [token, t])

  const handleClaim = async () => {
    if (!token) return
    setClaiming(true)

    const { data, error: err } = await supabase.functions.invoke('accept-team-invite', {
      // `confirmLeave` ne part que coché : c'est le consentement, pas un réglage par défaut.
      body: { token, action: 'claim', ...(confirmLeave ? { confirmLeave: true } : {}) },
    })

    const code = await codeErreur(data, err)
    if (code === 'prior_agency_holds_data') {
      // L'aperçu n'avait pas pu le dire (données créées depuis, vérification indisponible).
      // Le serveur n'a rien déplacé : on demande la confirmation au lieu d'afficher une erreur.
      setMustConfirmLeave(true)
      setClaiming(false)
    } else if (code) {
      if (code === 'email_mismatch') {
        setError(t('team.acceptInvite.emailMismatch', { email: invitation?.email }))
      } else {
        setError(t('team.acceptInvite.error'))
      }
      setClaiming(false)
    } else {
      navigate('/dashboard')
    }
  }

  const emailMatch = user?.email?.toLowerCase() === invitation?.email?.toLowerCase()
  const redirectUrl = `/accept-invite/${token}`

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: MLK.bgGradient, fontFamily: MLK.font, color: MLK.ink }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <span style={{ fontSize: 'var(--crm-text-5xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.6 }}>
            MEGGA
          </span>
          <p style={{ fontSize: 'var(--crm-text-sm)', color: MLK.muted, marginTop: 4 }}>Immobilier Suisse</p>
        </div>

        {/* ⚠ LA CARTE SÉPARE PAR L'OMBRE, PAS PAR UNE BORDURE — c'est ce que les
            deux pages publiques déjà portées font (`MLK.card` + `boxShadow`,
            `border: 0`). En clair, l'ombre est ce qui détache ; la bordure était
            l'idiome d'avant. */}
        <div className="rounded-xl p-8" style={{ background: MLK.card, boxShadow: MLK.shadow }}>
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: MLK.muted }} />
              <p style={{ fontSize: 'var(--crm-text-lg)', color: MLK.muted, marginTop: 12 }}>
                {t('team.acceptInvite.loading')}
              </p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-4">
              {/* ⛔ L'ENCRE D'ERREUR PREND LA VARIANTE FONCÉE. `#EF4444` rend 3,76:1
                  sur une carte blanche — sous l'AA. La règle du dépôt est « la
                  teinte vive sur l'aplat, la foncée sur le texte », et `#B91C1C`
                  est la valeur que trois surfaces portent déjà à ce rôle. */}
              <p style={{ fontSize: 'var(--crm-text-lg)', color: ERR_INK, marginBottom: 16 }}>{error}</p>
              <Link to="/" style={{ fontSize: 'var(--crm-text-lg)', color: MLK.muted }}>
                {t('team.acceptInvite.backHome')}
              </Link>
            </div>
          )}

          {/* Invitation details */}
          {!loading && !error && invitation && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, margin: 0 }}>
                  {t('team.acceptInvite.title')}
                </h2>
                <p style={{ fontSize: 'var(--crm-text-lg)', color: MLK.muted, marginTop: 8 }}>
                  <span style={{ fontWeight: 600, color: MLK.inkSoft }}>{invitation.inviterName}</span>
                  {' '}{t('team.acceptInvite.invitesYou')}{' '}
                  <span style={{ fontWeight: 600, color: MLK.inkSoft }}>{invitation.agencyName}</span>
                </p>
              </div>

              <div className="rounded-lg p-4 text-center" style={{ background: MLK.cardSubtle }}>
                <p style={{ fontSize: 'var(--crm-text-sm)', color: MLK.muted, marginBottom: 4 }}>
                  {t('team.acceptInvite.yourRole')}
                </p>
                <p style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: MLK.ink, margin: 0 }}>
                  {t(`team.roles.${invitation.role}`)}
                </p>
              </div>

              {/* Authenticated + email match, mais l'agence quittée porte des données :
                  même bloc d'alerte que les deux pages de visite (aplat ambre, filet en
                  ombre intérieure), et la case conditionne le bouton ci-dessous. */}
              {user && emailMatch && mustConfirmLeave && (
                <div
                  role="alert"
                  style={{
                    background: STATUT_CLAIR.warnFill,
                    boxShadow: `inset 0 0 0 1px ${STATUT_CLAIR.warnLine}`,
                    borderRadius: 'var(--crm-radius-lg)',
                    padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
                  }}
                >
                  <p style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: WARN_INK, margin: 0 }}>
                    {t('team.acceptInvite.leaveWarningTitle')}
                  </p>
                  <p style={{ fontSize: 'var(--crm-text-sm)', color: WARN_INK, margin: 'var(--crm-space-xs) 0 0' }}>
                    {t('team.acceptInvite.leaveWarningBody', { agency: invitation.agencyName })}
                  </p>
                  <label
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-sm)',
                      marginTop: 'var(--crm-space-lg)', cursor: 'pointer',
                      fontSize: 'var(--crm-text-sm)', color: MLK.inkSoft,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={confirmLeave}
                      onChange={(e) => setConfirmLeave(e.target.checked)}
                      style={{ accentColor: MLK.accent, flexShrink: 0, margin: 'var(--crm-space-2xs) 0 0' }}
                    />
                    <span>{t('team.acceptInvite.leaveConfirm')}</span>
                  </label>
                </div>
              )}

              {/* Authenticated + email match */}
              {user && emailMatch && (
                <button
                  onClick={handleClaim}
                  disabled={claiming || (mustConfirmLeave && !confirmLeave)}
                  className="w-full h-11 rounded-lg transition-colors disabled:opacity-50"
                  style={{
                    fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500,
                    // L'affordance PRIMAIRE porte l'accent, et c'est l'encre
                    // blanche qui porte le contraste (5,78:1).
                    background: MLK.accent, color: '#FFFFFF', border: 0, cursor: 'pointer',
                  }}
                >
                  {claiming ? t('team.acceptInvite.accepting') : t('team.acceptInvite.accept')}
                </button>
              )}

              {/* Authenticated but wrong email */}
              {user && !emailMatch && (
                <div className="text-center space-y-3">
                  {/* Même règle que l'erreur : `#F59E0B` rend 2,15:1 en encre. */}
                  <p style={{ fontSize: 'var(--crm-text-sm)', color: WARN_INK }}>
                    {t('team.acceptInvite.wrongAccount', { email: invitation.email })}
                  </p>
                </div>
              )}

              {/* Not authenticated */}
              {!user && (
                <div className="space-y-3">
                  <Link
                    to={`/login?redirect=${encodeURIComponent(redirectUrl)}&email=${encodeURIComponent(invitation.email)}`}
                    className="block w-full h-11 rounded-lg transition-colors text-center leading-[44px]"
                    style={{
                      fontSize: 'var(--crm-text-lg)', fontWeight: 500,
                      color: MLK.inkSoft, boxShadow: `inset 0 0 0 1px ${MLK.ghost}33`,
                    }}
                  >
                    {t('team.acceptInvite.login')}
                  </Link>
                  <Link
                    to={`/register?redirect=${encodeURIComponent(redirectUrl)}&email=${encodeURIComponent(invitation.email)}`}
                    className="block text-center transition-colors"
                    style={{ fontSize: 'var(--crm-text-lg)', color: MLK.muted }}
                  >
                    {t('team.acceptInvite.register')}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
