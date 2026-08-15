import { describe, it, expect } from 'vitest'
import { extractOptinToken, OPTIN_PREFIX, OPTIN_BODY_PLACEHOLDER } from './whatsapp-optin'
import { optinCopy, optinLang } from './whatsapp-optin-copy'

const JETON = 'eyJpZCI6ImEifQ.c2lnbmF0dXJl'

describe('extractOptinToken', () => {
  it('reconnaît le message pré-rempli par le lien wa.me', () => {
    expect(extractOptinToken(`${OPTIN_PREFIX} ${JETON}`)).toBe(JETON)
    // WhatsApp laisse la personne modifier le texte avant d'envoyer : espaces et casse
    // ne doivent pas faire échouer un consentement réellement donné.
    expect(extractOptinToken(`  megga-oui   ${JETON}  `)).toBe(JETON)
    expect(extractOptinToken(`${OPTIN_PREFIX} ${JETON} merci`)).toBe(JETON)
  })

  it('ignore tout ce qui n’est pas ce message', () => {
    for (const s of [
      null, undefined, '', '   ',
      'bonjour, je suis intéressé par l’appartement',
      JETON,                                  // le jeton NU ne suffit pas : pas de préfixe
      `${OPTIN_PREFIX}`,                      // préfixe sans jeton
      `${OPTIN_PREFIX} pas-un-jeton`,         // pas la forme <b64>.<b64>
      `oui ${OPTIN_PREFIX} ${JETON}`,         // le préfixe doit COMMENCER le message
    ]) {
      expect(extractOptinToken(s), String(s)).toBeNull()
    }
  })

  it('le fil ne garde jamais le jeton lui-même', () => {
    // Un porteur d'autorisation n'a rien à faire dans un journal de conversation lisible
    // par toute l'agence — même si sa sécurité ne repose pas sur son secret.
    expect(OPTIN_BODY_PLACEHOLDER).not.toContain('.')
    expect(OPTIN_BODY_PLACEHOLDER.length).toBeLessThan(40)
  })
})

describe('optinCopy — l’information préalable (art. 6 al. 6 nLPD)', () => {
  const LANGS = ['fr', 'de', 'en', 'it'] as const

  it('les quatre langues nomment l’AGENCE, jamais MEGGA à sa place', () => {
    // C'est l'agence qui traitera : nommer l'outil rendrait l'information fausse, et une
    // information fausse ne fonde aucun consentement.
    for (const lang of LANGS) {
      const c = optinCopy(lang, 'Régie du Lac SA')
      expect(c.body, lang).toContain('Régie du Lac SA')
      expect(c.subject.length, lang).toBeGreaterThan(10)
      expect(c.cta.length, lang).toBeGreaterThan(5)
    }
  })

  it('chaque version porte les cinq informations, dont le droit de ne rien faire', () => {
    for (const lang of LANGS) {
      const b = optinCopy(lang, 'Régie du Lac SA').body
      expect(b, `${lang}/retrait`).toMatch(/STOP/)
      expect(b, `${lang}/droits`).toContain('privacy@megga.ch')
      expect(b, `${lang}/politique`).toContain('https://megga.ch/privacy')
      // ⛔ Un consentement n'est LIBRE que si le refuser ne coûte rien. Sans cette phrase,
      // l'invitation laisse croire qu'ignorer pénalise — et n'obtient plus un consentement.
      expect(b.length, `${lang}/longueur`).toBeGreaterThan(400)
    }
  })

  it('le texte archivé est celui qui est montré — même objet, pas deux versions', () => {
    // `shown_text` reçoit EXACTEMENT ce corps : si la fonction en produisait un autre pour
    // l'e-mail, la preuve porterait sur un texte que personne n'a lu.
    const a = optinCopy('fr', 'X SA').body
    const b = optinCopy('fr', 'X SA').body
    expect(a).toBe(b)
  })

  it('les quatre textes sont distincts (pas de repli silencieux sur le français)', () => {
    expect(new Set(LANGS.map((l) => optinCopy(l, 'X SA').body)).size).toBe(4)
  })
})

describe('optinLang', () => {
  it('suit la langue déclarée du contact, sinon le français', () => {
    expect(optinLang('de')).toBe('de')
    expect(optinLang('IT')).toBe('it')
    expect(optinLang('en')).toBe('en')
    expect(optinLang('es')).toBe('fr')   // hors domaine contacts.language
    expect(optinLang(null)).toBe('fr')
    expect(optinLang('')).toBe('fr')
  })
})
