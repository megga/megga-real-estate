/**
 * Le contrat entre la pop-up de consentement et la fenêtre d'origine (D1).
 *
 * ⛔ `window.addEventListener('message')` reçoit les messages de N'IMPORTE QUELLE
 * origine : sans les trois contrôles éprouvés ici (origine, type, `state`
 * attendu), une page tierce ouverte par ailleurs pourrait faire échanger un code
 * qui n'est pas le nôtre — une injection de code d'autorisation.
 *
 * ⚠ TROIS CLAUSES SÉPARÉES, ET C'EST LE POINT. Groupées en une, une seule
 * assertion rouge ne dit pas LEQUEL des trois verrous a sauté ; or c'est
 * précisément ce qu'il faut savoir. Chacune vérifie AUSSI que le message par
 * ailleurs valide passe : un contrôle qui refuse tout serait vert pour la
 * mauvaise raison.
 *
 * La réciproque — la pop-up qui ADRESSE son `postMessage` au lieu de le crier à
 * `'*'` — se lit dans la page de retour, et les deux dernières clauses la
 * mesurent sur la source.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isOAuthReply, POPUP_FEATURES, OAUTH_REPLY_TYPE } from '@/lib/mail/oauthPopup'

const ORIGINE = 'https://app.megga.ch'
const STATE = 'a1b2c3'
const VALIDE = { origin: ORIGINE, data: { type: OAUTH_REPLY_TYPE, code: 'code-du-fournisseur', state: STATE } }

function lire(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), 'utf8')
}

describe('isOAuthReply — les trois verrous de la réponse de pop-up', () => {
  it('accepte le message de notre origine, de notre type, portant le state attendu', () => {
    expect(isOAuthReply(VALIDE, ORIGINE, STATE)).toBe(true)
  })

  it('REFUSE une autre origine', () => {
    expect(isOAuthReply({ ...VALIDE, origin: 'https://evil.example' }, ORIGINE, STATE)).toBe(false)
    // Un sous-domaine n'est pas la même origine, et un préfixe non plus.
    expect(isOAuthReply({ ...VALIDE, origin: 'https://app.megga.ch.evil.example' }, ORIGINE, STATE)).toBe(false)
    expect(isOAuthReply({ ...VALIDE, origin: 'http://app.megga.ch' }, ORIGINE, STATE)).toBe(false)
  })

  it('REFUSE un autre type de message', () => {
    expect(isOAuthReply({ origin: ORIGINE, data: { type: 'megga:autre-chose', code: 'c', state: STATE } }, ORIGINE, STATE)).toBe(false)
    // Ce qui n'est pas un objet n'a pas de type : une chaîne, un nombre, rien.
    expect(isOAuthReply({ origin: ORIGINE, data: 'megga:mail-oauth' }, ORIGINE, STATE)).toBe(false)
    expect(isOAuthReply({ origin: ORIGINE, data: null }, ORIGINE, STATE)).toBe(false)
    expect(isOAuthReply({ origin: ORIGINE, data: { code: 'c', state: STATE } }, ORIGINE, STATE)).toBe(false)
  })

  it('REFUSE un state qui n’est pas celui rendu par `start`', () => {
    expect(isOAuthReply({ ...VALIDE, data: { ...VALIDE.data, state: 'z9z9z9' } }, ORIGINE, STATE)).toBe(false)
    expect(isOAuthReply({ ...VALIDE, data: { ...VALIDE.data, state: '' } }, ORIGINE, STATE)).toBe(false)
    expect(isOAuthReply({ origin: ORIGINE, data: { type: OAUTH_REPLY_TYPE, code: 'c' } }, ORIGINE, STATE)).toBe(false)
  })

  it('la pop-up a la taille de la maquette (520×680) et est une vraie pop-up', () => {
    expect(POPUP_FEATURES).toContain('width=520')
    expect(POPUP_FEATURES).toContain('height=680')
    expect(POPUP_FEATURES).toContain('popup')
  })
})

describe('Page de retour — ce qu’elle envoie, et ce qu’elle ne dit à personne', () => {
  const PAGE = 'src/pages/agent/MailOAuthCallbackPage.tsx'

  /**
   * ⛔ Un `targetOrigin` à `'*'` livrerait le code d'autorisation à n'importe
   * quelle page ayant ouvert celle-ci. C'est la moitié « émission » du contrat ;
   * `isOAuthReply` en est la moitié « réception ».
   */
  it('adresse son postMessage à sa propre origine, jamais à « * »', () => {
    const code = lire(PAGE)
    expect(code).toMatch(/postMessage\([^)]*window\.location\.origin\s*\)/)
    expect(code).not.toMatch(/postMessage\([^)]*['"]\*['"]/)
  })

  /**
   * Un code d'autorisation est un porteur de jeton. Une ligne de console le
   * déposerait dans les journaux du navigateur, où une extension le lit.
   */
  it('ne journalise ni le code ni le state, sur aucun des trois fichiers du flux', () => {
    const fautifs: string[] = []
    for (const chemin of [PAGE, 'src/hooks/useMailOAuthPopup.ts', 'src/components/crm/messagerie/MailAddAccountModal.tsx']) {
      lire(chemin)
        .replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))
        .replace(/\/\/[^\n]*/g, ' ')
        .split('\n')
        .forEach((ligne, i) => {
          if (/console\.\w+\(/.test(ligne)) fautifs.push(`${chemin}:${i + 1}`)
        })
    }
    expect(fautifs, `journal sur le chemin du code d’autorisation :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })
})
