/**
 * La fiche d'AFFAIRE branchée sur le matching (étape 5b-1, conception `2026-09-30-fiche-affaire-matching-design.md`) :
 * le modèle pur `filAffaire.ts` — les biens de l'acheteur rangés par état, et les lignes que le matching ajoute à
 * l'historique de l'affaire.
 *
 * Ce que cette spec refuse :
 *   · un refus, un mandat supprimé, un bien à proposer qui n'est plus une occasion, un bien jamais proposé et reporté
 *     parmi les trois meilleurs, un autre statut qu'`active` tenu pour « en vente » ;
 *   · un autre ordre que : intéressés et visites, proposés, biens à proposer — le score décroissant, l'id départage ;
 *   · plus de trois biens à proposer lus hors de « Sa boucle », plus de huit lignes, un total qui ne compte pas tout ;
 *   · un bien lu deux fois compté deux fois ; les trois meilleurs choisis avant d'écarter les reportés et les biens qui ne
 *     sont plus en vente ; un report jugé à une autre heure que celle de l'appelant ;
 *   · un lien vers une autre place que celle du bien dans le fil ; un proposé reporté écrit « reporté » ;
 *   · une ligne du journal d'une AUTRE affaire, un intérêt pour un bien qui n'y a pas été proposé, un refus au journal ;
 *   · une origine « depuis le matching » au-delà d'une minute, un doublon de visite au-delà de dix secondes.
 */
import { describe, expect, it } from 'vitest'
import type { LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import {
  biensDeLAffaire, doublonDeVisite, journalMatchingDeLAffaire, neeDuMatching, titresDesMatchs,
  type EvenementMatching,
} from '@/components/matching-fil/filAffaire'
import type { SearchCriteria } from '@/types/contact'
import { Constants } from '@/types/database'

const ACHETEUR = { id: 'c9', prenom: 'Julie', nom: 'Morand', telephone: null, email: null, kyc: 'none' as const }
const JOUR = 86_400_000
/**
 * L'heure de lecture de la fiche, FIXE et loin de l'horloge : la base des dates des lignes (`il`), et le `maintenant` des
 * reports. Un `Date.now()` caché dans le modèle ferait rougir les tests de report.
 */
const MAINTENANT = Date.parse('2020-01-15T10:00:00Z')
const il = (j: number) => new Date(MAINTENANT - j * JOUR).toISOString()
const SANS = new Map<string, SearchCriteria | null>()

/** Une annonce du marché, active. */
const annonce = (titre: string, prix = 1_500_000, statut = 'active') => ({
  title: titre, city: 'Genève', price: prix, current_price: prix, transaction_type: 'buy', features: [], status: statut,
})
/** Un mandat, en vente par défaut. */
const mandat = (titre: string, prix = 1_450_000, statut = 'active', supprimeLe: string | null = null) => ({
  title: titre, city: 'Genève', price: prix, transaction_type: 'buy', features: [], status: statut, deleted_at: supprimeLe,
})
const ligne = (id: string, status: string, champs: Partial<LigneBoucleContact> = {}): LigneBoucleContact => ({
  id, status, score: 90, sent_at: il(5), response_at: null, reaction_motif: null, reaction_note: null,
  prix_propose: null, apprentissage_at: null, client_search_id: 'cs9', snoozed_until: null,
  property_id: null, market_listing_id: `ml-${id}`, market_listing: annonce(`Annonce ${id}`),
  ...champs,
})
/** Un match à proposer, jamais proposé : ni date de proposition, ni prix proposé, ni motif. */
const aProposer = (id: string, score: number, champs: Partial<LigneBoucleContact> = {}): LigneBoucleContact =>
  ligne(id, 'suggested', { score, sent_at: null, ...champs })
const biens = (boucle: LigneBoucleContact[], neufs: LigneBoucleContact[] = []) =>
  biensDeLAffaire({ lignes: boucle, criteres: SANS }, neufs, ACHETEUR, MAINTENANT)

describe('biensDeLAffaire — quels biens', () => {
  it('les refus n’y entrent pas : ils vivent dans « Sa boucle »', () => {
    const r = biens([ligne('m1', 'sent'), ligne('m2', 'rejected', { reaction_motif: 'prix' })])
    expect(r.lignes.map((b) => b.id)).toEqual(['m1'])
  })

  it('un mandat supprimé n’a pas de ligne, qu’il soit proposé ou à proposer', () => {
    const r = biens(
      [ligne('m1', 'sent', { property_id: 'p1', market_listing_id: null, market_listing: null, property: null }),
        ligne('m2', 'interested', { property_id: 'p2', market_listing_id: null, market_listing: null, property: mandat('Villa', 3_000_000, 'active', il(2)) })],
      [aProposer('m3', 99, { property_id: 'p3', market_listing_id: null, market_listing: null, property: mandat('Loft', 900_000, 'active', il(1)) })],
    )
    expect(r.lignes).toEqual([])
    expect(r.total).toBe(0)
  })

  it('un bien à proposer qui n’est plus une occasion n’entre pas — un proposé ou un intéressé garde sa ligne, avec l’état de son mandat', () => {
    const r = biens(
      [ligne('m1', 'sent', { property_id: 'p1', market_listing_id: null, market_listing: null, property: mandat('Petit-Saconnex', 1_540_000, 'sold') }),
        // Un revenu sur un mandat vendu, et sur une annonce retirée : ni l'un ni l'autre ne se propose plus.
        ligne('m2', 'suggested', { prix_propose: 1_600_000, reaction_motif: 'prix', property_id: 'p2', market_listing_id: null, market_listing: null, property: mandat('Carouge', 1_500_000, 'sold') }),
        ligne('m3', 'suggested', { prix_propose: 1_600_000, reaction_motif: 'prix', market_listing: annonce('Servette', 1_500_000, 'removed') })],
      [aProposer('m4', 99, { property_id: 'p4', market_listing_id: null, market_listing: null, property: mandat('Champel', 1_450_000, 'reserved') }),
        aProposer('m5', 98, { market_listing: annonce('Onex', 1_200_000, 'removed') }),
        aProposer('m6', 70, { market_listing: annonce('Plainpalais', 1_180_000, 'price_reduced') })],
    )
    expect(r.lignes.map((b) => [b.id, b.cleEtatMandat])).toEqual([['m1', 'listings:status.sold'], ['m6', null]])
  })

  it('un bien à proposer REPORTÉ attend son retour : il n’est pas parmi les meilleurs à proposer', () => {
    const r = biens([], [aProposer('m1', 99, { snoozed_until: il(-3) }), aProposer('m2', 80)])
    expect(r.lignes.map((b) => b.id)).toEqual(['m2'])
  })

  it('un revenu reporté reste, écrit « reporté » et sans lien — la règle de « Sa boucle »', () => {
    const r = biens([ligne('m1', 'suggested', { prix_propose: 1_600_000, reaction_motif: 'prix', snoozed_until: il(-2) })])
    expect(r.lignes[0]).toMatchObject({ id: 'm1', rang: 2, lien: null })
    expect(r.lignes[0]!.etat).toEqual({ cle: 'reporte', date: il(-2) })
  })

  it('un match jamais proposé que la lecture de « Sa boucle » ramène sans le porter reste à proposer', () => {
    // Le banc compare `gt` en chaînes : sa lecture des revenus ramène aussi les `suggested` jamais proposés.
    const neuf = aProposer('m1', 95)
    expect(biens([neuf], [neuf]).lignes.map((b) => [b.id, b.etat.cle])).toEqual([['m1', 'aProposer']])
  })

  it('les trois meilleurs biens à proposer lus hors de « Sa boucle » — ceux qu’elle porte déjà n’y sont pas deux fois', () => {
    // Le revenu a le MEILLEUR score : lu deux fois, il prendrait l'une des trois places ; dédoublonné après le choix, il
    // en laisserait une vide.
    const revenu = ligne('m1', 'suggested', { score: 99, prix_propose: 1_600_000, reaction_motif: 'prix' })
    const r = biens([revenu], [revenu, aProposer('m2', 95), aProposer('m3', 97), aProposer('m4', 91), aProposer('m5', 90)])
    expect(r.lignes.map((b) => b.id)).toEqual(['m1', 'm3', 'm2', 'm4'])
    expect(r.total).toBe(4)
  })

  it('les trois meilleurs se choisissent APRÈS avoir écarté les reportés et les biens qui ne sont plus en vente', () => {
    const r = biens([], [aProposer('m1', 99, { snoozed_until: il(-3) }), aProposer('m2', 98, { market_listing: annonce('Onex', 1_200_000, 'removed') }),
      aProposer('m3', 90), aProposer('m4', 80), aProposer('m5', 70)])
    expect(r.lignes.map((b) => b.id)).toEqual(['m3', 'm4', 'm5'])
  })

  it('un match écarté n’est pas à proposer', () => {
    const r = biens([], [aProposer('m1', 99, { status: 'ignored' }), aProposer('m2', 80)])
    expect(r.lignes.map((b) => b.id)).toEqual(['m2'])
  })

  it('une ligne lue deux fois garde la PREMIÈRE : un bien reproposé entre les deux lectures reste « proposé »', () => {
    const r = biens([ligne('m1', 'sent'), ligne('m1', 'suggested', { prix_propose: 1_600_000, reaction_motif: 'prix' })])
    expect(r.lignes).toHaveLength(1)
    expect(r.lignes[0]).toMatchObject({ id: 'm1', rang: 1, lien: 'attente=c9', etat: { cle: 'propose' } })
  })

  it('l’état d’une annonce du marché ne s’écrit jamais comme celui d’un mandat', () => {
    const r = biens([ligne('m1', 'sent', { market_listing: annonce('Servette', 1_500_000, 'price_reduced') }),
      ligne('m2', 'interested', { market_listing: annonce('Onex', 1_200_000, 'removed') })])
    expect(r.lignes.map((b) => [b.id, b.cleEtatMandat])).toEqual([['m2', null], ['m1', null]])
  })

  it('seul `active` est en vente — statut par statut : un à proposer sort, un proposé écrit l’état de son mandat', () => {
    const surMandat = (s: string) => ({ property_id: 'p1', market_listing_id: null, market_listing: null, property: mandat('Champel', 1_450_000, s) })
    for (const s of Constants.public.Enums.property_status) {
      const r = biens(
        [ligne('m1', 'sent', surMandat(s)), ligne('m3', 'suggested', { prix_propose: 1_600_000, reaction_motif: 'prix', ...surMandat(s) })],
        [aProposer('m2', 99, surMandat(s))],
      )
      expect(r.lignes.map((b) => [b.id, b.cleEtatMandat]), s)
        .toEqual(s === 'active' ? [['m1', null], ['m2', null], ['m3', null]] : [['m1', `listings:status.${s}`]])
    }
  })
})

describe('biensDeLAffaire — l’ordre, le plafond', () => {
  it('intéressés et visites planifiées, puis proposés, puis biens à proposer ; le score décroissant, l’id départage', () => {
    const r = biens(
      [ligne('m1', 'sent', { score: 99 }), ligne('m2', 'interested', { score: 70 }), ligne('m3', 'visit_planned', { score: 80 }),
        ligne('m4', 'sent', { score: 99 }), ligne('m5', 'suggested', { score: 98, prix_propose: 1_600_000, reaction_motif: 'prix' })],
      [aProposer('m6', 100)],
    )
    expect(r.lignes.map((b) => [b.id, b.rang])).toEqual([['m3', 0], ['m2', 0], ['m1', 1], ['m4', 1], ['m6', 2], ['m5', 2]])
  })

  it('huit lignes au plus ; le total compte tout', () => {
    const r = biens(Array.from({ length: 10 }, (_, i) => ligne(`m${i}`, 'sent', { score: 90 - i })), [aProposer('n1', 99)])
    expect(r.lignes).toHaveLength(8)
    expect(r.total).toBe(11)
    expect(r.lignes.at(-1)!.id).toBe('m7')
  })
})

describe('biensDeLAffaire — l’état, le lien', () => {
  it('chaque bien mène à SA place dans le fil ; une visite planifiée nulle part', () => {
    const r = biens(
      [ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'),
        ligne('m6', 'suggested', { prix_propose: 1_600_000, reaction_motif: 'prix', property_id: 'p6', market_listing_id: null, market_listing: null, property: mandat('Carouge') })],
      [aProposer('m4', 99, { property_id: 'p4', market_listing_id: null, market_listing: null, property: mandat('Champel') }),
        aProposer('m5', 98)],
    )
    const lien = Object.fromEntries(r.lignes.map((b) => [b.id, b.lien]))
    expect(lien).toEqual({
      m1: 'attente=c9',
      m2: 'onglet=aConclure&ligne=m2&contact=c9',
      m3: null,
      m4: 'ligne=m4&contact=c9',
      // Une annonce du marché : la ligne « Marché » de l'acheteur (`cleSelection`), où le fil la range.
      m5: 'ligne=marche%3Ac9&contact=c9',
      // Un revenu en vente : sa ligne dans « À proposer ».
      m6: 'ligne=m6&contact=c9',
    })
  })

  it('un proposé REPORTÉ reste « proposé » : le report ne vaut que pour un bien à proposer', () => {
    const r = biens([ligne('m1', 'sent', { sent_at: il(6), snoozed_until: il(-4) })])
    expect(r.lignes[0]!.etat).toEqual({ cle: 'propose', date: il(6) })
  })

  it('le titre, le prix, la location — le prix courant d’une annonce du marché', () => {
    const r = biens([], [aProposer('m1', 99, { market_listing: { ...annonce('Loft · Eaux-Vives', 1_500_000), current_price: 1_390_000, transaction_type: 'rent' } })])
    expect(r.lignes[0]).toMatchObject({ titre: 'Loft · Eaux-Vives', prix: 1_390_000, location: true, etat: { cle: 'aProposer' } })
  })
})

/** Un événement du journal d'un contact. */
const evt = (action: string, heures: number, metadata: Record<string, unknown>): EvenementMatching => ({
  action, created_at: new Date(MAINTENANT - heures * 3_600_000).toISOString(), metadata,
})
const TITRES = new Map([['m1', 'Attique · Florissant'], ['m2', 'Appartement · Champel']])

describe('journalMatchingDeLAffaire — les lignes de l’historique', () => {
  it('une proposition de CETTE affaire, nommée ; celle d’une autre affaire n’y entre pas', () => {
    const j = journalMatchingDeLAffaire([
      evt('match_propose', 5, { deal_id: 'd5', match_ids: ['m1'], nombre: 1 }),
      evt('match_propose', 4, { deal_id: 'd9', match_ids: ['m2'], nombre: 1 }),
    ], 'd5', TITRES)
    expect(j).toEqual([{ quand: evt('x', 5, {}).created_at, genre: 'propose', bien: 'Attique · Florissant', nombre: 1 }])
  })

  it('une sélection se compte ; elle ne nomme pas un bien', () => {
    const [l] = journalMatchingDeLAffaire([evt('match_propose', 5, { deal_id: 'd5', match_ids: ['m1', 'm2', 'm3'], nombre: 3 })], 'd5', TITRES)
    expect(l).toMatchObject({ genre: 'propose', bien: null, nombre: 3 })
  })

  it('un intérêt se relie à l’affaire par les biens qui y ont été proposés — un refus, ou un autre bien, n’y entre pas', () => {
    const j = journalMatchingDeLAffaire([
      evt('match_reaction', 1, { match_id: 'm1', new_status: 'interested' }),
      evt('match_reaction', 2, { match_id: 'm2', new_status: 'interested' }),
      evt('match_reaction', 3, { match_id: 'm1', new_status: 'rejected' }),
      evt('match_propose', 5, { deal_id: 'd5', match_ids: ['m1'], nombre: 1 }),
    ], 'd5', TITRES)
    expect(j.map((l) => [l.genre, l.bien])).toEqual([['interesse', 'Attique · Florissant'], ['propose', 'Attique · Florissant']])
  })

  it('un intérêt pour un bien proposé avec UNE AUTRE affaire n’entre pas', () => {
    const j = journalMatchingDeLAffaire([
      evt('match_reaction', 1, { match_id: 'm3', new_status: 'interested' }),
      evt('match_propose', 5, { deal_id: 'd9', match_ids: ['m3'], nombre: 1 }),
    ], 'd5', TITRES)
    expect(j).toEqual([])
  })

  it('un bien reproposé avec une autre affaire lui appartient : l’intérêt qui suit n’est plus celui de la première', () => {
    const evenements = [
      evt('match_reaction', 1, { match_id: 'm1', new_status: 'interested' }),
      evt('match_propose', 3, { deal_id: 'dB', match_ids: ['m1'], nombre: 1 }),
      evt('match_propose', 720, { deal_id: 'dA', match_ids: ['m1'], nombre: 1 }),
    ]
    expect(journalMatchingDeLAffaire(evenements, 'dA', TITRES).map((l) => l.genre)).toEqual(['propose'])
    expect(journalMatchingDeLAffaire(evenements, 'dB', TITRES).map((l) => l.genre)).toEqual(['interesse', 'propose'])
  })

  it('des métadonnées inattendues ne font ni exception ni ligne parasite ; sans `match_ids`, le nombre dit la sélection', () => {
    const j = journalMatchingDeLAffaire([
      { action: 'match_propose', created_at: evt('x', 1, {}).created_at, metadata: null },
      evt('match_propose', 2, { deal_id: 5, match_ids: 'm1' }),
      evt('match_propose', 3, { deal_id: 'd5', nombre: 3 }),
      evt('visit_scheduled', 4, { deal_id: 'd5', match_id: 7 }),
    ], 'd5', TITRES)
    expect(j.map((l) => [l.genre, l.bien, l.nombre])).toEqual([['propose', null, 3], ['visite', null, 1]])
  })

  it('une visite planifiée de cette affaire ; un bien introuvable s’écrit « un bien » (`null`)', () => {
    const j = journalMatchingDeLAffaire([
      evt('visit_scheduled', 1, { deal_id: 'd5', match_id: 'm2', visit_id: 'v1' }),
      evt('visit_scheduled', 2, { deal_id: 'd5', match_id: 'm-supprime', visit_id: 'v2' }),
      evt('visit_scheduled', 3, { deal_id: 'd9', match_id: 'm1', visit_id: 'v3' }),
    ], 'd5', TITRES)
    expect(j.map((l) => [l.genre, l.bien])).toEqual([['visite', 'Appartement · Champel'], ['visite', null]])
  })

  it('du plus récent au plus ancien', () => {
    const j = journalMatchingDeLAffaire([
      evt('match_propose', 9, { deal_id: 'd5', match_ids: ['m1'], nombre: 1 }),
      evt('visit_scheduled', 2, { deal_id: 'd5', match_id: 'm1' }),
      evt('match_reaction', 4, { match_id: 'm1', new_status: 'interested' }),
    ], 'd5', TITRES)
    expect(j.map((l) => l.genre)).toEqual(['visite', 'interesse', 'propose'])
  })
})

describe('neeDuMatching, doublonDeVisite', () => {
  const cree = new Date(MAINTENANT - 10 * 3_600_000).toISOString()
  const decale = (ms: number) => new Date(Date.parse(cree) + ms).toISOString()

  it('« Deal créé depuis le matching » : une proposition ou une visite de l’affaire à moins d’une minute de sa création', () => {
    expect(neeDuMatching(cree, [{ quand: decale(800), genre: 'propose', bien: null, nombre: 1 }])).toBe(true)
    expect(neeDuMatching(cree, [{ quand: decale(0), genre: 'visite', bien: null, nombre: 1 }])).toBe(true)
    expect(neeDuMatching(cree, [{ quand: decale(59_000), genre: 'propose', bien: null, nombre: 1 }])).toBe(true)
    expect(neeDuMatching(cree, [{ quand: decale(61_000), genre: 'propose', bien: null, nombre: 1 }])).toBe(false)
    expect(neeDuMatching(cree, [{ quand: decale(120_000), genre: 'propose', bien: null, nombre: 1 }])).toBe(false)
    // Un geste PLUS ANCIEN que l'affaire ne l'a pas fait naître.
    expect(neeDuMatching(cree, [{ quand: decale(-800), genre: 'propose', bien: null, nombre: 1 }])).toBe(false)
    // Un intérêt ne crée pas d'affaire.
    expect(neeDuMatching(cree, [{ quand: decale(500), genre: 'interesse', bien: null, nombre: 1 }])).toBe(false)
  })

  it('un changement d’étape à moins de dix secondes d’une visite planifiée est son doublon', () => {
    const lignes = [{ quand: decale(0), genre: 'visite' as const, bien: 'Champel', nombre: 1 }]
    expect(doublonDeVisite(decale(3_000), lignes)).toBe(true)
    // Des deux côtés : le changement d'étape peut précéder ou suivre la ligne de la visite.
    expect(doublonDeVisite(decale(9_000), lignes)).toBe(true)
    expect(doublonDeVisite(decale(-9_000), lignes)).toBe(true)
    expect(doublonDeVisite(decale(-11_000), lignes)).toBe(false)
    expect(doublonDeVisite(decale(11_000), lignes)).toBe(false)
    expect(doublonDeVisite(decale(30_000), lignes)).toBe(false)
    expect(doublonDeVisite(decale(1_000), [{ ...lignes[0]!, genre: 'propose' }])).toBe(false)
  })
})

describe('titresDesMatchs', () => {
  it('le titre de chaque bien lu, par match — l’adresse à défaut de titre', () => {
    const t = titresDesMatchs(
      [ligne('m1', 'sent', { market_listing: { ...annonce(''), address: 'Rue du Rhône 1' } })],
      [aProposer('m2', 90, { property_id: 'p2', market_listing_id: null, market_listing: null, property: mandat('Villa · Cologny') })],
    )
    expect(Object.fromEntries(t)).toEqual({ m1: 'Rue du Rhône 1', m2: 'Villa · Cologny' })
  })

  it('un mandat supprimé n’a pas de nom, même lu par un super-administrateur : « un bien »', () => {
    const t = titresDesMatchs([ligne('m3', 'sent', { property_id: 'p3', market_listing_id: null, market_listing: null, property: mandat('Villa · Cologny', 3_000_000, 'active', il(2)) })])
    expect(t.has('m3')).toBe(false)
  })
})
