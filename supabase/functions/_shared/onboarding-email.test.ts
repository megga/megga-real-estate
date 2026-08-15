// Gabarits d'e-mail de l'appel d'accueil — habillage MEGGA X (15.08.2026).
//
// Le module est PUR : ces tests rendent du HTML et l'inspectent, sans réseau. Ils ne
// vérifient pas que « c'est beau » (aucun test ne le peut) mais les invariants qu'un
// oeil ne tient pas de façon fiable sur trois gabarits et deux langues.
import { describe, it, expect } from 'vitest'
import {
  buildAttendeeEmail,
  buildHostEmail,
  buildReminderEmail,
  type OnboardingCallEmailData,
} from './onboarding-email'

const base: OnboardingCallEmailData = {
  callId: 'call-1',
  attendeeName: 'Julien',
  attendeeEmail: 'julien@example.ch',
  agencyName: 'Régie du Rhône',
  hostName: 'Julien Gauthier',
  startMs: Date.parse('2026-08-17T07:00:00.000Z'),
  durationMinutes: 30,
  timezone: 'Europe/Zurich',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
  manageUrl: 'https://app.megga.ch/rendez-vous/jeton',
  locale: 'fr',
}

/** Les trois gabarits, dans leurs deux langues quand ils en ont deux. */
const tous = () => [
  buildAttendeeEmail(base),
  buildAttendeeEmail({ ...base, locale: 'en' }),
  buildAttendeeEmail({ ...base, meetingUrl: null }),
  buildReminderEmail(base),
  buildReminderEmail({ ...base, locale: 'en' }),
  buildHostEmail(base, 'booked'),
  buildHostEmail(base, 'rescheduled'),
  buildHostEmail({ ...base, meetingUrl: null }, 'cancelled'),
]

describe('gabarits d\'e-mail — invariants de la coquille', () => {
  it('le logo est servi par app.megga.ch, JAMAIS par megga.ch', () => {
    // megga.ch est derrière un mot de passe : mesuré le 15.08.2026, l'image y rend
    // 401 en text/plain, donc cassée chez le destinataire. C'était l'adresse posée
    // depuis l'origine — cette assertion est ce qui empêche d'y revenir.
    for (const { html } of tous()) {
      expect(html).toContain('https://app.megga.ch/email/megga-logo-white.png')
      expect(html).not.toContain('https://megga.ch/email')
    }
  })

  it('aucun tiret cadratin ni demi-cadratin, objet compris (règle maison)', () => {
    for (const { subject, html } of tous()) {
      expect(subject).not.toMatch(/[–—]/)
      expect(html).not.toMatch(/[–—]/)
    }
  })

  it('chaque e-mail porte un texte d\'aperçu, et il ne recopie pas l\'objet', () => {
    for (const { subject, html } of tous()) {
      const apercu = /opacity:0;">\s*([^<]+?)\s*<\/div>/.exec(html)?.[1]
      expect(apercu, `aperçu manquant pour « ${subject} »`).toBeTruthy()
      expect(apercu).not.toBe(subject)
    }
  })

  it('le nom du destinataire est échappé (il vient d\'un champ libre)', () => {
    const { html } = buildAttendeeEmail({ ...base, attendeeName: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('confirmation — ce que le destinataire vient chercher', () => {
  it('l\'objet dit l\'ÉTAT avant la marque : il se lit tronqué sur mobile', () => {
    expect(buildAttendeeEmail(base).subject).toMatch(/^Appel d’accueil confirmé/)
    expect(buildAttendeeEmail({ ...base, locale: 'en' }).subject).toMatch(/^Welcome call confirmed/)
  })

  it('porte le lien de visioconférence en toutes lettres ET en bouton', () => {
    const { html } = buildAttendeeEmail(base)
    expect(html).toContain('https://meet.google.com/abc-defg-hij')
    expect(html).toContain('Rejoindre l’appel')
  })

  it('sans lien : aucun bouton mort, une phrase qui dit ce qui va se passer', () => {
    // `createHostEvent` rend null quand l'agenda de l'hôte est injoignable, et la
    // réservation aboutit quand même : l'e-mail doit rester vrai dans ce cas.
    const { html } = buildAttendeeEmail({ ...base, meetingUrl: null })
    expect(html).not.toContain('Rejoindre l’appel')
    expect(html).toContain('dans un second message')
  })

  it('le lien de replanification est là, avec sa promesse de ne pas se reconnecter', () => {
    const { html } = buildAttendeeEmail(base)
    expect(html).toContain(base.manageUrl)
    expect(html).toContain('sans avoir à vous reconnecter')
  })
})

describe('avis à l\'hôte — interne, donc dépouillé', () => {
  it('ni mention légale ni pilule de connexion : le destinataire est déjà dans l\'outil', () => {
    const { html } = buildHostEmail(base, 'booked')
    expect(html).not.toContain('communication marketing')
    expect(html).not.toContain('Ouvrir mon espace')
  })

  it('une annulation ne propose pas de rejoindre l\'appel', () => {
    const { html } = buildHostEmail(base, 'cancelled')
    expect(html).toContain('Créneau libéré')
    expect(html).not.toContain('Ouvrir la visioconférence')
  })

  it('l\'objet nomme l\'agence et le créneau, pour un tri à l\'oeil', () => {
    expect(buildHostEmail(base, 'booked').subject).toContain('Régie du Rhône')
  })
})

describe('rappel J-1', () => {
  it('annonce le lendemain et reprend le lien', () => {
    const { subject, html } = buildReminderEmail(base)
    expect(subject).toMatch(/^Rappel/)
    expect(html).toContain('C’est demain')
    expect(html).toContain('https://meet.google.com/abc-defg-hij')
  })

  it('porte la mention légale du client, pas celle d\'un avis de sécurité', () => {
    // Une fausse mention « notification de sécurité » userait celle qui compte
    // quand elle arrivera vraiment.
    const { html } = buildReminderEmail(base)
    expect(html).toContain('communication marketing')
    expect(html).not.toContain('notification de sécurité')
  })
})
