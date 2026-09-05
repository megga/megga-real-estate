/**
 * MEGGA CRM — retour d'autorisation de la Messagerie (`/oauth/mail/callback`).
 *
 * Le fournisseur y ramène la pop-up après le consentement (plan maître §4).
 * Deux chemins, et les DEUX doivent exister — une pop-up bloquée est un cas
 * courant, pas un accident :
 *  · **avec opener** — la page relaie `{code, state}` par `postMessage` et se
 *    ferme ; c'est la fenêtre d'origine, qui tient la session, qui échange ;
 *  · **sans opener** (pop-up bloquée : `useMailOAuthPopup` a alors navigué la
 *    page entière) — elle fait l'échange elle-même et rejoint la Messagerie sur
 *    la boîte fraîchement connectée.
 *
 * ⛔ LE `postMessage` EST ADRESSÉ, jamais `'*'`. Un `targetOrigin` large livre
 * le code d'autorisation à n'importe quelle page qui aurait ouvert celle-ci.
 * La réciproque — l'opener qui refuse un message d'une autre origine, d'un
 * autre type ou portant un autre `state` — vit dans `isOAuthReply`
 * (`lib/mail/oauthPopup.ts`), et les deux sont gardées par
 * `tests/unit/mail-oauth-popup.spec.ts`.
 *
 * ⛔ NI `code` NI `state` NE SONT JOURNALISÉS. Un code d'autorisation est un
 * porteur de jeton : une ligne de console le déposerait dans les journaux du
 * navigateur, et une extension le lirait. Le `code_verifier`, lui, n'atteint
 * jamais le navigateur — il reste dans `mail_oauth_states`.
 *
 * Sous `pages/agent` et non `pages/public` : `polices-domaines.spec.ts` réserve
 * Manrope aux surfaces CLIENT, et celle-ci est une surface d'agent.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { OAUTH_REPLY_TYPE, type OAuthReply } from '@/lib/mail/oauthPopup'

/** Le temps laissé au navigateur pour délivrer le message avant la fermeture. */
const DELAI_FERMETURE = 300

/** Ce que l'URL de retour porte, lu une seule fois. */
interface Retour { code: string | null; state: string; refus: string | null; relais: boolean }

function lireRetour(): Retour {
  const p = new URLSearchParams(window.location.search)
  return {
    code: p.get('code'),
    state: p.get('state') ?? '',
    refus: p.get('error'),
    relais: !!window.opener && window.opener !== window,
  }
}

export default function MailOAuthCallbackPage() {
  const { t } = useTranslation('messages')
  const navigate = useNavigate()
  const { exchange } = useMailAccounts()
  /**
   * ⚠ Le verdict initial se calcule AU PREMIER RENDU, pas dans l'effet. Un
   * `setMessage` synchrone dans un effet coûte un rendu de plus pour dire ce
   * qu'on savait déjà, et `react-hooks/set-state-in-effect` le signale à juste
   * titre : l'effet ne garde que ce qui est un VRAI effet (poster, échanger).
   */
  const [retour] = useState(lireRetour)
  const [message, setMessage] = useState(() =>
    retour.relais ? t('mail.callback.closing')
      : retour.code && retour.state ? t('mail.callback.working')
        : t('mail.callback.denied'))
  /**
   * ⚠ Le relais comme l'échange sont des gestes À UNE SEULE FOIS : un `state`
   * est consommé côté serveur, donc un second `exchange` échouerait et
   * afficherait une panne là où tout s'est bien passé. `t` change d'identité à
   * chaque bascule de langue et StrictMode rejoue les effets — d'où ce témoin.
   * (Il est lu DANS l'effet, jamais pendant le rendu : c'est la lecture au
   * rendu que `react-hooks/refs` proscrit.)
   */
  const lance = useRef(false)

  useEffect(() => {
    if (lance.current) return
    lance.current = true
    const { code, state, refus, relais } = retour

    if (relais) {
      const reponse: OAuthReply = { type: OAUTH_REPLY_TYPE, code: code ?? undefined, state, error: refus ?? undefined }
      ;(window.opener as Window).postMessage(reponse, window.location.origin)
      window.setTimeout(() => window.close(), DELAI_FERMETURE)
      return
    }

    if (!code || !state) return
    void exchange(code, state).then((r) => {
      if (r.error || !r.data) { setMessage(t('mail.callback.failed', { detail: r.detail ?? r.error ?? '' })); return }
      navigate(`/dashboard/messagerie?account=${r.data.account.id}`, { replace: true })
    })
  }, [exchange, navigate, retour, t])

  return (
    <div
      className="min-h-screen grid place-items-center bg-theme-page text-theme-primary"
      style={{ fontFamily: 'var(--crm-font)', fontSize: 'var(--crm-text-md)' }}
    >
      {message}
    </div>
  )
}
