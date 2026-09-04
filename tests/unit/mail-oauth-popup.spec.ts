/**
 * Le contrat entre la pop-up de consentement et la fenêtre d'origine (D1).
 *
 * ⛔ `window.addEventListener('message')` reçoit les messages de N'IMPORTE QUELLE
 * origine : sans les trois contrôles testés ici (origine, type, `state`
 * attendu), une page tierce ouverte par ailleurs pourrait faire échanger un code
 * qui n'est pas le nôtre.
 */
import { describe, it, expect } from 'vitest'
import { isOAuthReply, POPUP_FEATURES } from '@/lib/mail/oauthPopup'

describe('isOAuthReply', () => {
  const origin = 'https://app.megga.ch'
  it('accepte seulement notre origine, notre type et le state attendu', () => {
    const ok = { origin, data: { type: 'megga:mail-oauth', code: 'c', state: 's1' } }
    expect(isOAuthReply(ok, origin, 's1')).toBe(true)
    expect(isOAuthReply({ ...ok, origin: 'https://evil.example' }, origin, 's1')).toBe(false)
    expect(isOAuthReply({ origin, data: { type: 'other', code: 'c', state: 's1' } }, origin, 's1')).toBe(false)
    expect(isOAuthReply({ origin, data: { type: 'megga:mail-oauth', code: 'c', state: 'zz' } }, origin, 's1')).toBe(false)
    expect(isOAuthReply({ origin, data: 'string' }, origin, 's1')).toBe(false)
  })
  it('la pop-up a la taille de la maquette (520×680) et est une vraie pop-up', () => {
    expect(POPUP_FEATURES).toContain('width=520')
    expect(POPUP_FEATURES).toContain('height=680')
    expect(POPUP_FEATURES).toContain('popup')
  })
})
