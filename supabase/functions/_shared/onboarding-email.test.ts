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
  calibrationLines,
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

describe('réponses de calibrage — ce qui rend l\'avis utile avant l\'appel', () => {
  const reponses = {
    portfolio: '6-20',
    business: 'both',
    team: '2-5',
    priority: 'mandates',
    cantons: 'Genève, Vaud',
    // L'identité voyage dans le MÊME objet (contrat de l'edge), et la ligne
    // « Contact » la rend déjà.
    first_name: 'Julien',
    last_name: 'Gauthier',
    email: 'julien@example.ch',
  }

  it('traduit les codes, dans l\'ordre des questions du wizard', () => {
    // Sans ce dictionnaire l'avis afficherait « portfolio : 6-20 » : la colonne ne
    // stocke que des codes, et une fonction Deno ne voit pas le bundle i18n.
    expect(calibrationLines(reponses).map((l) => `${l.label}: ${l.value}`)).toEqual([
      'Portefeuille: 6 à 20 biens',
      'Activité: Vente et location',
      'Équipe: 2 à 5 agents',
      'Priorité: Trouver des mandats',
      'Cantons: Genève, Vaud',
    ])
  })

  it('⛔ ne répète PAS l\'identité : elle est déjà dans la ligne Contact', () => {
    const labels = calibrationLines(reponses).map((l) => l.label)
    expect(labels).not.toContain('first_name')
    expect(labels).not.toContain('email')
  })

  it('une question inconnue sort avec son code brut plutôt que d\'être perdue', () => {
    // Ajouter une question au wizard sans toucher au dictionnaire dégrade
    // l'affichage ; ça ne doit pas escamoter la réponse.
    expect(calibrationLines({ nouvelle_question: 'sa réponse' }))
      .toEqual([{ label: 'nouvelle_question', value: 'sa réponse' }])
  })

  it('aucune réponse, aucune section : pas de titre au-dessus du vide', () => {
    expect(calibrationLines(null)).toEqual([])
    expect(calibrationLines({})).toEqual([])
    expect(buildHostEmail(base, 'booked').html).not.toContain('Ce qu’ils ont répondu')
  })

  it('l\'avis les rend quand l\'appel a lieu', () => {
    const { html } = buildHostEmail(base, 'booked', reponses)
    expect(html).toContain('Ce qu’ils ont répondu')
    expect(html).toContain('6 à 20 biens')
    expect(html).toContain('Trouver des mandats')
  })

  it('une annulation ne les rend pas : le seul fait utile est que le créneau est libre', () => {
    expect(buildHostEmail(base, 'cancelled', reponses).html).not.toContain('Ce qu’ils ont répondu')
  })

  it('⛔ une valeur qui NOMME un membre de Object.prototype ne fait pas lever', () => {
    // `options['constructor']` remonte la chaîne de prototypes et rend une FONCTION,
    // que `??` ne rattrape pas — escapeHtml levait alors sur `.replace`. Dans
    // onboarding-call-book, cette levée arrive APRÈS l'insertion de la réservation :
    // le rendez-vous existait, et personne n'en était prévenu.
    for (const charge of ['constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
      expect(() => buildHostEmail(base, 'booked', { portfolio: charge })).not.toThrow()
      expect(calibrationLines({ portfolio: charge })).toEqual([
        { label: 'Portefeuille', value: charge },
      ])
    }
  })

  it('⛔ une question inconnue nommée « toString » n’est pas jetée en silence', () => {
    // `'toString' in CALIBRAGE` vaut true par héritage : la réponse disparaissait,
    // c'est-à-dire exactement ce que la boucle promet d'éviter.
    expect(calibrationLines({ toString: 'ma reponse' }))
      .toEqual([{ label: 'toString', value: 'ma reponse' }])
  })

  it('⛔ la réponse libre est ÉCHAPPÉE — « cantons » est du texte saisi', () => {
    // Six gabarits interpolaient sans échapper avant la migration du 15.08 ; celui-ci
    // reçoit une chaîne que l'utilisateur compose entièrement.
    const { html } = buildHostEmail(base, 'booked', { cantons: '<img src=x onerror=alert(1)>' })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
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
