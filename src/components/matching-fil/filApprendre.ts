/**
 * « Apprendre » (lot B, conception de la boucle §4.6) : au DEUXIÈME refus pour un même motif, une correction
 * CHIFFRÉE de la recherche de l'acheteur, à partir des biens refusés. Modèle PUR : ni React, ni Supabase, ni
 * traduction.
 *
 * ⚠ Les refus s'additionnent PAR RECHERCHE (`client_search_id`) : deux refus « prix » d'un même contact,
 * l'un sur un loyer, l'autre sur un achat, ne corrigent rien ensemble. Un refus pris en compte
 * (`apprentissage_at` : correction validée OU ignorée) ne compte plus — deux NOUVEAUX refus en proposeront une
 * autre.
 *
 * Les règles (§4.6), sur les seules clés que la fiche contact sait écrire — sans quoi le pont
 * `sync_contact_client_search` effacerait la correction au prochain enregistrement de la fiche :
 *   · prix — le budget maximum passe SOUS le prix refusé le plus bas (le prix PROPOSÉ), arrondi à 10 000
 *     francs (50 pour un loyer) ; jamais sous le budget minimum ;
 *   · surface — le minimum passe au multiple de 5 m² au-dessus de la plus grande surface refusée ;
 *   · pièces — une demi-pièce au-dessus du plus grand nombre refusé ;
 *   · quartier — la zone de VILLE qui a retenu les refusés sort ; un canton reste, et celui qu'une ville
 *     nomme (« Genève ») est gardé en code (« GE ») : le retirer élargirait la recherche au pays entier ;
 *   · type — le type, unique, des biens ACCEPTÉS (intéressé, visite) ;
 *   · équipements — ce que TOUS les acceptés ont et qu'AUCUN refusé n'a, ajouté aux équipements voulus.
 *     ⚠ Le moteur note les équipements en fraction (10 points sur 100) : un « obligatoire » strict attend un
 *     critère qu'il n'a pas (plan du lot B, « En attente ») ;
 *   · état, autre — rien : la note reste lisible.
 *
 * ⛔ CE QUI S'ÉCRIT DANS LA RECHERCHE EST CE QUE LA FICHE ÉCRIT, jamais un slug du moteur. Le type : le code
 * de la base (`apartment`, `villa` : `buildSearchCriteria`) ; un équipement : son libellé en minuscules,
 * accents et espaces gardés (`balcon`, `vue lac`, les ids de la fiche). Le slug (`vue-lac`, `cheminee`) se
 * lisait tel quel sur la fiche, qui ne le cochait pas ; la famille (`house` pour une villa) changeait le type
 * que l'agent avait sous les yeux. Les COMPARAISONS, elles, restent celles du moteur (slug, famille).
 *
 * ⛔ DEUX RÈGLES DU MOTEUR SONT RECOPIÉES ICI — les familles de types et les cantons que nomme une ville —,
 * parce que `src/` ne charge pas le code Deno (CLAUDE.md §4). `matching-fil-apprendre.spec.ts` les confronte
 * au moteur.
 */
import type { SearchCriteria } from '@/types/contact'
import { isCantonCode, PROP_TYPE_FR_TO_EN } from '@/lib/contactCriteria'
import { chaines, passeFiltres, slug, temps, type FilFiltres, type FilMatch } from './filModele'
import type { MotifRefus } from './filBoucle'

type MotifCorrigeable = Extract<MotifRefus, 'prix' | 'quartier' | 'surface' | 'pieces' | 'type' | 'equipements'>
const CORRIGEABLES = new Set<string>(['prix', 'quartier', 'surface', 'pieces', 'type', 'equipements'])

/** La correction proposée, sur UNE clé des critères. */
export type CorrectionChangement =
  | { cle: 'budget_max'; avant: number | null; apres: number; location: boolean }
  | { cle: 'surface_min'; avant: number | null; apres: number }
  | { cle: 'rooms_min'; avant: number | null; apres: number }
  | { cle: 'zones'; retirees: string[]; apres: string[] }
  | { cle: 'type'; avant: string | null; apres: string }
  | { cle: 'features'; ajoutes: string[]; apres: string[] }

/** Les corrections qui se saisissent : un nombre pré-rempli, que l'agent peut changer avant de valider. */
export type ChangementNumerique = Extract<CorrectionChangement, { cle: 'budget_max' | 'surface_min' | 'rooms_min' }>

/** Une correction de recherche proposée : une ligne de la section « Recherches à ajuster ». */
export interface Correction {
  /** `correction:<recherche>:<motif>`. */
  cle: string
  rechercheId: string
  acheteur: FilMatch['acheteur']
  motif: MotifCorrigeable
  /** Les refus qui la fondent. */
  refus: FilMatch[]
  /** Les critères ACTUELS de la recherche. */
  criteres: SearchCriteria
  changement: CorrectionChangement
}

const SEUIL_REFUS = 2
const PAS_VENTE = 10_000
const PAS_LOYER = 50
const PAS_SURFACE = 5

/** Les familles de types du moteur (`TYPE_FAMILY`, matching-normalize.ts). */
const FAMILLE_TYPE: Readonly<Record<string, string>> = {
  apartment: 'apartment', studio: 'apartment', attic: 'apartment', attique: 'apartment', duplex: 'apartment',
  loft: 'apartment', penthouse: 'apartment', house: 'house', villa: 'house', chalet: 'house', maison: 'house',
  commercial: 'commercial', office: 'commercial', bureau: 'commercial', parking: 'parking', garage: 'parking',
  land: 'land', terrain: 'land',
}

/** Les cantons que nomme une zone (`CANTON_BY_NAME`, matching-normalize.ts). */
const CANTON_PAR_NOM: Readonly<Record<string, string>> = {
  geneve: 'GE', geneva: 'GE', genf: 'GE', vaud: 'VD', waadt: 'VD', valais: 'VS', wallis: 'VS', neuchatel: 'NE',
  fribourg: 'FR', freiburg: 'FR', berne: 'BE', bern: 'BE', jura: 'JU', bale: 'BS', basel: 'BS', 'bale-ville': 'BS',
  'bale-campagne': 'BL', argovie: 'AG', aargau: 'AG', soleure: 'SO', solothurn: 'SO', zurich: 'ZH', zuerich: 'ZH',
  lucerne: 'LU', luzern: 'LU', zoug: 'ZG', zug: 'ZG', schwyz: 'SZ', nidwald: 'NW', obwald: 'OW', uri: 'UR',
  glaris: 'GL', glarus: 'GL', schaffhouse: 'SH', schaffhausen: 'SH', thurgovie: 'TG', thurgau: 'TG',
  'saint-gall': 'SG', 'st-gall': 'SG', grisons: 'GR', graubunden: 'GR', tessin: 'TI', ticino: 'TI',
}

const familleType = (type: string | null | undefined): string | null => {
  if (!type) return null
  const s = slug(type)
  return FAMILLE_TYPE[s] ?? s
}

/** La règle de zone du moteur (`scoreZone`) : égalité, ou inclusion entre slugs d'au moins 4 lettres. */
const zoneCouvre = (zone: string, ville: string): boolean =>
  zone === ville || (zone.length >= 4 && ville.length >= 4 && (zone.includes(ville) || ville.includes(zone)))

/** Le code du canton qu'une zone désigne (`GE`, ou « Genève »), ou `undefined`. */
const cantonDe = (zone: string): string | undefined =>
  (isCantonCode(zone) ? zone.trim().toUpperCase() : CANTON_PAR_NOM[slug(zone)])

/** Budget, surface ou pièces : une correction qui se saisit. */
export const estNumerique = (ch: CorrectionChangement): ch is ChangementNumerique =>
  ch.cle === 'budget_max' || ch.cle === 'surface_min' || ch.cle === 'rooms_min'

function correctionPrix(c: SearchCriteria, refus: readonly FilMatch[]): CorrectionChangement | null {
  const prix = refus.map((m) => m.suivi?.prixPropose ?? m.bien.prix).filter((p): p is number => p != null && p > 0)
  if (prix.length === 0) return null
  const location = refus.some((m) => m.bien.location)
  const pas = location ? PAS_LOYER : PAS_VENTE
  const apres = Math.floor((Math.min(...prix) - 1) / pas) * pas
  const avant = c.budget_max ?? null
  if (apres <= 0 || (avant != null && apres >= avant) || (c.budget_min != null && apres < c.budget_min)) return null
  return { cle: 'budget_max', avant, apres, location }
}

function correctionSurface(c: SearchCriteria, refus: readonly FilMatch[]): CorrectionChangement | null {
  const surfaces = refus.map((m) => m.bien.surface).filter((s): s is number => s != null && s > 0)
  if (surfaces.length === 0) return null
  const apres = (Math.floor(Math.max(...surfaces) / PAS_SURFACE) + 1) * PAS_SURFACE
  const avant = c.surface_min ?? null
  if ((avant != null && apres <= avant) || (c.surface_max != null && apres > c.surface_max)) return null
  return { cle: 'surface_min', avant, apres }
}

function correctionPieces(c: SearchCriteria, refus: readonly FilMatch[]): CorrectionChangement | null {
  const pieces = refus.map((m) => m.bien.pieces).filter((p): p is number => p != null && p > 0)
  if (pieces.length === 0) return null
  const apres = Math.max(...pieces) + 0.5
  const avant = c.rooms_min ?? null
  if ((avant != null && apres <= avant) || (c.rooms_max != null && apres > c.rooms_max)) return null
  return { cle: 'rooms_min', avant, apres }
}

function correctionZones(c: SearchCriteria, refus: readonly FilMatch[]): CorrectionChangement | null {
  const zones = chaines(c.zones)
  const villes = refus.map((m) => slug(m.bien.ville ?? '')).filter(Boolean)
  const retirees = zones.filter((z) => !isCantonCode(z) && villes.some((v) => zoneCouvre(slug(z), v)))
  if (retirees.length === 0) return null
  const restantes = zones.filter((z) => !retirees.includes(z))
  const cantonsRestants = new Set(restantes.map(cantonDe).filter((code): code is string => code != null))
  const gardes = [...new Set(retirees.map(cantonDe).filter((code): code is string => code != null && !cantonsRestants.has(code)))]
  const apres = [...restantes, ...gardes]
  return apres.length > 0 ? { cle: 'zones', retirees, apres } : null
}

/** Un type tel que la fiche l'écrit : le code de la base, en minuscules ; un type saisi en français devient le sien. */
const codeType = (type: string | null): string | null => {
  const t = type?.trim().toLowerCase()
  return t ? PROP_TYPE_FR_TO_EN[t] ?? t : null
}

function correctionType(c: SearchCriteria, acceptes: readonly FilMatch[]): CorrectionChangement | null {
  const types = acceptes.map((m) => codeType(m.bien.type)).filter((t): t is string => t != null)
  const familles = [...new Set(types.map((t) => familleType(t) ?? t))]
  if (familles.length !== 1) return null
  const famille = familles[0]!
  const avant = c.type ?? null
  // Une même famille pour le moteur : il note déjà ces biens comme du type voulu, rien à corriger.
  if (familleType(avant) === famille) return null
  // Le type des acceptés s'ils n'en ont qu'un (une villa reste une villa), sinon leur famille, qui est aussi un
  // code de la base (une maison et une villa : `house`).
  const distincts = [...new Set(types)]
  return { cle: 'type', avant, apres: distincts.length === 1 ? distincts[0]! : famille }
}

/**
 * Un équipement tel que la fiche l'écrit : le libellé du bien en minuscules, accents et espaces gardés, sans
 * le préfixe `custom:` ni les `_` des attributs Flatfox (`machine_à_laver`).
 */
const libelleEquipement = (brut: string): string =>
  brut.replace(/^custom:/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()

function correctionEquipements(c: SearchCriteria, refus: readonly FilMatch[], acceptes: readonly FilMatch[]): CorrectionChangement | null {
  if (acceptes.length === 0) return null
  const voulus = new Set(chaines(c.features).map(slug))
  const refuses = new Set(refus.flatMap((m) => m.bien.equipements.map(slug)))
  // Comparés par slug, comme le moteur ; écrits par le libellé du premier accepté qui les porte.
  const [premier, ...autres] = acceptes.map((m) => {
    const parSlug = new Map<string, string>()
    for (const e of m.bien.equipements) {
      const s = slug(e)
      if (s && !parSlug.has(s)) parSlug.set(s, libelleEquipement(e))
    }
    return parSlug
  })
  const ajoutes = [...premier!]
    .filter(([s]) => autres.every((a) => a.has(s)) && !refuses.has(s) && !voulus.has(s))
    .map(([, libelle]) => libelle)
  return ajoutes.length > 0 ? { cle: 'features', ajoutes, apres: [...chaines(c.features), ...ajoutes] } : null
}

function changementPour(
  motif: MotifCorrigeable, c: SearchCriteria, refus: readonly FilMatch[], acceptes: readonly FilMatch[],
): CorrectionChangement | null {
  switch (motif) {
    case 'prix': return correctionPrix(c, refus)
    case 'surface': return correctionSurface(c, refus)
    case 'pieces': return correctionPieces(c, refus)
    case 'quartier': return correctionZones(c, refus)
    case 'type': return correctionType(c, acceptes)
    case 'equipements': return correctionEquipements(c, refus, acceptes)
  }
}

/**
 * Les corrections de recherche à proposer : une par recherche et par motif qui a au moins deux refus non
 * encore pris en compte ET un changement chiffrable. Les plus récentes d'abord.
 */
export function construireCorrections(boucle: readonly FilMatch[]): Correction[] {
  const groupes = new Map<string, FilMatch[]>()
  for (const m of boucle) {
    const s = m.suivi
    if (!s || s.statut !== 'rejected' || s.apprisLe != null || !m.rechercheId || !m.criteres) continue
    if (!s.motif || !CORRIGEABLES.has(s.motif)) continue
    const cle = `${m.rechercheId}:${s.motif}`
    groupes.set(cle, [...(groupes.get(cle) ?? []), m])
  }
  const corrections: Correction[] = []
  for (const [cle, refus] of groupes) {
    const premier = refus[0]!
    if (refus.length < SEUIL_REFUS || !premier.rechercheId || !premier.criteres) continue
    const motif = premier.suivi!.motif as MotifCorrigeable
    const acceptes = boucle.filter((m) =>
      m.rechercheId === premier.rechercheId && (m.suivi?.statut === 'interested' || m.suivi?.statut === 'visit_planned'))
    const changement = changementPour(motif, premier.criteres, refus, acceptes)
    if (!changement) continue
    corrections.push({
      cle: `correction:${cle}`, rechercheId: premier.rechercheId, acheteur: premier.acheteur, motif, refus,
      criteres: premier.criteres, changement,
    })
  }
  const dernierRefus = (c: Correction): number => Math.max(...c.refus.map((m) => temps(m.suivi?.reponduLe ?? null)))
  return corrections.sort((a, b) => dernierRefus(b) - dernierRefus(a) || a.cle.localeCompare(b.cle))
}

/** Les corrections retenues par les filtres du fil : un filtre sur un BIEN les écarte (une correction vise une recherche). */
export function filtrerCorrections(corrections: readonly Correction[], filtres: FilFiltres): Correction[] {
  if (filtres.bienId) return []
  return corrections.filter((c) => c.refus.some((m) => passeFiltres(m, filtres)))
}

/** Pourquoi une valeur saisie ne peut pas corriger la recherche : illisible, ou de l'autre côté de sa borne. */
export type SaisieRefusee =
  | { raison: 'nombre' }
  | { raison: 'sousMinimum'; borne: number }
  | { raison: 'auDelaMaximum'; borne: number }

/**
 * La valeur qu'un agent a saisie à la place de la valeur pré-remplie (budget, surface, pièces), ou `null` si
 * elle corrige la recherche. ⛔ Un budget maximum sous le minimum, une surface ou des pièces minimum au-dessus
 * du maximum : la recherche ne retiendrait plus rien. Les propositions d'« Apprendre » s'en gardent déjà ; la
 * saisie de l'agent, elle, passait.
 */
export function saisieRefusee(c: SearchCriteria, ch: ChangementNumerique, valeur: number): SaisieRefusee | null {
  if (!Number.isFinite(valeur) || valeur <= 0) return { raison: 'nombre' }
  if (ch.cle === 'budget_max' && c.budget_min != null && valeur < c.budget_min) return { raison: 'sousMinimum', borne: c.budget_min }
  const max = ch.cle === 'surface_min' ? c.surface_max : ch.cle === 'rooms_min' ? c.rooms_max : undefined
  if (max != null && valeur > max) return { raison: 'auDelaMaximum', borne: max }
  return null
}
