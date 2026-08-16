// Convocation au rendez-vous de vérification KYC — le contenu, pas l'habillage.
//
// Ce gabarit n'avait AUCUN test avant sa migration (15.08.2026), alors qu'il est lu par
// les clients des agences et qu'une erreur y coûte une séance manquée. Les invariants
// ci-dessous sont ceux qu'un relecteur ne tient pas de tête sur trois modes × trois cas.
import { describe, it, expect } from 'vitest'
import { buildBookingEmail, type BookingEmailParams } from '../../supabase/functions/_shared/booking-email'

const base: BookingEmailParams = {
  kind: 'confirmed',
  to: 'client@example.ch',
  contactName: 'Marie Favre',
  // Lundi 1er septembre 2026, 10:00 à Genève.
  startIso: '2026-09-01T08:00:00.000Z',
  timeZone: 'Europe/Zurich',
  mode: 'video',
  videoLink: 'https://meet.google.com/abc-defg-hij',
  agencyName: 'Régie du Rhône',
  agentName: 'Gregory Lyonnet',
  manageUrl: 'https://app.megga.ch/visite/jeton/modifier',
}

describe('buildBookingEmail — ce que le client doit pouvoir faire', () => {
  it('l’objet s’ouvre sur L’AGENCE, jamais sur MEGGA', () => {
    // Le destinataire connaît son agence, pas l'outil qu'elle utilise : un objet au nom
    // d'un tiers inconnu se lit comme un message non sollicité.
    expect(buildBookingEmail(base).subject).toMatch(/^Régie du Rhône/)
  })

  it('sans nom d’agence, l’objet retombe sur MEGGA plutôt que sur un blanc', () => {
    expect(buildBookingEmail({ ...base, agencyName: null }).subject).toMatch(/^MEGGA/)
  })

  it('l’heure est celle de l’AGENT, pas celle du serveur', () => {
    // 08:00 UTC = 10:00 à Genève. Le piège que ce module existe pour éviter : une
    // convocation décalée d'une à deux heures selon la saison.
    expect(buildBookingEmail(base).html).toContain('10:00')
  })

  it('⛔ ne demande JAMAIS la pièce d’identité : la vérification est faite en amont', () => {
    // Décision produit du 15.08.2026. Le client dépose sa pièce par le lien magique avant
    // même de pouvoir réserver, et la vérification est déjà faite quand ce message part :
    // la redemander inquiéterait sans rien obtenir. Deux formulations sont passées par là
    // (« Merci de vous munir de… », puis « la séance ne peut pas se tenir sans elle »),
    // d'où ce garde-fou plutôt qu'une confiance dans la relecture.
    for (const kind of ['confirmed', 'rescheduled', 'cancelled'] as const) {
      const html = buildBookingEmail({ ...base, kind }).html
      expect(html).not.toContain('pièce d’identité')
      expect(html).not.toMatch(/munir|apporter|à portée de main/i)
    }
  })

  it('visioconférence avec lien -> bouton ; sans lien -> aucun bouton mort, mais un mot', () => {
    expect(buildBookingEmail(base).html).toContain('Rejoindre la visioconférence')
    const sansLien = buildBookingEmail({ ...base, videoLink: null }).html
    expect(sansLien).not.toContain('Rejoindre la visioconférence')
    expect(sansLien).toContain('lien à venir')
  })

  it('sur place -> l’adresse est un fait du tableau, pas une phrase perdue', () => {
    const html = buildBookingEmail({
      ...base, mode: 'sur_place', videoLink: null, location: 'Rue du Rhône 14, 1204 Genève',
    }).html
    expect(html).toContain('Rue du Rhône 14, 1204 Genève')
    expect(html).toContain('Où')
  })

  it('une ANNULATION ne porte ni consigne, ni bouton, ni lien de report', () => {
    // Elle dit seulement quoi faire ensuite : demander un nouveau créneau à son conseiller.
    const html = buildBookingEmail({ ...base, kind: 'cancelled' }).html
    expect(html).not.toContain('Rejoindre la visioconférence')
    expect(html).not.toContain('Un empêchement ?')
    expect(html).toContain('contactez Gregory Lyonnet chez Régie du Rhône')
  })

  it('⛔ AUCUNE pilule « Ouvrir mon espace » : le destinataire n’a pas de compte MEGGA', () => {
    // C'est le client d'une agence. L'envoyer vers une porte qui ne s'ouvre pas pour lui
    // serait la seule faute que cet e-mail ne peut pas se permettre.
    for (const kind of ['confirmed', 'rescheduled', 'cancelled'] as const) {
      expect(buildBookingEmail({ ...base, kind }).html).not.toContain('Ouvrir mon espace')
    }
  })

  it('le nom du contact est échappé — il vient de la saisie de l’agent', () => {
    const html = buildBookingEmail({ ...base, contactName: 'Marie <img src=x> Favre' }).html
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('sans nom de contact, la salutation reste correcte', () => {
    expect(buildBookingEmail({ ...base, contactName: null }).html).toContain('Bonjour,')
  })

  it('sans lien de gestion, aucun bloc « Un empêchement ? » vide', () => {
    expect(buildBookingEmail({ ...base, manageUrl: null }).html).not.toContain('Un empêchement ?')
  })

  it('porte l’habillage commun et jamais l’ancien wordmark', () => {
    const html = buildBookingEmail(base).html
    expect(html).toContain('app.megga.ch/email/megga-logo-white.png')
    expect(html).not.toContain('Immobilier Suisse')
  })
})

describe('⛔ la préposition entre la date et l’heure', () => {
  it('suit la langue, et ne reste pas française', () => {
    // Défaut trouvé le 16.08.2026 en portant `visit-email` : `INTL_TAG` traduisait bien
    // les deux moitiés de la date, mais le littéral ` à ` qui les recolle était figé —
    // l'allemand rendait « Montag, 1. September 2026 à 10:00 ». Le renommage
    // `formatFr` → `formatWhen` avait pourtant acté « elle ne rend plus du français seul ».
    // Aucun test ne pouvait le voir : le banc quatre langues vérifie le témoin de langue,
    // `lang="xx"` et l'absence de cadratin, jamais une préposition.
    const sansBalises = (locale: 'fr' | 'de' | 'en' | 'it') =>
      buildBookingEmail({ ...base, locale }).html.replace(/<[^>]+>/g, ' ')
    expect(sansBalises('fr')).toMatch(/2026\s+à\s+10:00/)
    expect(sansBalises('de')).toMatch(/2026\s+um\s+10:00/)
    expect(sansBalises('en')).toMatch(/2026\s+at\s+10:00/)
    expect(sansBalises('it')).toMatch(/2026\s+alle\s+10:00/)
    // Et surtout : plus aucune trace du « à » français dans les trois autres.
    for (const l of ['de', 'en', 'it'] as const) {
      expect(sansBalises(l), l).not.toMatch(/2026\s+à\s/)
    }
  })
})
