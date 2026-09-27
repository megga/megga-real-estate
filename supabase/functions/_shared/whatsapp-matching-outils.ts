// Les outils du matching dans le copilote WhatsApp (lot D2, étape 4b) : leurs lectures et leurs écritures, par le
// client service-role de l'agent. Toute la logique vit dans `whatsapp-matching.ts` (pur, testé) ; ici, les requêtes.
//
// Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md (§5).
//
// SÉCURITÉ. Le client contourne la RLS : chaque lecture porte `.eq('agency_id', …)`, et chaque écriture passe par une
// fonction de base qui revérifie l'agence et signe MEGGA AI (`wa_matching_consigner`, `wa_matching_visite`,
// migration `…_matching_whatsapp.sql`). ⛔ Aucune n'écrit à l'acheteur (`tests/unit/matching-sans-sortie.spec.ts`).

import type { ActionCtx } from './whatsapp-actions.ts'
import { touchHotContact } from './contact-memory.ts'
import {
  COLONNES_MATCH, COLONNES_MANDAT, COLONNES_ANNONCE, STATUTS_COMPATIBLES, STATUTS_EN_COURS, bienDeMandat, bienDAnnonce,
  candidats, motsDe, vueAcheteurs, vueCandidats, vueGetMatches,
  type BienWa, type Criteres, type Designable, type EntreeMatch, type LigneAcheteur, type LigneAnnonce, type LigneMandat, type LigneMatch,
} from './whatsapp-matching.ts'

type Args = Record<string, unknown>
const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SANS_AGENCE = 'Erreur: ton compte n’est rattaché à aucune agence. Contacte un administrateur.'
const LECTURE_IMPOSSIBLE = 'Erreur: lecture du CRM momentanément impossible, réessaie dans un instant.'
const CONTACT_ID_INVALIDE = 'Erreur: contact_id requis (l’id vient de search_contacts).'
const CONTACT_INTROUVABLE = 'Erreur: contact introuvable dans votre agence.'
const aUneAgence = (ctx: ActionCtx): boolean => typeof ctx.agencyId === 'string' && ctx.agencyId.length > 0

/**
 * Un contact de l'agence (garde SQL). Trois issues distinctes, jamais confondues : `format` (l'identifiant n'est même
 * pas un UUID — aucune requête envoyée), `erreur` (la lecture a échoué : une panne, pas une absence) et `absent`
 * (lecture réussie, aucune ligne — mauvaise agence ou id inexistant). Pose le « contact chaud » de l'agent, comme
 * `contactInAgency`, uniquement quand la fiche résout.
 */
async function contactDeLAgence(
  ctx: ActionCtx, id: string,
): Promise<{ ok: true; id: string; nom: string } | { ok: false; motif: 'format' | 'erreur' | 'absent' }> {
  // Un nom passé en guise d'identifiant ne désigne aucune fiche ; Postgres le rejetterait en 22P02.
  if (!UUID.test(id)) return { ok: false, motif: 'format' }
  const { data, error } = await ctx.supabase
    .from('contacts').select('id, first_name, last_name').eq('id', id).eq('agency_id', ctx.agencyId).maybeSingle()
  if (error) return { ok: false, motif: 'erreur' }
  if (!data) return { ok: false, motif: 'absent' }
  const c = data as { id: string; first_name: string | null; last_name: string | null }
  touchHotContact(ctx.supabase, ctx.profileId, ctx.agencyId, c.id)
  return { ok: true, id: c.id, nom: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'ce contact' }
}

const idBien = (m: Pick<LigneMatch, 'property_id' | 'market_listing_id'>): string => m.property_id ?? m.market_listing_id ?? ''

/**
 * Les biens de ces matchs : les mandats de l'agence — un mandat supprimé n'a pas de ligne, sa ligne de match tombe —
 * et les annonces du marché. `null` : une lecture a échoué.
 */
async function lireBiens(ctx: ActionCtx, lignes: readonly Pick<LigneMatch, 'property_id' | 'market_listing_id'>[]): Promise<Map<string, BienWa> | null> {
  const mandats = [...new Set(lignes.map((l) => l.property_id).filter((x): x is string => !!x))]
  const annonces = [...new Set(lignes.map((l) => l.market_listing_id).filter((x): x is string => !!x))]
  const [m, a] = await Promise.all([
    mandats.length
      ? ctx.supabase.from('properties').select(COLONNES_MANDAT).in('id', mandats).eq('agency_id', ctx.agencyId).is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
    annonces.length
      ? ctx.supabase.from('market_listings').select(COLONNES_ANNONCE).in('id', annonces)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (m.error || a.error) return null
  const biens = new Map<string, BienWa>()
  for (const l of (m.data ?? []) as LigneMandat[]) biens.set(l.id, bienDeMandat(l))
  for (const l of (a.data ?? []) as LigneAnnonce[]) biens.set(l.id, bienDAnnonce(l))
  return biens
}

/** Les critères des recherches qui ont produit ces matchs — ceux de la RECHERCHE, jamais ceux de la fiche, comme
 *  « Sa boucle » (`saBoucle.ts`, `versMatch` : résolus par `client_search_id`, pas par la recherche active du contact). */
async function lireCriteres(ctx: ActionCtx, lignes: readonly Pick<LigneMatch, 'client_search_id'>[]): Promise<Map<string, Criteres | null> | null> {
  const ids = [...new Set(lignes.map((l) => l.client_search_id).filter((x): x is string => !!x))]
  if (!ids.length) return new Map()
  const { data, error } = await ctx.supabase.from('client_searches').select('id, criteria').in('id', ids).eq('agency_id', ctx.agencyId)
  if (error) return null
  return new Map(((data ?? []) as { id: string; criteria: Criteres | null }[]).map((r) => [r.id, r.criteria]))
}

// ── get_matches ─────────────────────────────────────────────────────────────

/** Les limites des lectures : bornées, jamais « tout pour en garder huit » (CLAUDE.md §7). Chacune se lit à LIMITE+1
 *  (comme `useSelectionMarche.ts`) : la ligne surnuméraire ne sert qu'à dire si la coupe a mordu — jamais
 *  `longueur >= limite`, qui confondrait « il y en a exactement N » et « la lecture s'est arrêtée à N ». */
const LIMITE_EN_COURS = 30
const LIMITE_A_PROPOSER = 40
const LIMITE_REVENUS = 10

/** `STATUTS_EN_COURS` (whatsapp-matching.ts) coupé en ses deux groupes de lecture : « proposé » (`sent`) à part
 *  d'« intéressé »/« visite », que la vue classe AVANT lui (`RANG_EN_COURS`) — un tri SQL unique par `sent_at` les
 *  ferait passer après trente propositions plus récentes. Dérivé de la liste canonique, jamais recopié en dur : un
 *  statut « en cours » de plus y entrerait automatiquement au bon groupe (tout sauf `sent`).
 */
const STATUT_PROPOSE = 'sent'
const STATUTS_PRIORITAIRES = STATUTS_EN_COURS.filter((st) => st !== STATUT_PROPOSE)

/** `bruts.length > limite` (jamais `>=`) : la ligne LIMITE+1 est justement celle qui manque pour trancher. Rend les
 *  lignes à garder (recoupées à `limite`) et si la lecture a mordu. */
function aLaLimite<T>(bruts: readonly T[] | null | undefined, limite: number): { lignes: T[]; mord: boolean } {
  const b = bruts ?? []
  return { lignes: b.slice(0, limite), mord: b.length > limite }
}

/**
 * Dédoublonne par id, la PREMIÈRE occurrence gagnant — comme `construireSaBoucle` (`saBoucle.ts`) fusionne ses deux
 * lectures parallèles. Ferme aussi la course entre lectures parallèles : un match dont le statut change entre deux
 * requêtes ne doit compter qu'une fois, avec la version que la lecture PRIORITAIRE en a vue.
 */
function dedoublonner(groupes: readonly (readonly LigneMatch[])[]): LigneMatch[] {
  const vus = new Set<string>()
  const sortie: LigneMatch[] = []
  for (const groupe of groupes) {
    for (const l of groupe) {
      if (vus.has(l.id)) continue
      vus.add(l.id)
      sortie.push(l)
    }
  }
  return sortie
}

/**
 * « Quels biens pour Julie ? » — ses biens VIVANTS : en cours d'abord, puis les meilleurs à proposer, chacun avec son
 * état, son score expliqué et son signal (conception §5.1). Partagé avec le copilote web (`ai-copilot`).
 */
export async function execGetMatches(ctx: ActionCtx, a: Args): Promise<string> {
  if (!aUneAgence(ctx)) return SANS_AGENCE
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  const c = await contactDeLAgence(ctx, contactId)
  if (!c.ok) {
    // Une ERREUR de lecture n'est pas une absence : la confondre ferait annoncer « ce contact n'existe pas » sur une
    // simple panne transitoire (statement timeout…), qui se rejoue.
    if (c.motif === 'format') return CONTACT_ID_INVALIDE
    if (c.motif === 'erreur') return LECTURE_IMPOSSIBLE
    return CONTACT_INTROUVABLE
  }
  const base = () => ctx.supabase.from('matches').select(COLONNES_MATCH).eq('agency_id', ctx.agencyId).eq('contact_id', contactId)
  const [enCoursPrioritaire, enCoursPropose, aProposerBrut, revenusBrut] = await Promise.all([
    base().in('status', STATUTS_PRIORITAIRES).order('sent_at', { ascending: false, nullsFirst: false }).order('id').limit(LIMITE_EN_COURS + 1),
    base().eq('status', STATUT_PROPOSE).order('sent_at', { ascending: false, nullsFirst: false }).order('id').limit(LIMITE_EN_COURS + 1),
    // Trié comme le fil (score, puis création la plus récente, puis id — le comparateur `avant` de `construireFil`)
    // et `useSelectionMarche` : sans quoi la coupe à LIMITE_A_PROPOSER ne garderait pas les biens que `vueGetMatches`
    // placerait en tête. ⚠ PAS l'ordre de « Sa boucle » (`saBoucle.ts`), qui trie par `sent_at` — une vue différente.
    base().eq('status', 'suggested').order('score', { ascending: false }).order('created_at', { ascending: false, nullsFirst: false }).order('id').limit(LIMITE_A_PROPOSER + 1),
    // Un bien REVENU (refusé pour le prix, puis rebaissé) garde le `created_at` de sa proposition D'ORIGINE : à score
    // égal, la coupe ci-dessus le classe par ancienneté et peut le perdre avant que `vueGetMatches` ne le remette en
    // tête (signal d'abord). Lu à part, comme la DEUXIÈME lecture de « Sa boucle » (`useContactSentMatches.ts`, qui
    // n'en fait que deux, la boucle et les revenus).
    // ⚠ Angle mort qui RESTE, partagé avec la sélection du CRM (`useSelectionMarche.ts`) : une annonce en BAISSE sur
    // un match ancien jamais proposé (donc pas un « revenu » — `prix_propose` nul) n'a pas de lecture dédiée, et peut
    // rester hors de la coupe « à proposer » comme elle resterait hors de cette sélection.
    base().eq('status', 'suggested').gt('prix_propose', 0).order('sent_at', { ascending: false, nullsFirst: false }).order('id').limit(LIMITE_REVENUS + 1),
  ])
  if (enCoursPrioritaire.error || enCoursPropose.error || aProposerBrut.error || revenusBrut.error) return LECTURE_IMPOSSIBLE
  const prioritaire = aLaLimite(enCoursPrioritaire.data as LigneMatch[] | null, LIMITE_EN_COURS)
  const propose = aLaLimite(enCoursPropose.data as LigneMatch[] | null, LIMITE_EN_COURS)
  const aProposer = aLaLimite(aProposerBrut.data as LigneMatch[] | null, LIMITE_A_PROPOSER)
  const revenus = aLaLimite(revenusBrut.data as LigneMatch[] | null, LIMITE_REVENUS)
  const enCoursALaLimite = prioritaire.mord || propose.mord
  // ⛔ PAS `|| revenus.mord` : les revenus sont un SOUS-ENSEMBLE des matchs
  // « suggested » que la lecture ci-dessus a DÉJÀ tous vus dès lors qu'elle-même n'a pas mordu — sa propre limite,
  // bien plus basse (LIMITE_REVENUS), peut mordre alors que le total réel est déjà exact et connu en entier :
  // onze revenus sur onze matchs à proposer rendraient « 11+ » au lieu de « 11 ».
  const aProposerALaLimite = aProposer.mord
  // Prioritaire (intéressé/visite), puis proposé, puis à proposer, puis revenus : l'ordre où `vueGetMatches`
  // classerait un même id s'il apparaissait dans deux groupes (une course entre lectures parallèles, ou un revenu
  // déjà présent dans le top « à proposer »).
  const lignes = dedoublonner([prioritaire.lignes, propose.lignes, aProposer.lignes, revenus.lignes])
  if (!lignes.length) {
    // Deux causes, jamais une seule à annoncer : le matching n'a peut-être pas encore tourné, OU il a tourné et tout
    // ce qu'il a proposé a déjà été refusé ou écarté — l'agent ne doit pas lire « rien n'a jamais existé pour lui ».
    return JSON.stringify({
      contact: c.nom, biens: [],
      note: 'Aucun bien vivant pour ce contact : sa recherche n’a peut-être pas encore tourné, ou tout ce qui a été proposé a déjà été refusé ou écarté.',
    })
  }
  const [biens, criteres] = await Promise.all([lireBiens(ctx, lignes), lireCriteres(ctx, lignes)])
  if (!biens || !criteres) return LECTURE_IMPOSSIBLE
  const entrees: EntreeMatch[] = lignes.flatMap((m) => {
    const bien = biens.get(idBien(m))
    return bien ? [{ match: m, bien, criteres: m.client_search_id ? criteres.get(m.client_search_id) ?? null : null }] : []
  })
  return JSON.stringify({ contact: c.nom, ...vueGetMatches(entrees, Date.now(), aProposerALaLimite, enCoursALaLimite) })
}

// ── get_buyers_for_property ─────────────────────────────────────────────────

/**
 * Le plafond d'une recherche par TEXTE : bien au-delà de ce qu'un agent tape (un nom, une adresse, une ville), et
 * bien en dessous du plafond de `wa_matching_biens_designes` elle-même (200) et de celui de PostgREST (1 000,
 * `supabase/config.toml:18`).
 */
const LIMITE_DESIGNES = 50
/** Les compatibles d'un bien, lus d'un bloc — comme `useQuiPourCeBien` (le CRM), qui borne pareillement à 200. */
const LIMITE_COMPATIBLES = 200

const decouper = <T>(xs: readonly T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

/** Une ligne de `wa_matching_biens_designes` : un `Designable` (whatsapp-matching.ts), plus son genre. */
interface LigneDesignee extends Designable { genre: 'mandat' | 'annonce' }

/**
 * Ce que `designerBien` rend : `biens` — jusqu'à 5 biens PLEINEMENT résolus (un seul si `total === 1`) — et `total`,
 * le nombre RÉEL de candidats affinés, qui peut dépasser 5 (`vueCandidats` s'en sert pour dire « 5 sur N »). `coupe` :
 * la lecture en BASE (LIMITE_DESIGNES+1) a mordu — `total` n'est alors qu'un plancher.
 */
interface Designation { biens: BienWa[]; total: number; coupe: boolean }

/**
 * Le bien qu'un texte — ou un identifiant — désigne. Par IDENTIFIANT : le mandat de l'agence d'abord, l'annonce
 * SEULEMENT s'il est absent — une panne sur les annonces ne fait pas échouer une réponse que le mandat, lui, a déjà
 * résolue. Par TEXTE : EN BASE, par `wa_matching_biens_designes` (migration
 * `…_matching_whatsapp.sql`, §5) — les mandats de l'agence ET les annonces qu'un match compatible y suit, ENSEMBLE,
 * jamais l'un puis l'autre à défaut (un mandat ne masque jamais SEUL une annonce qui répond aussi — conception
 * §3, principe 5 : le copilote ne devine pas). Lus à LIMITE+1, recoupés par `aLaLimite`, affinés par `candidats`
 * (pur) ; seuls les 5 premiers affinés sont relus en colonnes complètes. `null` : une lecture a échoué.
 */
async function designerBien(ctx: ActionCtx, texte: string): Promise<Designation | null> {
  if (UUID.test(texte)) {
    const m = await ctx.supabase
      .from('properties').select(COLONNES_MANDAT).eq('id', texte).eq('agency_id', ctx.agencyId).is('deleted_at', null).maybeSingle()
    if (m.error) return null
    if (m.data) return { biens: [bienDeMandat(m.data as LigneMandat)], total: 1, coupe: false }
    const a = await ctx.supabase.from('market_listings').select(COLONNES_ANNONCE).eq('id', texte).maybeSingle()
    if (a.error) return null
    return a.data
      ? { biens: [bienDAnnonce(a.data as LigneAnnonce)], total: 1, coupe: false }
      : { biens: [], total: 0, coupe: false }
  }
  const mots = motsDe(texte)
  // Aucun mot utile (un « le », un « à » seuls) : aucun bien, comme `candidats` — sans appeler la base pour rien.
  if (!mots.length) return { biens: [], total: 0, coupe: false }
  const { data, error } = await ctx.supabase.rpc('wa_matching_biens_designes', {
    p_agency: ctx.agencyId, p_mots: mots, p_limite: LIMITE_DESIGNES + 1,
  })
  if (error) return null
  const { lignes, mord } = aLaLimite(data as LigneDesignee[] | null, LIMITE_DESIGNES)
  const affines = candidats(lignes, texte)
  if (!affines.length) return { biens: [], total: 0, coupe: mord }
  const tete = affines.slice(0, 5)
  const idsMandats = tete.filter((b) => b.genre === 'mandat').map((b) => b.id)
  const idsAnnonces = tete.filter((b) => b.genre === 'annonce').map((b) => b.id)
  const [m, a] = await Promise.all([
    idsMandats.length
      ? ctx.supabase.from('properties').select(COLONNES_MANDAT).in('id', idsMandats).eq('agency_id', ctx.agencyId).is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
    idsAnnonces.length
      ? ctx.supabase.from('market_listings').select(COLONNES_ANNONCE).in('id', idsAnnonces)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (m.error || a.error) return null
  const parId = new Map<string, BienWa>()
  for (const l of (m.data ?? []) as LigneMandat[]) parId.set(l.id, bienDeMandat(l))
  for (const l of (a.data ?? []) as LigneAnnonce[]) parId.set(l.id, bienDAnnonce(l))
  // L'ordre de `tete` (celui que la base a déjà rendu : mandats, puis id) — jamais celui des deux lectures
  // ci-dessus, séparées par genre et donc muettes sur l'ordre d'origine.
  const biens = tete.flatMap((b) => { const v = parId.get(b.id); return v ? [v] : [] })
  return { biens, total: affines.length, coupe: mord }
}

/** « Qui pour la villa de Cologny ? » — les acquéreurs compatibles d'un bien (conception §5.2). */
export async function execGetBuyersForProperty(ctx: ActionCtx, a: Args): Promise<string> {
  if (!aUneAgence(ctx)) return SANS_AGENCE
  const texte = s(a.bien)
  if (!texte) return 'Erreur: quel bien ? Son nom, son adresse ou sa ville — ou son identifiant, via get_matches.'
  const designation = await designerBien(ctx, texte)
  if (designation === null) return LECTURE_IMPOSSIBLE
  const { biens, total, coupe } = designation
  if (total === 0) {
    // La lecture en base a mordu et l'affinage n'a rien gardé parmi ce qu'elle a pu voir : un bien plus loin dans
    // l'ordre aurait peut-être matché — « introuvable » l'affirmerait à tort. Jamais le cas par identifiant, qui ne
    // balaie rien (`coupe` y est toujours `false`).
    if (coupe) return 'Erreur: la recherche est trop large pour être tranchée. Précise l’adresse, ou donne l’identifiant du bien (via get_matches).'
    return JSON.stringify({ introuvable: true, note: `Aucun mandat de l’agence ni aucune annonce suivie ne correspond à « ${texte} ».` })
  }
  if (total > 1 || coupe) {
    // Une lecture coupée ne rend jamais un bien comme LE bien : le sur-ensemble en base est trié par genre puis id,
    // sans rapport avec la pertinence du texte — celui qui survit seul à l'affinage n'est pas forcément le seul qui
    // aurait matché au-delà de la coupe. Une coupe demande donc TOUJOURS, même si l'affinage n'en garde qu'un.
    const question = coupe
      ? 'La recherche est trop large pour être sûre qu’il n’y en a qu’un : demande à l’agent de préciser (adresse ou identifiant), sans choisir.'
      : 'Plusieurs biens correspondent : demande à l’agent lequel, sans choisir.'
    return JSON.stringify({ ...vueCandidats(biens, total, coupe), question })
  }
  const bien = biens[0]
  if (!bien) return LECTURE_IMPOSSIBLE
  const { data, error } = await ctx.supabase
    .from('matches').select('id, contact_id, status, score, snoozed_until, sent_at, reaction_motif, prix_propose')
    .eq('agency_id', ctx.agencyId).eq(bien.genre === 'mandat' ? 'property_id' : 'market_listing_id', bien.id)
    .in('status', [...STATUTS_COMPATIBLES]).order('score', { ascending: false }).order('id').limit(LIMITE_COMPATIBLES + 1)
  if (error) return LECTURE_IMPOSSIBLE
  // Lu à LIMITE+1, recoupé par `aLaLimite` : la ligne surnuméraire dit si le total est exact — jamais
  // `lignes.length >= limite`, qui confondrait « exactement N » et « la lecture s'est arrêtée à N ».
  const { lignes, mord } = aLaLimite(data as Omit<LigneAcheteur, 'nom'>[] | null, LIMITE_COMPATIBLES)
  // Les fiches de TOUS les compatibles (200 au plus), en deux lots de 100 comme le CRM : ceux que le SQL rend en
  // premier et ceux que `vueAcheteurs` affiche n'ont pas besoin de coïncider.
  const idsContacts = [...new Set(lignes.map((l) => l.contact_id))]
  const lots = idsContacts.length
    ? await Promise.all(decouper(idsContacts, 100).map((lot) =>
        ctx.supabase.from('contacts').select('id, first_name, last_name').in('id', lot).eq('agency_id', ctx.agencyId)))
    : []
  if (lots.some((r) => r.error)) return LECTURE_IMPOSSIBLE
  const noms = new Map(lots.flatMap((r) => (r.data ?? []) as { id: string; first_name: string | null; last_name: string | null }[])
    .map((c) => [c.id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || '—']))
  // Une ligne SANS fiche résolue (hors agence, id disparu) est écartée AVANT de compter — comme `versCompatible`
  // (filQuiPour.ts) : le total s'aligne ainsi sur ce que montre la fiche du CRM, jamais sur une ligne fantôme.
  const acheteurs: LigneAcheteur[] = lignes.flatMap((l) => {
    const nom = noms.get(l.contact_id)
    return nom ? [{ ...l, nom }] : []
  })
  return JSON.stringify(vueAcheteurs(bien, acheteurs, Date.now(), mord))
}
