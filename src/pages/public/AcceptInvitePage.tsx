/**
 * Page publique d'acceptation d'invitation d'équipe — route `/accept-invite/:token`.
 * Aperçu puis réclamation via l'edge function `accept-team-invite` (actions preview / claim).
 * L'UI s'adapte à l'état de session : connecté + email concordant → bouton accepter,
 * mauvais compte → avertissement, non connecté → login/register avec redirect vers cette page.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
// ⛔ LES DEUX ENCRES SÉMANTIQUES VIENNENT DE `MLK_STATUT`, ELLES NE SE RÉÉCRIVENT PAS ICI.
// Cette page portait `ERR_INK`/`WARN_INK` en constantes locales, avec un commentaire dont
// le RAISONNEMENT était juste — une famille qui ENCODE reste hors direction, et hors
// direction ne veut pas dire hors lisibilité — mais dont la CONCLUSION dupliquait une
// famille qui existe déjà. Mesuré le 16 août 2026 : les deux valeurs étaient au caractère
// près celles de `MLK_STATUT.errInk` et `.warnInk`. Une encre d'alerte qui diffère d'un
// écran à l'autre est exactement l'incohérence que ce chantier retire.
import { MLK, MLK_STATUT } from '@/components/kyc-magic-link/mlkTokens'
// ⛔ LES PRIMITIVES, PAS SEULEMENT LES JETONS. Cette page reprenait la marque à la main —
// le mot « MEGGA » en texte — et n'avait ni coquille ni pied.
import { MlkBackground, MlkShell, MlkWordmark, MlkFooter } from '@/components/kyc-magic-link/MlkPrimitives'

interface InvitationDetails {
  email: string
  role: string
  agencyName: string
  inviterName: string
  expiresAt: string
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
      }
      setLoading(false)
    }
    load()
  }, [token, t])

  const handleClaim = async () => {
    if (!token) return
    setClaiming(true)

    const { data, error: err } = await supabase.functions.invoke('accept-team-invite', {
      body: { token, action: 'claim' },
    })

    if (err || data?.error) {
      if (data?.error === 'email_mismatch') {
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
    // ⚠ `MlkShell` REMPLACE LA CARTE FAITE MAIN, et le commentaire qu'elle portait n'est
    // pas perdu : « la carte sépare par l'OMBRE, pas par une bordure » est désormais une
    // propriété de la coquille elle-même (`MLK.card` + `shadowLg`, aucune bordure).
    // 448 px = l'ancien `max-w-md`, 32 px = l'ancien `p-8` : la géométrie ne bouge pas.
    <MlkBackground>
      <MlkShell width={448} pad={32}>
        {/* En-tête : la VRAIE marque, pas le mot « MEGGA » composé à la main. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--crm-space-6xl)' }}>
          <MlkWordmark size={18} />
          <p style={{ fontSize: 'var(--crm-text-sm)', color: MLK.muted, marginTop: 'var(--crm-space-2xs)' }}>Immobilier Suisse</p>
        </div>

        <div>
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
              {/* ⛔ L'ENCRE D'ERREUR PREND LA VARIANTE FONCÉE : la vive rend 3,76:1 sur une
                  carte blanche, sous l'AA. « La teinte vive sur l'aplat, la foncée sur le
                  texte » — la valeur vit dans `MLK_STATUT`, pas ici. */}
              <p style={{ fontSize: 'var(--crm-text-lg)', color: MLK_STATUT.errInk, marginBottom: 16 }}>{error}</p>
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

              {/* Authenticated + email match */}
              {user && emailMatch && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
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
                  {/* Même règle que l'erreur : l'ambre vif rend 2,15:1 en encre. */}
                  <p style={{ fontSize: 'var(--crm-text-sm)', color: MLK_STATUT.warnInk }}>
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
                      // ⚠ `MLK.line` REMPLACE `${MLK.ghost}33` : un jeton neutre suivi
                      // d'un suffixe d'opacité écrit à la main est la porte par laquelle
                      // une teinte entre sans qu'on la relise. Le filet est un RÔLE, et il
                      // a un nom depuis la fusion du 16 août.
                      fontSize: 'var(--crm-text-lg)', fontWeight: 500,
                      color: MLK.inkSoft, boxShadow: `inset 0 0 0 1px ${MLK.line}`,
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
        <MlkFooter />
      </MlkShell>
    </MlkBackground>
  )
}
