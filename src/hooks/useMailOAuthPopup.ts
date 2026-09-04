/**
 * La pop-up de consentement (D1, plan maître §4) : `start` → `window.open` →
 * `postMessage` → `exchange`.
 *
 * Pop-up bloquée ⇒ navigation pleine page ; la page de retour fait alors
 * l'échange elle-même. Dans les deux cas le navigateur ne voit ni le
 * `code_verifier` ni un jeton — ils vivent côté serveur.
 */
import { useCallback, useRef } from 'react'
import { useMailAccounts, type MailAccount } from '@/hooks/useMailAccounts'
import { isOAuthReply, openOAuthPopup } from '@/lib/mail/oauthPopup'

const TIMEOUT_MS = 5 * 60_000
export type OAuthOutcome = { ok: true; account: MailAccount } | { ok: false; error: string; detail?: string }

/** `connect(provider, opts)` mène toute la danse et rend un verdict, jamais une exception. */
export function useMailOAuthPopup() {
  const { startOAuth, exchange } = useMailAccounts()
  const active = useRef<Window | null>(null)

  const connect = useCallback(async (provider: 'gmail' | 'outlook', opts: { loginHint?: string; visibility: 'owner' | 'agency' }): Promise<OAuthOutcome> => {
    const start = await startOAuth(provider, opts)
    // ⚠ `provider_not_configured` (503) arrive ici pour Outlook tant que
    // MICROSOFT_CLIENT_ID/_SECRET manquent au projet : c'est un ÉTAT à montrer,
    // pas une panne à masquer.
    if (start.error || !start.data) return { ok: false, error: start.error ?? 'start_failed', detail: start.detail }
    const { url, state } = start.data
    const popup = openOAuthPopup(url)
    if (!popup) {
      // Bloquée : on quitte la page ; MailOAuthCallbackPage reprendra sans opener.
      window.location.assign(url)
      return { ok: false, error: 'popup_blocked' }
    }
    active.current = popup
    const origin = window.location.origin
    const reply = await new Promise<{ code?: string; error?: string } | 'closed' | 'timeout'>((resolve) => {
      const onMsg = (ev: MessageEvent) => { if (isOAuthReply(ev, origin, state)) { cleanup(); resolve({ code: ev.data.code, error: ev.data.error }) } }
      const poll = window.setInterval(() => { if (popup.closed) { cleanup(); resolve('closed') } }, 500)
      const timer = window.setTimeout(() => { cleanup(); resolve('timeout') }, TIMEOUT_MS)
      const cleanup = () => { window.removeEventListener('message', onMsg); window.clearInterval(poll); window.clearTimeout(timer) }
      window.addEventListener('message', onMsg)
    })
    active.current = null
    if (reply === 'closed') return { ok: false, error: 'cancelled' }
    if (reply === 'timeout') return { ok: false, error: 'timeout' }
    if (reply.error || !reply.code) return { ok: false, error: reply.error ?? 'denied' }
    const ex = await exchange(reply.code, state)
    if (ex.error || !ex.data) return { ok: false, error: ex.error ?? 'exchange_failed', detail: ex.detail }
    return { ok: true, account: ex.data.account }
  }, [exchange, startOAuth])

  const cancel = useCallback(() => { active.current?.close(); active.current = null }, [])
  return { connect, cancel }
}
