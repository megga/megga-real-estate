// Alerte de sécurité « nouvelle connexion » — le SEUL e-mail de sécurité du produit.
//
// Ce que ces tests défendent tient en trois points, et les trois viennent de défauts
// réels trouvés dans le gabarit d'origine le 15.08.2026 : un bouton qui menait à une page
// verrouillée, des champs non échappés, et un tutoiement isolé dans tout le produit.
import { describe, it, expect } from 'vitest'
import { buildDeviceAlertEmail } from '../../supabase/functions/_shared/device-alert-email'

const base = {
  name: 'Julien',
  browser: 'Chrome 131',
  os: 'macOS',
  city: 'Genève',
  country: 'Suisse',
  ip: '85.218.12.44',
  when: '15.08.2026 à 17:42',
}

describe('buildDeviceAlertEmail', () => {
  it('⛔ le bouton mène à app.megga.ch, JAMAIS à megga.ch', () => {
    // megga.ch est la vitrine, protégée par mot de passe : mesuré le 15.08.2026, elle
    // rend 401. Un e-mail de sécurité dont le bouton « Sécuriser mon compte » ouvre une
    // page verrouillée est pire qu'inutile — c'était pourtant l'adresse d'origine.
    const html = buildDeviceAlertEmail(base).html
    expect(html).toContain('https://app.megga.ch/security/sessions')
    expect(html).not.toContain('https://megga.ch/security')
  })

  it('⛔ garde la mention de SÉCURITÉ, jamais la mention transactionnelle', () => {
    // Elle dit pourquoi le message arrive même sans action du destinataire, et pourquoi
    // il arrive même désabonné. La remplacer par celle des autres e-mails serait faux.
    const html = buildDeviceAlertEmail(base).html
    expect(html).toContain('notification de sécurité')
    expect(html).toContain('même si vous vous êtes désabonné')
  })

  it('vouvoie, comme tout le reste du produit', () => {
    // Le gabarit d'origine tutoyait (« ton compte », « change ton mot de passe »), seul
    // de tout le produit.
    const html = buildDeviceAlertEmail(base).html
    expect(html).toContain('votre compte MEGGA')
    expect(html).not.toMatch(/\bton compte\b|\btu peux\b|\bchange ton\b/i)
  })

  it('porte les cinq faits de la connexion', () => {
    const html = buildDeviceAlertEmail(base).html
    for (const attendu of ['Chrome 131', 'macOS', 'Genève, Suisse', '85.218.12.44', '15.08.2026 à 17:42']) {
      expect(html).toContain(attendu)
    }
  })

  it('échappe ce qui vient de l’extérieur : nom de profil, ville, IP d’en-tête', () => {
    // Le navigateur et le système sont sûrs par construction (parseUA les compose à
    // partir de captures numériques) ; ceux-ci ne le sont pas.
    const html = buildDeviceAlertEmail({
      ...base, name: '<img src=x>', city: '<b>Genève</b>', ip: '"><script>alert(1)</script>',
    }).html
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;img')
  })

  it('localisation inconnue : une phrase, jamais une ligne vide', () => {
    const html = buildDeviceAlertEmail({ ...base, city: null, country: null }).html
    expect(html).toContain('Localisation inconnue')
  })

  it('sans nom, la salutation reste correcte ; sans IP, un tiret', () => {
    expect(buildDeviceAlertEmail({ ...base, name: null }).html).toContain('Bonjour,')
    expect(buildDeviceAlertEmail({ ...base, ip: null }).html).toContain('—')
  })

  it('l’aperçu porte l’ACTION, pas un résumé de l’objet', () => {
    const html = buildDeviceAlertEmail(base).html
    expect(html).toContain('Si ce n’était pas vous, changez votre mot de passe maintenant.')
  })
})
