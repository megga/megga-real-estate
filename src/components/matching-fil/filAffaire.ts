/**
 * La fiche d'AFFAIRE branchée sur le matching (étape 5b-1, conception `2026-09-30-fiche-affaire-matching-design.md`) —
 * modèle PUR : les biens de l'acheteur, rangés par état, et les lignes que le matching ajoute à l'historique de
 * l'affaire. Ni React, ni Supabase, ni traduction.
 *
 * ⚠ UNE RÈGLE, UNE SOURCE : les biens et leur lecture viennent de « Sa boucle » (`construireSaBoucle`, `versMatch`,
 * et pour nommer les biens du journal `jointureDuMatch`, `titreDuBien`), leur état de « Qui pour ce bien ? »
 * (`versCompatible`, `etatCompatible`), leur place dans le fil de `lienPlace`.
 * Seules l'« occasion » et la clé d'état d'un mandat redisent une règle du fil : `horsVente` (`filModele`) et
 * `cleEtatMandat` (`filBoucle`) lisent `enVente` et `statut`, que `versBien` pose et que `versMatch` ne pose pas.
 * ⚠ Les refus n'y entrent pas : ils vivent dans « Sa boucle ». Un bien à proposer qui n'est plus une OCCASION non plus —
 * un mandat qui n'est plus en vente (`active` et non supprimé, la règle du fil), une annonce du marché retirée. Un
 * proposé ou un intéressé garde sa ligne, et l'état de son mandat s'y ajoute (« Vendu »), comme dans « En attente ».
 * ⚠ Le journal d'un geste du matching est écrit sur le CONTACT, pas sur l'affaire. Une proposition et une visite
 * portent `metadata.deal_id` ; un intérêt (`match_reaction`) ne porte que son match : il se relie à l'affaire par la
 * DERNIÈRE proposition de ce bien qui le précède — un bien reproposé avec une autre affaire lui appartient désormais.
 */
import type { SearchCriteria } from '@/types/contact'
import {
  construireSaBoucle, jointureDuMatch, titreDuBien, versMatch, type EtatBoucle, type LigneBoucleContact,
} from '@/components/crm/contacts-pager/saBoucle'
import { lienPlace } from './filLiens'
import { etatCompatible, versCompatible, type EtatCompatible } from './filQuiPour'
import { temps, type FilMatch } from './filModele'

/** Un bien de l'acheteur, prêt à écrire. */
export interface BienAffaire {
  id: string
  /** 0 : intéressé ou visite planifiée · 1 : proposé · 2 : à proposer (un bien revenu, ou jamais proposé). */
  rang: 0 | 1 | 2
  score: number
  titre: string
  prix: number | null
  location: boolean
  /** L'état du bien, clé et valeurs brutes (dates, prix) : l'écran l'écrit (`texteEtatCompatible`). */
  etat: EtatCompatible
  /** La clé de l'état d'un mandat qui n'est plus en vente (`listings:status.*`, comme `cleEtatMandat` de `filBoucle`) ; `null` sinon. */
  cleEtatMandat: string | null
  /** La requête du fil qui ouvre ce bien à sa place ; `null` : il n'en a pas. */
  lien: string | null
}

/**
 * Les lignes du bloc, et combien il en compte avant le plafond de huit — le « N biens » de l'en-tête. Parmi les biens à
 * proposer jamais proposés, seuls les trois meilleurs y entrent.
 */
export interface BiensAffaire {
  lignes: BienAffaire[]
  total: number
}

/** Huit lignes au plus : au-delà, le fil. */
const PLAFOND_BIENS = 8
/** Les meilleurs biens à proposer lus hors de « Sa boucle » : trois, comme le bloc d'avant. */
const PLAFOND_A_PROPOSER = 3

/** Le rang d'un bien à proposer : un revenu de « Sa boucle », ou un bien jamais proposé. */
const RANG_A_PROPOSER = 2
const RANGS: Record<Exclude<EtatBoucle, 'refuse'>, BienAffaire['rang']> = {
  interesse: 0, visite: 0, propose: 1, revenu: RANG_A_PROPOSER,
}

const premiere = <T>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null)

/** Le statut du mandat d'un match, lu sur sa jointure ; `null` pour une annonce du marché. */
const statutMandat = (l: LigneBoucleContact): string | null => (l.property_id ? premiere(l.property)?.status ?? null : null)

/**
 * Un bien encore OCCASION — le mot du copilote WhatsApp : un mandat en vente (`active`) et non supprimé, une annonce
 * du marché non retirée. Sans jointure, rien ne le dit : la RLS masque un mandat supprimé.
 */
function occasion(l: LigneBoucleContact): boolean {
  if (l.property_id) {
    const p = premiere(l.property)
    return p != null && p.status === 'active' && p.deleted_at == null
  }
  const a = premiere(l.market_listing)
  return a != null && a.status !== 'removed'
}

/**
 * Où en est un match, lu comme « Qui pour ce bien ? » le lit (`versCompatible`) : le report ne vaut que pour un match À
 * PROPOSER — un bien proposé puis reporté s'écrirait sinon « Reporté jusqu'au … », là où « Sa boucle » dit « Proposé » —,
 * et un match jamais proposé n'a pas de suivi.
 */
function etatDe(l: LigneBoucleContact, acheteur: FilMatch['acheteur'], maintenant: number): EtatCompatible {
  // `versCompatible` ne rend `null` que sans contact : il reçoit l'acheteur.
  const c = versCompatible({ ...l, contact_id: acheteur.id }, { first_name: acheteur.prenom, last_name: acheteur.nom })!
  return etatCompatible(c, maintenant)
}

/** Une ligne du bloc, depuis un match lu comme le fil le lit (`versMatch`). */
const ligneDe = (m: FilMatch, reste: Pick<BienAffaire, 'rang' | 'etat' | 'cleEtatMandat' | 'lien'>): BienAffaire => ({
  id: m.id, score: m.score, titre: m.bien.titre, prix: m.bien.prix, location: m.bien.location, ...reste,
})

/** Un bien à proposer lu hors de « Sa boucle » ; `null` s'il n'est plus une occasion ou s'il est reporté. */
function bienAProposer(l: LigneBoucleContact, acheteur: FilMatch['acheteur'], maintenant: number): BienAffaire | null {
  if (l.status !== 'suggested' || !occasion(l)) return null
  // Lu comme une ligne de « Sa boucle » : son titre, et le prix COURANT d'une annonce du marché.
  const m = versMatch(l, acheteur, null)
  const etat = etatDe(l, acheteur, maintenant)
  if (!m || etat.cle === 'reporte') return null
  const lien = lienPlace({ id: l.id, statut: 'suggested', contactId: acheteur.id, marche: m.bien.marche != null, reporte: false })
  return ligneDe(m, { rang: RANG_A_PROPOSER, etat, cleEtatMandat: null, lien })
}

const parRang = (a: BienAffaire, b: BienAffaire): number => a.rang - b.rang || b.score - a.score || a.id.localeCompare(b.id)

/**
 * Les biens de l'acheteur, par état : intéressés et visites planifiées, puis proposés, puis biens à proposer — les
 * revenus de « Sa boucle » et les trois meilleurs lus hors d'elle (`aProposer`, les `suggested` de l'acheteur par score).
 * `maintenant` est l'heure de la lecture : c'est contre elle que se juge un report. De l'acheteur, seul l'`id` compte
 * ici ; `boucle.criteres` et son nom ne servent qu'à « Sa boucle » (le texte d'un revenu, ses corrections).
 */
export function biensDeLAffaire(
  boucle: { lignes: readonly LigneBoucleContact[]; criteres: ReadonlyMap<string, SearchCriteria | null> },
  aProposer: readonly LigneBoucleContact[],
  acheteur: FilMatch['acheteur'],
  maintenant: number,
): BiensAffaire {
  // La PREMIÈRE ligne d'un id, comme `construireSaBoucle` (la lecture de la boucle d'abord) : l'état se lit sur elle, et
  // un bien reproposé entre les deux lectures s'écrirait sinon « revenu » parmi les proposés.
  const parId = new Map<string, LigneBoucleContact>()
  for (const l of boucle.lignes) if (!parId.has(l.id)) parId.set(l.id, l)
  const saBoucle = construireSaBoucle(boucle.lignes, boucle.criteres, acheteur, maintenant)
  const tous: BienAffaire[] = []
  for (const b of saBoucle.biens) {
    const l = parId.get(b.m.id)
    if (b.etat === 'refuse' || !l) continue
    // Un revenu est un bien À PROPOSER : il sort, comme de « À proposer » dans le fil et d'« Aujourd'hui », s'il n'est
    // plus une occasion (décision 12a du lot E1). « Sa boucle », l'historique du contact, le garde, sans lien.
    if (b.etat === 'revenu' && !occasion(l)) continue
    const statut = statutMandat(l)
    tous.push(ligneDe(b.m, {
      rang: RANGS[b.etat], etat: etatDe(l, acheteur, maintenant),
      cleEtatMandat: statut && statut !== 'active' ? `listings:status.${statut}` : null, lien: b.lien,
    }))
  }
  // Ce que « Sa boucle » PORTE — ses biens, refus compris —, pas tout ce que ses lectures ont rendu : un match jamais
  // proposé qu'elle écarte (le banc compare `gt` en chaînes, et sa lecture des revenus le ramène) reste à proposer.
  const vus = new Set(saBoucle.biens.map((b) => b.m.id))
  const neufs: BienAffaire[] = []
  for (const l of aProposer) {
    if (vus.has(l.id)) continue
    vus.add(l.id)
    const neuf = bienAProposer(l, acheteur, maintenant)
    if (neuf) neufs.push(neuf)
  }
  tous.push(...neufs.sort(parRang).slice(0, PLAFOND_A_PROPOSER))
  tous.sort(parRang)
  return { lignes: tous.slice(0, PLAFOND_BIENS), total: tous.length }
}

/** Le nom de chaque bien que la fiche a lu, par match (`titreDuBien`) — un mandat supprimé n'en a pas : « un bien ». */
export function titresDesMatchs(...lectures: readonly (readonly LigneBoucleContact[])[]): Map<string, string> {
  const titres = new Map<string, string>()
  for (const l of lectures.flat()) {
    const titre = titreDuBien(jointureDuMatch(l))
    if (titre && !titres.has(l.id)) titres.set(l.id, titre)
  }
  return titres
}

/** Les actions du journal d'un contact que l'historique de l'affaire lit. */
export const ACTIONS_JOURNAL_MATCHING = ['match_propose', 'visit_scheduled', 'match_reaction'] as const

/** Un événement du journal du contact (`activity_events`). */
export interface EvenementMatching {
  action: string
  created_at: string
  metadata: Record<string, unknown> | null
}

/** Une ligne que le matching ajoute à l'historique de l'affaire. */
export interface LigneJournalMatching {
  quand: string
  genre: 'propose' | 'interesse' | 'visite'
  /** Le titre du bien ; `null` : introuvable, ou une sélection — l'écran écrit « un bien », ou le nombre. */
  bien: string | null
  /** Le nombre de biens d'une proposition ; 1 pour un intérêt ou une visite. */
  nombre: number
}

const texte = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const idsDe = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [])

/**
 * Les lignes du matching de l'affaire `dealId`, du plus récent au plus ancien : ses propositions et ses visites (elles
 * portent l'affaire), et les intérêts pour un bien qu'elle a proposé en dernier. Un refus n'y entre pas.
 */
export function journalMatchingDeLAffaire(
  evenements: readonly EvenementMatching[], dealId: string, titres: ReadonlyMap<string, string>,
): LigneJournalMatching[] {
  const lignes: LigneJournalMatching[] = []
  // Les propositions d'abord, quel que soit l'ordre de lecture, TOUTES affaires confondues : un intérêt se relie à
  // l'affaire de la dernière proposition de son bien qui le précède.
  const propositions = new Map<string, { quand: number; deal: string | null }[]>()
  for (const e of evenements) {
    if (e.action !== 'match_propose') continue
    const deal = texte(e.metadata?.deal_id)
    const ids = idsDe(e.metadata?.match_ids)
    const quand = temps(e.created_at)
    for (const id of ids) {
      const liste = propositions.get(id) ?? []
      liste.push({ quand, deal })
      propositions.set(id, liste)
    }
    if (deal !== dealId) continue
    const nombre = ids.length || (typeof e.metadata?.nombre === 'number' ? e.metadata.nombre : 1)
    lignes.push({ quand: e.created_at, genre: 'propose', bien: nombre === 1 && ids[0] ? titres.get(ids[0]) ?? null : null, nombre })
  }
  /** L'affaire de la dernière proposition du bien au plus tard à `quand` (une même transaction compte) ; `null` sans. */
  const affaireProposante = (matchId: string, quand: string): string | null => {
    const t = temps(quand)
    const avant = (propositions.get(matchId) ?? []).filter((p) => p.quand <= t)
    return avant.length ? avant.reduce((a, b) => (b.quand >= a.quand ? b : a)).deal : null
  }
  for (const e of evenements) {
    const matchId = texte(e.metadata?.match_id)
    if (e.action === 'visit_scheduled' && texte(e.metadata?.deal_id) === dealId) {
      lignes.push({ quand: e.created_at, genre: 'visite', bien: matchId ? titres.get(matchId) ?? null : null, nombre: 1 })
    } else if (e.action === 'match_reaction' && e.metadata?.new_status === 'interested' && matchId
      && affaireProposante(matchId, e.created_at) === dealId) {
      lignes.push({ quand: e.created_at, genre: 'interesse', bien: titres.get(matchId) ?? null, nombre: 1 })
    }
  }
  return lignes.sort((a, b) => temps(b.quand) - temps(a.quand))
}

/**
 * Une minute : le fil crée l'affaire (`rattacherDeal`), puis journalise le geste (`execProposer`, `execPlanifierVisite`) ;
 * le copilote, dans la même transaction (un même instant). Le geste SUIT la création, jamais l'inverse : un geste plus
 * ancien n'a pas pu la faire naître.
 */
const DELAI_ORIGINE_MS = 60_000
/** Dix secondes : la règle qui écarte déjà le doublon « Étape changée » de l'écran (`doublonDeLaBase`). */
const DELAI_DOUBLON_MS = 10_000

/** L'affaire est née du matching : une proposition ou une visite liée à elle suit sa création de moins d'une minute. */
export const neeDuMatching = (creeLe: string, lignes: readonly LigneJournalMatching[]): boolean =>
  lignes.some((l) => {
    const apres = temps(l.quand) - temps(creeLe)
    return l.genre !== 'interesse' && apres >= 0 && apres < DELAI_ORIGINE_MS
  })

/**
 * Un changement d'étape vers « Visite planifiée » à moins de dix secondes d'une visite du matching est le même geste :
 * la ligne du matching nomme le bien, elle seule reste.
 */
export const doublonDeVisite = (quand: string, lignes: readonly LigneJournalMatching[]): boolean =>
  lignes.some((l) => l.genre === 'visite' && Math.abs(temps(l.quand) - temps(quand)) < DELAI_DOUBLON_MS)
