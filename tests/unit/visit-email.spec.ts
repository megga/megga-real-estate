// Courriels de visite de bien.
//
// Ce gabarit n'avait AUCUN test, et portait trois défauts réels corrigés le 15.08.2026 :
// une date et une heure fausses (lues en UTC), aucun échappement, et des objets au tiret
// cadratin. Les deux premiers sont invisibles à la relecture — d'où ces tests.
import { describe, it, expect } from 'vitest'
import {
  buildVisitEmail,
  formatVisitDate,
  formatVisitTime,
  type VisitEmailInput,
} from '../../supabase/functions/_shared/visit-email'

const base: VisitEmailInput = {
  kind: 'confirmation_buyer',
  // 12:00 UTC = 14:00 à Genève en été.
  scheduledAt: '2026-08-17T12:00:00.000Z',
  propertyTitle: '3.5 pièces, Carouge',
  propertyAddress: 'Rue Ancienne 12, 1227 Carouge',
  isVideo: false,
  videoLabel: 'Google Meet',
  videoLink: null,
  manageUrl: 'https://app.megga.ch/visite/jeton/modifier',
  buyerName: 'Marie Favre',
}

describe('⛔ le fuseau — le défaut que ce module existe pour corriger', () => {
  it('l’heure est SUISSE, pas celle du serveur', () => {
    // L'ancien gabarit lisait getHours() du runtime : en edge function c'est UTC, donc
    // une visite à 14:00 à Genève s'annonçait à 12:00.
    expect(formatVisitTime('2026-08-17T12:00:00.000Z')).toBe('14:00')
    // L'hiver, le décalage n'est que d'une heure : le figer serait un second bug.
    expect(formatVisitTime('2026-01-15T12:00:00.000Z')).toBe('13:00')
  })

  it('⛔ la DATE aussi : une visite en soirée changeait de JOUR', () => {
    // 22:30 UTC, c'est 00:30 le LENDEMAIN à Genève. L'ancien gabarit annonçait la veille,
    // ce qui est la pire erreur possible sur une convocation.
    expect(formatVisitDate('2026-08-16T22:30:00.000Z')).toContain('17')
    expect(formatVisitTime('2026-08-16T22:30:00.000Z')).toBe('00:30')
  })

  it('le rendu porte l’heure corrigée, pas seulement le formateur', () => {
    expect(buildVisitEmail(base).html).toContain('14:00')
  })
})

describe('buildVisitEmail — acheteur', () => {
  it('l’objet dit l’ÉTAT puis le bien, sans tiret cadratin', () => {
    expect(buildVisitEmail(base).subject).toBe('Visite confirmée · 3.5 pièces, Carouge')
    expect(buildVisitEmail({ ...base, kind: 'reminder' }).subject).toMatch(/^Visite demain ·/)
    for (const kind of ['confirmation_buyer', 'reminder'] as const) {
      expect(buildVisitEmail({ ...base, kind }).subject).not.toMatch(/[–—]/)
    }
  })

  it('porte le bien, la date et l’adresse', () => {
    const html = buildVisitEmail(base).html
    expect(html).toContain('3.5 pièces, Carouge')
    expect(html).toContain('Rue Ancienne 12, 1227 Carouge')
    expect(html).toContain('Déplacez ou annulez cette visite')
  })

  it('visite vidéo : le mode remplace l’adresse, et le bouton n’existe qu’avec un lien', () => {
    const avecLien = buildVisitEmail({ ...base, isVideo: true, videoLink: 'https://meet.google.com/x' }).html
    expect(avecLien).toContain('Rejoindre la visite vidéo')
    expect(avecLien).not.toContain('Rue Ancienne')

    const sansLien = buildVisitEmail({ ...base, isVideo: true, videoLink: null }).html
    expect(sansLien).not.toContain('Rejoindre la visite vidéo')
    expect(sansLien).toContain('lien à venir')
  })

  it('le rappel annonce demain et ne promet pas un second rappel', () => {
    const html = buildVisitEmail({ ...base, kind: 'reminder' }).html
    expect(html).toContain('Demain à 14:00')
    expect(html).not.toContain('Vous recevrez un rappel la veille')
  })

  it('⛔ AUCUNE pilule « Ouvrir mon espace » : l’acheteur n’a pas de compte MEGGA', () => {
    for (const kind of ['confirmation_buyer', 'reminder'] as const) {
      expect(buildVisitEmail({ ...base, kind }).html).not.toContain('Ouvrir mon espace')
    }
  })
})

describe('buildVisitEmail — agent', () => {
  const agent: VisitEmailInput = {
    ...base,
    kind: 'notification_agent',
    agentName: 'Gregory Lyonnet',
    buyerEmail: 'marie@example.ch',
    buyerPhone: '+41 79 123 45 67',
    buyerMessage: 'Plutôt en fin de journée si possible.',
    qualification: 'Budget : 1.2M',
  }

  it('porte le contact, la qualification et le message du visiteur', () => {
    const html = buildVisitEmail(agent).html
    expect(html).toContain('marie@example.ch')
    expect(html).toContain('+41 79 123 45 67')
    expect(html).toContain('Budget : 1.2M')
    expect(html).toContain('Plutôt en fin de journée')
  })

  it('a la pilule (il a un compte) et AUCUNE mention légale (c’est son activité)', () => {
    const html = buildVisitEmail(agent).html
    expect(html).toContain('Ouvrir mon espace')
    expect(html).not.toContain('communication marketing')
  })

  it('sans message ni qualification, aucun bloc vide', () => {
    const html = buildVisitEmail({ ...agent, buyerMessage: null, qualification: null }).html
    expect(html).not.toContain('Message du visiteur')
    expect(html).not.toContain('Qualification')
  })
})

describe('⛔ échappement — rien n’était échappé avant', () => {
  it('le message du visiteur, saisi sur le SITE PUBLIC, est neutralisé', () => {
    // C'est le champ le plus exposé de tous les e-mails du dépôt : un formulaire ouvert
    // à tout internaute, dont le contenu part dans la boîte de l'agent.
    const html = buildVisitEmail({
      ...base, kind: 'notification_agent', buyerMessage: '<img src=x onerror=alert(1)>',
    }).html
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('le titre du bien, le nom et le téléphone le sont aussi', () => {
    const html = buildVisitEmail({
      ...base,
      kind: 'notification_agent',
      propertyTitle: '<script>alert(1)</script>',
      buyerName: '<b>Marie</b>',
      buyerPhone: '<i>079</i>',
    }).html
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<b>Marie</b>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('⛔ la langue — et le fuseau qui ne doit PAS la suivre', () => {
  const LANGUES = ['fr', 'de', 'en', 'it'] as const

  it('le fuseau reste Europe/Zurich dans les QUATRE langues', () => {
    // La régression qui guette ce lot : dériver le fuseau de la langue (« de ⇒
    // Europe/Berlin »). Un germanophone à Zurich est à Europe/Zurich, et Berlin ne
    // coïncide aujourd'hui que par accident. Le cas de bascule de jour le prouve seul :
    // 22:30 UTC est le LENDEMAIN 00:30 à Genève.
    for (const locale of LANGUES) {
      expect(formatVisitTime('2026-08-17T12:00:00.000Z', locale), locale).toBe('14:00')
      expect(formatVisitTime('2026-01-15T12:00:00.000Z', locale), locale).toBe('13:00')
      expect(formatVisitTime('2026-08-16T22:30:00.000Z', locale), locale).toBe('00:30')
      expect(formatVisitDate('2026-08-16T22:30:00.000Z', locale), locale).toContain('17')
    }
  })

  it('la date est écrite dans la langue, pas seulement traduite autour', () => {
    expect(formatVisitDate('2026-08-17T12:00:00.000Z', 'de')).toContain('August')
    expect(formatVisitDate('2026-08-17T12:00:00.000Z', 'it')).toContain('agosto')
    expect(formatVisitDate('2026-08-17T12:00:00.000Z', 'en')).toContain('August')
    expect(formatVisitDate('2026-08-17T12:00:00.000Z', 'fr')).toContain('août')
  })

  it('⛔ la PRÉPOSITION qui colle la date à l’heure suit la langue', () => {
    // Le défaut jumeau, trouvé dans `booking-email` en portant celui-ci : `INTL_TAG`
    // traduisait les deux moitiés, mais le « à » qui les recolle restait français —
    // « Montag, 17. August 2026 à 14:00 ». Aucun test ne le voyait.
    const rendu = (locale: (typeof LANGUES)[number]) =>
      buildVisitEmail({ ...base, locale }).html.replace(/<[^>]+>/g, ' ')
    expect(rendu('de')).toMatch(/2026\s+um\s+14:00/)
    expect(rendu('en')).toMatch(/2026\s+at\s+14:00/)
    expect(rendu('it')).toMatch(/2026\s+alle\s+14:00/)
    expect(rendu('fr')).toMatch(/2026\s+à\s+14:00/)
  })

  it('l’allemand de SUISSE : aucun eszett dans aucune des trois natures', () => {
    for (const kind of ['confirmation_buyer', 'reminder', 'notification_agent'] as const) {
      const { subject, html } = buildVisitEmail({ ...base, kind, locale: 'de' })
      expect(`${subject} ${html}`, kind).not.toMatch(/ß/)
    }
  })

  it('les deux POPULATIONS restent distinctes : la notification agent se traduit aussi', () => {
    // `notification_agent` lit `profiles.language`, les deux autres `contacts.language`.
    // Les confondre écrirait au client dans la langue de son courtier — mais oublier la
    // notification laisserait l'agent germanophone en français.
    const de = buildVisitEmail({ ...base, kind: 'notification_agent', locale: 'de' })
    expect(de.subject).toContain('Besichtigungsanfrage')
    expect(de.html).toContain('lang="de"')
  })
})
