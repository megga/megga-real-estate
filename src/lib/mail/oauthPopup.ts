/**
 * Contrat entre la pop-up de consentement et la fenêtre d'origine (plan maître §4).
 *
 * La pop-up ne fait que relayer `{code, state}` ; c'est l'opener, qui a la
 * session, qui appelle `mail-oauth exchange`. Le navigateur ne voit donc jamais
 * ni le `code_verifier` ni un jeton.
 */
export const OAUTH_REPLY_TYPE = 'megga:mail-oauth'
export const POPUP_NAME = 'megga-mail-oauth'
export const POPUP_FEATURES = 'popup,width=520,height=680,resizable=yes,scrollbars=yes'

export interface OAuthReply { type: typeof OAUTH_REPLY_TYPE; code?: string; state: string; error?: string }

/** Vrai seulement pour un message de NOTRE origine, de NOTRE type, portant le state attendu. */
export function isOAuthReply(ev: { origin: string; data: unknown }, expectedOrigin: string, expectedState: string): ev is { origin: string; data: OAuthReply } {
  if (ev.origin !== expectedOrigin) return false
  const d = ev.data as Partial<OAuthReply> | null
  return !!d && typeof d === 'object' && d.type === OAUTH_REPLY_TYPE && d.state === expectedState
}

/** Ouvre la pop-up ; null si le navigateur l'a bloquée (repli : navigation pleine page). */
export function openOAuthPopup(url: string): Window | null {
  const w = window.open(url, POPUP_NAME, POPUP_FEATURES)
  return w && !w.closed ? w : null
}
