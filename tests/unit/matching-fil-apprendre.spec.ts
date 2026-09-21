/**
 * « Apprendre » (lot B) — la correction de recherche proposée au DEUXIÈME refus pour un même motif, chiffrée
 * à partir des biens refusés (conception de la boucle, §4.6).
 *
 * ⚠ Là où le fil recopie une règle du moteur (familles de types, canton que nomme une ville), le test la
 * confronte au moteur lui-même : une règle à nous qui divergerait proposerait une correction sans effet.
 */
import { describe, expect, it } from 'vitest'
import { calculateScoreV2, normalizeZones } from '../../supabase/functions/_shared/matching-normalize'
import {
  construireCorrections, estNumerique, filtrerCorrections, saisieRefusee,
} from '@/components/matching-fil/filApprendre'
import type { FilBien, FilMatch, SuiviMatch } from '@/components/matching-fil/filModele'
import type { SearchCriteria } from '@/types/contact'

const JULIE: FilMatch['acheteur'] = { id: 'c9', prenom: 'Julie', nom: 'Morand', telephone: null, email: null, kyc: 'none' }
const CRITERES: SearchCriteria = {
  transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_min: 1_300_000, budget_max: 1_600_000,
  rooms_min: 4, surface_min: 100, features: ['balcon', 'ascenseur'],
}
const bien = (id: string, champs: Partial<FilBien> = {}): FilBien => ({
  id, titre: `Bien ${id}`, prix: 1_500_000, location: false, type: 'apartment', pieces: 4.5, surface: 110,
  ville: 'Genève', canton: 'GE', adresse: null, equipements: [], photo: null, ...champs,
})
const suivi = (s: Partial<SuiviMatch>): SuiviMatch => ({
  statut: 'rejected', proposeLe: null, reponduLe: '2026-09-20T10:00:00.000Z', motif: 'prix', note: null,
  prixPropose: null, apprisLe: null, ...s,
})
const m = (id: string, s: Partial<SuiviMatch>, b: Partial<FilBien> = {}, champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score: 90, raisons: null, criteres: CRITERES, creeLe: null, reporteJusquau: null, bien: bien(`b-${id}`, b),
  acheteur: JULIE, rechercheId: 'cs9', suivi: suivi(s), ...champs,
})
const accepte = (id: string, b: Partial<FilBien>) => m(id, { statut: 'interested', motif: null }, b)

describe('construireCorrections — au deuxième refus pour un même motif', () => {
  it('rien au premier refus ; au deuxième, le budget passe sous le prix refusé le plus bas', () => {
    const premier = m('m16', { prixPropose: 1_580_000 })
    expect(construireCorrections([premier])).toEqual([])
    const [c] = construireCorrections([premier, m('m14', { prixPropose: 1_560_000 })])
    expect(c).toMatchObject({
      cle: 'correction:cs9:prix', rechercheId: 'cs9', motif: 'prix',
      changement: { cle: 'budget_max', avant: 1_600_000, apres: 1_550_000, location: false },
    })
    expect(c!.refus.map((x) => x.id)).toEqual(['m16', 'm14'])
  })

  it('le prix refusé est celui PROPOSÉ, sinon le prix actuel ; un loyer se chiffre par 50 francs', () => {
    const loyer = { ...CRITERES, budget_min: 2_000, budget_max: 3_200 }
    const [c] = construireCorrections([
      m('a', {}, { prix: 3_010, location: true }, { criteres: loyer }),
      m('b', { prixPropose: 3_150 }, { prix: 2_990, location: true }, { criteres: loyer }),
    ])
    expect(c!.changement).toEqual({ cle: 'budget_max', avant: 3_200, apres: 3_000, location: true })
  })

  it('aucune correction qui n’abaisse rien, ni sous le budget minimum', () => {
    expect(construireCorrections([m('a', { prixPropose: 1_700_000 }), m('b', { prixPropose: 1_650_000 })])).toEqual([])
    expect(construireCorrections([m('a', { prixPropose: 1_295_000 }), m('b', { prixPropose: 1_299_000 })])).toEqual([])
  })

  it('un refus pris en compte ne compte plus ; deux recherches ne se mélangent pas', () => {
    expect(construireCorrections([m('a', { apprisLe: '2026-09-20T12:00:00.000Z' }), m('b', {})])).toEqual([])
    expect(construireCorrections([m('a', {}), m('b', {}, {}, { rechercheId: 'cs-autre' })])).toEqual([])
  })

  it('état et autre : jamais de correction', () => {
    expect(construireCorrections([m('a', { motif: 'etat' }), m('b', { motif: 'etat' })])).toEqual([])
    expect(construireCorrections([m('a', { motif: 'autre' }), m('b', { motif: 'autre' })])).toEqual([])
  })

  it('surface : le multiple de 5 m² au-dessus de la plus grande refusée ; pièces : une demi-pièce au-dessus', () => {
    const [s] = construireCorrections([m('a', { motif: 'surface' }, { surface: 104 }), m('b', { motif: 'surface' }, { surface: 112 })])
    expect(s!.changement).toEqual({ cle: 'surface_min', avant: 100, apres: 115 })
    const [p] = construireCorrections([m('a', { motif: 'pieces' }, { pieces: 4 }), m('b', { motif: 'pieces' }, { pieces: 4.5 })])
    expect(p!.changement).toEqual({ cle: 'rooms_min', avant: 4, apres: 5 })
  })

  it('quartier : la zone de ville sort ; le canton qu’elle nomme reste une zone', () => {
    const [c] = construireCorrections([m('a', { motif: 'quartier' }), m('b', { motif: 'quartier' })])
    expect(c!.changement).toEqual({ cle: 'zones', retirees: ['Genève'], apres: ['Champel', 'GE'] })
    const sansCode = { ...CRITERES, zones: ['Genève', 'Carouge'] }
    const [d] = construireCorrections([
      m('a', { motif: 'quartier' }, {}, { criteres: sansCode }), m('b', { motif: 'quartier' }, {}, { criteres: sansCode }),
    ])
    expect(d!.changement).toEqual({ cle: 'zones', retirees: ['Genève'], apres: ['Carouge', 'GE'] })
    // Le moteur lit « Genève » comme le canton GE : la retirer sans l'écrire élargirait la recherche au pays.
    expect(normalizeZones(['Genève']).cantons).toEqual(['GE'])
  })

  it('quartier : rien quand la ville refusée n’est retenue que par le canton, ni quand plus aucune zone ne resterait', () => {
    expect(construireCorrections([m('a', { motif: 'quartier' }, { ville: 'Onex' }), m('b', { motif: 'quartier' }, { ville: 'Onex' })])).toEqual([])
    const seule = { ...CRITERES, zones: ['Champel'] }
    expect(construireCorrections([
      m('a', { motif: 'quartier' }, { ville: 'Champel' }, { criteres: seule }), m('b', { motif: 'quartier' }, { ville: 'Champel' }, { criteres: seule }),
    ])).toEqual([])
  })

  it('type : celui, unique, des biens acceptés — une même famille du moteur ne se corrige pas', () => {
    const refus = [m('a', { motif: 'type' }, { type: 'house' }), m('b', { motif: 'type' }, { type: 'house' })]
    const [c] = construireCorrections([...refus, accepte('c', { type: 'villa' })])
    // Le type de la base, que la fiche écrit et relit (`villa`) — jamais la famille du moteur (`house`).
    expect(c!.changement).toEqual({ cle: 'type', avant: 'apartment', apres: 'villa' })
    expect(construireCorrections([...refus, accepte('c', { type: 'attique' })])).toEqual([])
    expect(calculateScoreV2({ type: 'attique' }, { type: 'apartment' }).reasons.type.match).toBe(true)
    expect(calculateScoreV2({ type: 'villa' }, { type: 'house' }).reasons.type.match).toBe(true)
    expect(construireCorrections([...refus, accepte('c', { type: 'house' }), accepte('d', { type: 'office' })])).toEqual([])
    expect(construireCorrections(refus)).toEqual([])
  })

  it('type : deux types d’une même famille donnent la famille ; un type saisi en français, son code', () => {
    const refus = [m('a', { motif: 'type' }, { type: 'apartment' }), m('b', { motif: 'type' }, { type: 'apartment' })]
    const [c] = construireCorrections([...refus, accepte('c', { type: 'house' }), accepte('d', { type: 'Villa' })])
    expect(c!.changement).toMatchObject({ cle: 'type', apres: 'house' })
    const [d] = construireCorrections([...refus, accepte('c', { type: 'Maison' })])
    expect(d!.changement).toMatchObject({ cle: 'type', apres: 'house' })
  })

  it('équipements : ce que TOUS les acceptés ont, qu’aucun refusé n’a, et qu’elle ne demande pas encore', () => {
    const [c] = construireCorrections([
      m('a', { motif: 'equipements' }, { equipements: ['Ascenseur'] }),
      m('b', { motif: 'equipements' }, { equipements: ['Balcon', 'Cave'] }),
      accepte('c', { equipements: ['Terrasse', 'Balcon', 'Cave'] }),
      m('d', { statut: 'visit_planned', motif: null }, { equipements: ['Terrasse', 'Cave', 'Parking'] }),
    ])
    expect(c!.changement).toEqual({ cle: 'features', ajoutes: ['terrasse'], apres: ['balcon', 'ascenseur', 'terrasse'] })
    expect(construireCorrections([m('a', { motif: 'equipements' }), m('b', { motif: 'equipements' })])).toEqual([])
  })

  it('équipements : écrits comme la fiche les écrit, jamais en slug du moteur', () => {
    const [c] = construireCorrections([
      m('a', { motif: 'equipements' }, { equipements: ['Ascenseur'] }),
      m('b', { motif: 'equipements' }, { equipements: ['Cave'] }),
      accepte('c', { equipements: ['Vue lac', 'Cheminée', 'machine_à_laver', 'custom:Place de parc'] }),
    ])
    // `vue lac` est l'id de la fiche (`CD_MUSTHAVE`) ; `vue-lac`, `cheminee` se liraient tels quels.
    expect(c!.changement).toMatchObject({ cle: 'features', ajoutes: ['vue lac', 'cheminée', 'machine à laver', 'place de parc'] })
  })

  it('les plus récentes d’abord', () => {
    const cs = construireCorrections([
      m('a', {}), m('b', {}),
      m('c', { motif: 'surface', reponduLe: '2026-09-21T10:00:00.000Z' }, { surface: 104 }), m('d', { motif: 'surface' }, { surface: 108 }),
    ])
    expect(cs.map((c) => c.motif)).toEqual(['surface', 'prix'])
  })
})

describe('saisieRefusee et estNumerique', () => {
  const budget = { cle: 'budget_max' as const, avant: 1_600_000, apres: 1_550_000, location: false }

  it('une saisie illisible, nulle ou négative est refusée', () => {
    expect(saisieRefusee(CRITERES, budget, Number.NaN)).toEqual({ raison: 'nombre' })
    expect(saisieRefusee(CRITERES, budget, 0)).toEqual({ raison: 'nombre' })
    expect(saisieRefusee(CRITERES, budget, -5)).toEqual({ raison: 'nombre' })
  })

  it('un budget maximum sous le minimum est refusé ; au minimum, il passe', () => {
    expect(saisieRefusee(CRITERES, budget, 1_200_000)).toEqual({ raison: 'sousMinimum', borne: 1_300_000 })
    expect(saisieRefusee(CRITERES, budget, 1_300_000)).toBeNull()
    expect(saisieRefusee({ ...CRITERES, budget_min: undefined }, budget, 900_000)).toBeNull()
  })

  it('une surface ou des pièces minimum au-dessus de leur maximum sont refusées', () => {
    const bornee = { ...CRITERES, surface_max: 120, rooms_max: 5 }
    expect(saisieRefusee(bornee, { cle: 'surface_min', avant: 100, apres: 115 }, 125)).toEqual({ raison: 'auDelaMaximum', borne: 120 })
    expect(saisieRefusee(bornee, { cle: 'surface_min', avant: 100, apres: 115 }, 120)).toBeNull()
    expect(saisieRefusee(bornee, { cle: 'rooms_min', avant: 4, apres: 5 }, 5.5)).toEqual({ raison: 'auDelaMaximum', borne: 5 })
  })

  it('seuls le budget, la surface et les pièces se saisissent', () => {
    expect(estNumerique({ cle: 'surface_min', avant: null, apres: 115 })).toBe(true)
    expect(estNumerique({ cle: 'type', avant: null, apres: 'house' })).toBe(false)
  })
})

describe('filtrerCorrections', () => {
  it('un filtre sur un bien les écarte ; l’acheteur et le texte s’appliquent', () => {
    const cs = construireCorrections([m('a', {}), m('b', {})])
    expect(filtrerCorrections(cs, { bienId: 'p1', acheteurId: null, texte: '' })).toEqual([])
    expect(filtrerCorrections(cs, { bienId: null, acheteurId: 'c9', texte: '' })).toHaveLength(1)
    expect(filtrerCorrections(cs, { bienId: null, acheteurId: 'c7', texte: '' })).toEqual([])
    expect(filtrerCorrections(cs, { bienId: null, acheteurId: null, texte: 'morand' })).toHaveLength(1)
  })
})
