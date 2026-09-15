/**
 * Les événements du Calendrier et leur pont avec la Messagerie (15.09.2026) — la partie
 * pure : ce qu'on écrit en base, ce qu'on relit d'une tâche, le brouillon d'un e-mail.
 */
import { describe, it, expect } from 'vitest'
import {
  brouillonDepuisMail, deposerBrouillonCalendrier, evenementDepuisBrouillon, lireBrouillonCalendrier,
  messageDeRelance, oublierBrouillonCalendrier, titreDeRelance, versLigneEvenement,
} from '@/lib/calendrierEvenements'
import { calTypesPermis, type CalEvent } from '@/components/crm/calendar/data'

const ev = (o: Partial<CalEvent> = {}): CalEvent => ({
  id: 'e1', type: 'notary', title: 'Signature', start: new Date('2026-09-18T12:00:00Z'), end: new Date('2026-09-18T13:30:00Z'), ...o,
})

describe('versLigneEvenement — ce que le calendrier écrit', () => {
  it('garde l’événement TEL QU’ON L’A SAISI : titre, début, fin, type, journée, récurrence, liens', () => {
    const l = versLigneEvenement(ev({ allDay: true, location: ' Étude ', notes: ' RDV ', recurrence: { freq: 'weekly' }, contactId: 'c1', bienId: 'p1', mailThreadId: 't1' }))
    expect(l).toEqual({
      type: 'notary', title: 'Signature', starts_at: '2026-09-18T12:00:00.000Z', ends_at: '2026-09-18T13:30:00.000Z',
      all_day: true, location: 'Étude', notes: 'RDV', color: null, recurrence: { freq: 'weekly' }, status: null,
      contact_id: 'c1', property_id: 'p1', mail_thread_id: 't1',
    })
  })
  it('respecte les bornes de la table : fin jamais avant le début, couleur réservée à « autre », 200 caractères', () => {
    expect(versLigneEvenement(ev({ end: new Date('2026-09-18T11:00:00Z') })).ends_at).toBe('2026-09-18T12:00:00.000Z')
    expect(versLigneEvenement(ev({ color: '#112233' })).color).toBeNull()
    expect(versLigneEvenement(ev({ type: 'autre', color: '#112233' })).color).toBe('#112233')
    expect(versLigneEvenement(ev({ type: 'autre', color: 'rouge' })).color).toBeNull()
    expect(versLigneEvenement(ev({ title: 'x'.repeat(250) })).title).toHaveLength(200)
  })
})

describe('titreDeRelance — le titre d’une tâche relu', () => {
  it('« [Titre] notes » rend le titre et les notes', () => {
    expect(titreDeRelance('[Appeler la banque] dossier Champel')).toEqual({ titre: 'Appeler la banque', reste: 'dossier Champel' })
    expect(titreDeRelance('[Appeler la banque]')).toEqual({ titre: 'Appeler la banque', reste: null })
  })
  it('un message du système, sans crochets, reste tel quel', () => {
    expect(titreDeRelance('Bonjour, pensez au dossier')).toEqual({ titre: null, reste: 'Bonjour, pensez au dossier' })
    expect(titreDeRelance(null)).toEqual({ titre: null, reste: null })
    expect(titreDeRelance('[]')).toEqual({ titre: null, reste: '[]' })
    expect(titreDeRelance('[sans fin\nsur deux lignes]')).toEqual({ titre: null, reste: '[sans fin\nsur deux lignes]' })
  })
  // ⛔ Le titre était écrit sans échappement et relu jusqu'au PREMIER « ] » (revue du 15.09.2026).
  it('un titre à crochets, à barre oblique inverse ou très long fait l’aller-retour', () => {
    for (const titre of ['Appeler [urgent] M. Dupont', 'Dossier A]', '[x', 'C:\\dossier\\', 'a\\]b', 'x'.repeat(200)]) {
      expect(titreDeRelance(messageDeRelance(titre, 'dossier Champel')), titre).toEqual({ titre, reste: 'dossier Champel' })
    }
    expect(titreDeRelance(messageDeRelance('x'.repeat(250), null)).titre).toBe('x'.repeat(200))
    expect(messageDeRelance('Deux\nlignes', null)).toBe('[Deux lignes]')
    expect(messageDeRelance('  ', 'notes seules')).toBe('notes seules')
    expect(messageDeRelance(null, null)).toBeNull()
  })
  it('un titre écrit AVANT l’échappement garde ses crochets appariés, et sa barre oblique', () => {
    expect(titreDeRelance('[Appeler [urgent] M. Dupont] dossier Champel')).toEqual({ titre: 'Appeler [urgent] M. Dupont', reste: 'dossier Champel' })
    expect(titreDeRelance('[C:\\dossier] notes')).toEqual({ titre: 'C:\\dossier', reste: 'notes' })
  })
})

// ⛔ La fiche changeait le type sans que la table suive : une tâche passée « Notaire »
// revenait « Tâche », un événement passé « Visite » ouvrait une fiche introuvable.
describe('calTypesPermis — un événement existant garde sa table', () => {
  it('à la création, tous les types : la table se choisit d’après le type', () => {
    expect(calTypesPermis('creation')).toEqual(['visite', 'mandate', 'notary', 'task', 'publish', 'kyc', 'autre'])
  })
  it('une visite reste une visite, une tâche une relance, un RDV KYC un RDV KYC', () => {
    expect(calTypesPermis('visit')).toEqual(['visite'])
    expect(calTypesPermis('reminder')).toEqual(['task'])
    expect(calTypesPermis('appointment')).toEqual(['kyc'])
  })
  it('un événement ne devient ni une visite ni une tâche', () => {
    expect(calTypesPermis('event')).toEqual(['mandate', 'notary', 'publish', 'kyc', 'autre'])
  })
})

describe('le pont Messagerie → Calendrier', () => {
  const base = { extrait: 'Bonjour,   je confirme\nla visite.', expediteur: 'Zoé <zoe@ex.ch>', date: '15.09.2026', contactId: 'c1', mailThreadId: 't1', enTete: (o: { expediteur: string; date: string }) => `E-mail de ${o.expediteur} du ${o.date}` }
  it('le brouillon d’un e-mail : l’objet sans ses « Re : », l’expéditeur, la date et l’extrait en notes', () => {
    for (const sujet of ['Re: Visite', 'RE : TR : Visite', 'Fwd: Visite', 'AW: Visite']) {
      expect(brouillonDepuisMail({ ...base, sujet }).titre, sujet).toBe('Visite')
    }
    const b = brouillonDepuisMail({ ...base, sujet: 'Visite' })
    expect(b.notes).toBe('E-mail de Zoé <zoe@ex.ch> du 15.09.2026\n« Bonjour, je confirme la visite. »')
    expect(b).toMatchObject({ contactId: 'c1', mailThreadId: 't1' })
  })
  it('à la prochaine heure pleine — et 09:00 hors des heures de bureau', () => {
    const b = brouillonDepuisMail({ ...base, sujet: 'Visite' })
    const a = (iso: string) => evenementDepuisBrouillon(b, new Date(iso))
    expect(a('2026-09-15T10:20:00').start.getHours()).toBe(11)
    expect(a('2026-09-15T02:10:00').start.getHours()).toBe(9)
    const soir = a('2026-09-15T19:40:00')
    expect([soir.start.getDate(), soir.start.getHours()]).toEqual([16, 9])
    expect(soir.end.getTime() - soir.start.getTime()).toBe(3_600_000)
    expect(a('2026-09-15T10:20:00')).toMatchObject({ type: 'autre', title: 'Visite', contactId: 'c1', mailThreadId: 't1' })
  })
  it('le brouillon se LIT sans se consommer (mode strict), puis s’oublie', () => {
    const b = brouillonDepuisMail({ ...base, sujet: 'Visite' })
    const jeton = deposerBrouillonCalendrier(b)
    expect(lireBrouillonCalendrier(jeton)).toBe(b)
    expect(lireBrouillonCalendrier(jeton)).toBe(b)
    oublierBrouillonCalendrier(jeton)
    expect(lireBrouillonCalendrier(jeton)).toBeNull()
  })
  // ⛔ `?nouveau=1`, retiré aussitôt, rendait l'adresse d'un onglet Calendrier déjà ouvert : la
  // barre l'activait, et la création s'ouvrait depuis un écran caché. Un jeton par demande.
  it('un jeton par demande : une autre adresse ne lit rien, et le suivant remplace le précédent', () => {
    const b1 = brouillonDepuisMail({ ...base, sujet: 'Visite' })
    const b2 = brouillonDepuisMail({ ...base, sujet: 'Signature' })
    const j1 = deposerBrouillonCalendrier(b1)
    expect(lireBrouillonCalendrier(null)).toBeNull()
    expect(lireBrouillonCalendrier('1')).toBeNull()
    const j2 = deposerBrouillonCalendrier(b2)
    expect(j2).not.toBe(j1)
    expect(lireBrouillonCalendrier(j1)).toBeNull()
    oublierBrouillonCalendrier(j1)
    expect(lireBrouillonCalendrier(j2), 'oublier un AUTRE jeton ne touche pas au brouillon en attente').toBe(b2)
  })
})
