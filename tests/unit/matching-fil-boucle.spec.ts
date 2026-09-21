/**
 * La boucle chez l'agent (lot B) — le modèle pur des onglets « En attente » et « À conclure », et le signal
 * « prix baissé ». Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4 et §5.
 */
import { describe, expect, it } from 'vitest'
import {
  cleAttente, construireAConclure, construireAttente, ongletValide, signalPrix, type RelanceProposition,
} from '@/components/matching-fil/filBoucle'
import type { FilBien, FilFiltres, FilMatch, SuiviMatch } from '@/components/matching-fil/filModele'

const MAINTENANT = Date.parse('2026-09-21T12:00:00.000Z')
const SANS_FILTRE: FilFiltres = { bienId: null, acheteurId: null, texte: '' }
const bien = (id: string, champs: Partial<FilBien> = {}): FilBien => ({
  id, titre: `Bien ${id}`, prix: 1_000_000, location: false, type: 'apartment', pieces: 4.5,
  surface: 110, ville: 'Genève', canton: 'GE', adresse: null, equipements: [], photo: null, ...champs,
})
const acheteur = (id: string, prenom = `Prénom${id}`): FilMatch['acheteur'] => ({
  id, prenom, nom: `Nom${id}`, telephone: null, email: null, kyc: 'none',
})
const suivi = (champs: Partial<SuiviMatch>): SuiviMatch => ({
  statut: 'sent', proposeLe: null, reponduLe: null, motif: null, note: null, prixPropose: null, apprisLe: null, ...champs,
})
const match = (id: string, a: FilMatch['acheteur'], s: Partial<SuiviMatch>, champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score: 90, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, bien: bien(`b-${id}`), acheteur: a,
  suivi: suivi(s), ...champs,
})
const relance = (id: string, contactId: string, matchIds: string[], echeance: string | null): RelanceProposition =>
  ({ id, contactId, matchIds, echeance })

describe('construireAttente — une ligne par acheteur (§5)', () => {
  const julie = acheteur('c9', 'Julie')
  const emma = acheteur('c7', 'Emma')
  const camille = acheteur('c1', 'Camille')

  it('groupe les biens proposés sans réponse, le plus récent d’abord ; les autres statuts n’y sont pas', () => {
    const lignes = construireAttente([
      match('m14', julie, { proposeLe: '2026-09-19T10:00:00.000Z' }),
      match('m15', julie, { proposeLe: '2026-09-20T10:00:00.000Z' }),
      match('m16', julie, { statut: 'rejected', motif: 'prix' }),
      match('m6', emma, { statut: 'interested' }),
    ], [], SANS_FILTRE, MAINTENANT)
    expect(lignes.map((l) => [l.acheteur.id, l.matchs.map((m) => m.id)])).toEqual([['c9', ['m15', 'm14']]])
  })

  it('les relances échues en tête, puis la plus proche ; sans relance, en dernier', () => {
    const lignes = construireAttente([match('m14', julie, {}), match('m18', emma, {}), match('m1', camille, {})], [
      relance('rb1', 'c9', ['m14', 'm15'], '2026-09-22T10:00:00.000Z'),
      relance('rb2', 'c7', ['m18'], '2026-09-19T10:00:00.000Z'),
    ], SANS_FILTRE, MAINTENANT)
    expect(lignes.map((l) => [l.acheteur.id, l.echeance, l.due])).toEqual([
      ['c7', '2026-09-19T10:00:00.000Z', true],
      ['c9', '2026-09-22T10:00:00.000Z', false],
      ['c1', null, false],
    ])
  })

  it('une relance ne compte que pour ses biens et son acheteur', () => {
    const [l] = construireAttente([match('m14', julie, {})], [
      relance('r-autre', 'c9', ['m99'], '2026-09-20T10:00:00.000Z'),
      relance('r-emma', 'c7', ['m14'], '2026-09-20T10:00:00.000Z'),
    ], SANS_FILTRE, MAINTENANT)
    expect(l!.echeance).toBeNull()
  })

  it('les filtres s’appliquent aux biens ; un acheteur sans bien retenu n’a pas de ligne', () => {
    const lignes = construireAttente([
      match('m14', julie, {}, { bien: bien('p1', { titre: 'Champel' }) }),
      match('m18', emma, {}, { bien: bien('p2', { titre: 'Cologny' }) }),
    ], [], { ...SANS_FILTRE, texte: 'champel' }, MAINTENANT)
    expect(lignes.map((l) => l.acheteur.id)).toEqual(['c9'])
  })
})

describe('construireAConclure — les intéressés sans visite', () => {
  it('seulement `interested`, la réponse la plus ancienne d’abord, une réponse non datée en dernier', () => {
    const a = acheteur('c7')
    const r = construireAConclure([
      match('m6', a, { statut: 'interested', reponduLe: '2026-09-20T10:00:00.000Z' }),
      match('m17', a, { statut: 'interested', reponduLe: '2026-09-18T10:00:00.000Z' }),
      match('m20', a, { statut: 'visit_planned', reponduLe: '2026-09-10T10:00:00.000Z' }),
      match('m21', a, { statut: 'sent' }),
      match('m22', a, { statut: 'interested' }),
    ], SANS_FILTRE)
    expect(r.map((m) => m.id)).toEqual(['m17', 'm6', 'm22'])
  })
})

describe('signalPrix — « prix baissé de … » (§4.6)', () => {
  const antoine = acheteur('c10', 'Antoine')

  it('un bien refusé pour le prix et revenu : la baisse depuis le refus', () => {
    expect(signalPrix(match('m5', antoine, { statut: 'suggested', motif: 'prix', prixPropose: 3_450_000 }, { bien: bien('p2', { prix: 3_200_000 }) })))
      .toEqual({ baisse: 250_000, depuis: 'refus' })
  })

  it('un bien proposé sans réponse : la baisse depuis la proposition', () => {
    expect(signalPrix(match('m15', antoine, { prixPropose: 1_490_000 }, { bien: bien('b', { prix: 1_440_000 }) })))
      .toEqual({ baisse: 50_000, depuis: 'proposition' })
  })

  it('un prix nul (« prix sur demande ») n’est pas une baisse', () => {
    expect(signalPrix(match('m15', antoine, { prixPropose: 1_490_000 }, { bien: bien('b', { prix: 0 }) }))).toBeNull()
    expect(signalPrix(match('m5', antoine, { statut: 'suggested', motif: 'prix', prixPropose: 3_450_000 }, { bien: bien('p2', { prix: 0 }) })))
      .toBeNull()
  })

  it('rien sans prix proposé, sans baisse, ni sur un intéressé', () => {
    expect(signalPrix(match('x', antoine, {}, { bien: bien('b', { prix: 1 }) }))).toBeNull()
    expect(signalPrix(match('y', antoine, { prixPropose: 1_000_000 }, { bien: bien('b', { prix: 1_000_000 }) }))).toBeNull()
    expect(signalPrix(match('z', antoine, { statut: 'interested', prixPropose: 2_000_000 }, { bien: bien('b', { prix: 1_000_000 }) }))).toBeNull()
  })
})

describe('ongletValide et cleAttente', () => {
  it('un onglet inconnu retombe sur « À proposer »', () => {
    expect(ongletValide('enAttente')).toBe('enAttente')
    expect(ongletValide('aTraiter')).toBe('aProposer')
    expect(ongletValide(null)).toBe('aProposer')
  })

  it('la clé d’une ligne d’attente ne se confond pas avec un id de match', () => {
    expect(cleAttente('c9')).toBe('attente:c9')
  })
})
