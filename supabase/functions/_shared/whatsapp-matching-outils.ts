// Les outils du matching dans le copilote WhatsApp (lot D2, étape 4b) : leurs lectures et leurs écritures, par le
// client service-role de l'agent. Toute la logique vit dans `whatsapp-matching.ts` (pur, testé) ; ici, les requêtes.
//
// Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md (§5).
//
// SÉCURITÉ. Le client contourne la RLS : chaque lecture porte `.eq('agency_id', …)` — ou, pour une désignation en
// base, `p_agency` —, et chaque écriture passe par une fonction de base qui revérifie l'agence et signe MEGGA AI
// (`wa_matching_consigner`, `wa_matching_visite`, migration `…_matching_whatsapp.sql`). ⛔ Aucune n'écrit à
// l'acheteur (`tests/unit/matching-sans-sortie.spec.ts`).

import type { ActionCtx, Prepared } from './whatsapp-actions.ts'
import { touchHotContact } from './contact-memory.ts'
import {
  confirmConsigner, consigne, consignationChangee, consignationDeja, consignationImpossible, consignationEchec,
  consignerMotifManquant, consignerAucunBien, consignerEchoTropLarge, consignerPlusieursBiens, consignerQuelAcheteur,
  consignerQuelleReponse, consignerTropDeBiens, consignerTropLarge, consignerAnnonceRetiree, type Consignation,
} from './whatsapp-i18n.ts'
import {
  COLONNES_MATCH, COLONNES_MANDAT, COLONNES_ANNONCE, LIMITE_ECHO, STATUTS_COMPATIBLES, STATUTS_EN_COURS, STATUTS_DE_DEPART, STATUT_D_ARRIVEE,
  bienDeMandat, bienDAnnonce, candidats, estEcho, estMotif, estReponse, libelleBien, motsDe, vueAcheteurs, vueCandidats, vueGetMatches,
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
  // Le repli suit la langue : il entre tel quel dans la question [Oui] [Non] et le compte rendu, rendus verbatim.
  const repli = ctx.lang === 'en' ? 'this contact' : 'ce contact'
  return { ok: true, id: c.id, nom: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || repli }
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
function dedoublonner<T extends { id: string }>(groupes: readonly (readonly T[])[]): T[] {
  const vus = new Set<string>()
  const sortie: T[] = []
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
 * Le plafond d'une désignation par TEXTE (`wa_matching_biens_designes`, `wa_matching_biens_de_l_acheteur`) : bien
 * au-delà de ce qu'un texte précis désigne (un nom, une adresse, une ville), et bien en dessous du plafond des deux
 * fonctions elles-mêmes (200 et 201) et de celui de PostgREST (1 000, `supabase/config.toml:18`).
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
 * résolue. Par TEXTE : EN BASE, sur l'agence entière (`wa_matching_biens_designes`) — les mandats de l'agence ET les
 * annonces qu'un match compatible y suit, ENSEMBLE, jamais l'un puis l'autre à défaut (un mandat ne masque jamais
 * SEUL une annonce qui répond aussi — conception §3, principe 5 : le copilote ne devine pas) —, lue à
 * LIMITE_DESIGNES+1, recoupée par `aLaLimite` et affinée par `candidats`. Aucun mot utile (un « le », un « à »
 * seuls) : aucun bien, sans appeler la base. Seuls les 5 premiers affinés sont relus en colonnes complètes. `null` :
 * une lecture a échoué.
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

// ── record_match_outcome (question Oui / Non) ───────────────────────────────

/** Un bien que la réponse peut viser, avec le match qui l'y relie : ce que la question nomme, ce que la charge fige. */
type Option = BienWa & { matchId: string }
/** Ce qu'il faut lire d'un match pour en nommer le bien — ni `reasons` ni le reste de `COLONNES_MATCH`. */
type MatchDeBien = Pick<LigneMatch, 'id' | 'property_id' | 'market_listing_id'>
const COLONNES_MATCH_DE_BIEN = 'id, property_id, market_listing_id'

/**
 * La page des matchs d'un acheteur au statut de départ, lue à LIMITE+1 comme les autres lectures. Mesuré en
 * production le 25.09.2026 (lecture seule) : 4 acheteurs de l'agence WhatsApp ont des matchs `suggested`, 3 en ont
 * plus de 100, jusqu'à 1 142. Une page coupée prouve donc qu'il y en a plusieurs ; elle ne désigne jamais un bien, et
 * elle ne prouve pas qu'un bien nommé est absent — c'est `wa_matching_biens_de_l_acheteur` qui cherche un texte.
 */
const LIMITE_DEPART = 100

/** Une note de refus : 300 points de code au plus — couper en unités UTF-16 laisserait la moitié d'un émoji. */
const NOTE_MAX = 300

/**
 * Les biens de ces matchs (`lireBiens`), chacun avec l'id de son match, dans l'ordre des matchs. Le bien d'un match
 * est son mandat d'abord (`idBien`) ; un match dont le bien ne se lit pas (mandat supprimé ou hors agence) n'en
 * donne aucun. `null` : la lecture des biens a échoué.
 */
async function optionsAvecMatchId(ctx: ActionCtx, lignes: readonly MatchDeBien[]): Promise<Option[] | null> {
  const biens = await lireBiens(ctx, lignes)
  if (!biens) return null
  return lignes.flatMap((m) => { const b = biens.get(idBien(m)); return b ? [{ ...b, matchId: m.id }] : [] })
}

/**
 * Les matchs de l'acheteur, au statut de départ, restreints à des ids de biens — une lecture par genre
 * (`property_id`, `market_listing_id`), l'une sautée si sa liste est vide. Exacte : un bien désigné par son
 * identifiant se retrouve sans balayer les autres matchs de l'acheteur. Un match que les deux lectures rendent ne
 * compte qu'une fois. `null` : une lecture a échoué.
 */
async function matchsParIds(
  ctx: ActionCtx, contactId: string, statuts: readonly string[], idsMandats: readonly string[], idsAnnonces: readonly string[],
): Promise<MatchDeBien[] | null> {
  const base = () =>
    ctx.supabase.from('matches').select(COLONNES_MATCH_DE_BIEN).eq('agency_id', ctx.agencyId).eq('contact_id', contactId).in('status', [...statuts])
  const [m, a] = await Promise.all([
    idsMandats.length ? base().in('property_id', [...idsMandats]) : Promise.resolve({ data: [], error: null }),
    idsAnnonces.length ? base().in('market_listing_id', [...idsAnnonces]) : Promise.resolve({ data: [], error: null }),
  ])
  if (m.error || a.error) return null
  return dedoublonner([(m.data ?? []) as MatchDeBien[], (a.data ?? []) as MatchDeBien[]])
}

/**
 * La page des biens que l'acheteur a au statut de départ : le meilleur score d'abord, puis l'id — lue à
 * LIMITE_DEPART+1, recoupée par `aLaLimite`. Elle sert quand le texte ne dit rien du bien, et pour nommer ce que
 * l'agent peut viser quand le texte n'a rien désigné. `plancher` : coupée, le nombre de lignes qu'elle garde — ce que
 * l'acheteur a AU MOINS, que les refus disent (« 2 sur plus de 100 ») ; `null`, complète. `null` : une lecture a
 * échoué.
 */
async function lirePage(
  ctx: ActionCtx, contactId: string, statuts: readonly string[],
): Promise<{ options: Option[]; plancher: number | null } | null> {
  const { data, error } = await ctx.supabase
    .from('matches').select(COLONNES_MATCH_DE_BIEN).eq('agency_id', ctx.agencyId).eq('contact_id', contactId)
    .in('status', [...statuts]).order('score', { ascending: false }).order('id').limit(LIMITE_DEPART + 1)
  if (error) return null
  const { lignes, mord } = aLaLimite(data as MatchDeBien[] | null, LIMITE_DEPART)
  const options = await optionsAvecMatchId(ctx, lignes)
  return options ? { options, plancher: mord ? lignes.length : null } : null
}

/** Une ligne de `wa_matching_biens_de_l_acheteur` : un bien de l'acheteur (son mandat d'abord), et son match. */
interface LigneDeLAcheteur extends LigneDesignee { match_id: string }

/**
 * Ce que « propose » peut viser. Une annonce RETIRÉE ne se propose plus — le fil n'en offre aucune à proposer
 * (`FilSelectionResume`, filModele.ts), et `NOTE_MODELE` le dit au modèle : la consigner créerait un deal et une
 * relance sur un bien parti. Un mandat garde sa place quel que soit son statut, comme dans le fil : la règle
 * `occasion` des mandats attend la décision 12 du lot D1 (Julien).
 */
const proposable = (b: BienWa): boolean => !(b.genre === 'annonce' && b.retire)

const libelles = (biens: readonly Option[]): string[] => biens.map((b) => libelleBien(b))

/**
 * Prépare la consignation : l'acheteur de l'agence, puis le bien, cherché parmi SES matchs au statut que la réponse
 * suppose (`STATUTS_DE_DEPART`). Aucun, ou plusieurs : un refus qui les nomme, rendu au modèle — il demande, rien
 * n'est stocké, donc aucun bouton. Un seul : la question [Oui] [Non] et la charge figée.
 *
 * ⛔ Un refus est une phrase pour l'AGENT, sans identifiant : `whatsapp-agent` le rend une fois au modèle, puis TEL
 * QUEL à l'agent au second refus du même échange, et la mémoire du tour suivant ne garde que les messages WhatsApp
 * (relu le 25.09.2026). C'est le libellé qu'il nomme (« titre · adresse ») que le modèle redonne ensuite, et que
 * `candidats` retrouve à l'égalité exacte.
 *
 * Le texte choisit la lecture : un IDENTIFIANT se revérifie exactement (`matchsParIds`) ; des MOTS se désignent en
 * base parmi les seuls biens de l'acheteur (`wa_matching_biens_de_l_acheteur`), puis `candidats` affine — un écho
 * coupé se relit jusqu'à LIMITE_ECHO, et une désignation qui reste coupée ne rend ni un bien seul, ni « aucun » ; SANS
 * mot utile (aucun texte, « le bien »), la page de ses matchs, où un seul bien se désigne de lui-même (« Julie est
 * intéressée » quand un seul l'attend) et où une page coupée n'en désigne aucun.
 */
export async function prepareRecordMatchOutcome(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!aUneAgence(ctx)) return { ok: false, error: SANS_AGENCE }
  const lang = ctx.lang ?? 'fr'
  const reponse = estReponse(a.reponse) ? a.reponse : null
  if (!reponse) return { ok: false, error: consignerQuelleReponse(lang) }
  const motif = reponse === 'pas_interesse' ? (estMotif(a.motif) ? a.motif : null) : null
  if (reponse === 'pas_interesse' && !motif) return { ok: false, error: consignerMotifManquant(lang) }
  const contactId = s(a.contact_id)
  // Le même message quelle que soit la cause d'un contact non résolu (aucun identifiant, mal formé, absent) — sauf
  // une PANNE de lecture (`erreur`), qui n'est pas une absence et redemanderait à tort un acheteur qui existe.
  const contact = contactId ? await contactDeLAgence(ctx, contactId) : null
  if (!contact) return { ok: false, error: consignerQuelAcheteur(lang) }
  if (!contact.ok) return { ok: false, error: contact.motif === 'erreur' ? LECTURE_IMPOSSIBLE : consignerQuelAcheteur(lang) }

  const nom = contact.nom
  const statuts = STATUTS_DE_DEPART[reponse]
  const echec: Prepared = { ok: false, error: consignationEchec(lang) }
  const aViser = (biens: readonly Option[]): Option[] => (reponse === 'propose' ? biens.filter(proposable) : [...biens])
  const question = (choisi: Option): Prepared => {
    const brute = reponse === 'pas_interesse' ? s(a.note) : null
    const note = brute ? Array.from(brute).slice(0, NOTE_MAX).join('') : null
    // « titre · adresse » (ou ville) : deux annonces au même titre restent distinguables dans la question comme dans
    // le compte rendu — un titre seul laisserait l'agent confirmer le mauvais bien sans le voir.
    const bien = libelleBien(choisi)
    const c: Consignation = { reponse, nom, bien, motif, note }
    return { ok: true, prompt: confirmConsigner(lang, c), payload: { match_id: choisi.matchId, reponse, motif, note, nom, bien } }
  }

  const texte = s(a.bien)
  const mots = texte ? motsDe(texte) : []
  let trouves: Option[]
  if (texte && UUID.test(texte)) {
    const lignes = await matchsParIds(ctx, contact.id, statuts, [texte], [texte])
    const options = lignes ? await optionsAvecMatchId(ctx, lignes) : null
    if (!options) return echec
    trouves = options
  } else if (texte && mots.length) {
    const designer = async (limite: number) => {
      const { data, error } = await ctx.supabase.rpc('wa_matching_biens_de_l_acheteur', {
        p_agency: ctx.agencyId, p_contact: contact.id, p_statuts: [...statuts], p_mots: mots, p_limite: limite + 1,
      })
      return error ? null : aLaLimite(data as LigneDeLAcheteur[] | null, limite)
    }
    const echo = estEcho(texte)
    let lecture = await designer(LIMITE_DESIGNES)
    if (lecture?.mord && echo) lecture = await designer(LIMITE_ECHO)
    if (!lecture) return echec
    // Coupée, la désignation ne tranche rien : au-delà de ce qu'elle a rendu, un autre bien de l'acheteur répondait
    // peut-être aussi. Un écho ne se fait pas redemander l'adresse : c'est le CRM qui tranche.
    if (lecture.mord) return { ok: false, error: echo ? consignerEchoTropLarge(lang, nom, texte) : consignerTropLarge(lang, nom, texte) }
    const options = await optionsAvecMatchId(ctx, candidats(lecture.lignes, texte).map((l) => ({
      id: l.match_id, property_id: l.genre === 'mandat' ? l.id : null, market_listing_id: l.genre === 'annonce' ? l.id : null,
    })))
    if (!options) return echec
    trouves = options
  } else {
    const page = await lirePage(ctx, contact.id, statuts)
    if (!page) return echec
    const vises = aViser(page.options)
    // Complète, la page dit tout : n'y voir que des annonces retirées, c'est le dire plutôt que « aucun bien ».
    if (page.plancher == null && !vises.length && page.options.length) {
      return { ok: false, error: consignerAnnonceRetiree(lang, libelles(page.options)) }
    }
    if (!vises.length) {
      // Coupée sans rien de nommable : ni « aucun bien » (il y en a plus d'une page), ni une liste vide.
      return { ok: false, error: page.plancher != null ? consignerTropDeBiens(lang, reponse, nom) : consignerAucunBien(lang, reponse, nom, []) }
    }
    if (page.plancher != null || vises.length > 1) {
      return { ok: false, error: consignerPlusieursBiens(lang, nom, libelles(vises), page.plancher) }
    }
    return question(vises[0])
  }

  const vises = aViser(trouves)
  if (!vises.length && trouves.length) return { ok: false, error: consignerAnnonceRetiree(lang, libelles(trouves)) }
  if (vises.length > 1) return { ok: false, error: consignerPlusieursBiens(lang, nom, libelles(vises)) }
  if (!vises.length) {
    // Le texte n'a rien désigné parmi TOUS les biens de l'acheteur : la page dit ce qu'il a, pour que l'agent choisisse.
    const page = await lirePage(ctx, contact.id, statuts)
    if (!page) return echec
    const vus = aViser(page.options)
    return { ok: false, error: consignerAucunBien(lang, reponse, nom, libelles(vus), page.plancher) }
  }
  return question(vises[0])
}

/** Après le « oui » : écrit d'un bloc par `wa_matching_consigner`, qui revérifie le statut de départ. Une charge
 *  illisible (réponse inconnue, match absent) ne va jamais jusqu'à la base. */
export async function executeRecordMatchOutcome(ctx: ActionCtx, p: Args): Promise<string> {
  if (!aUneAgence(ctx)) return SANS_AGENCE
  const lang = ctx.lang ?? 'fr'
  const matchId = s(p.match_id)
  const reponse = estReponse(p.reponse) ? p.reponse : null
  if (!matchId || !reponse) return consignationEchec(lang)
  const c: Consignation = { reponse, nom: s(p.nom) ?? '—', bien: s(p.bien) ?? '—', motif: s(p.motif), note: s(p.note) }
  const { data, error } = await ctx.supabase.rpc('wa_matching_consigner', {
    p_agency: ctx.agencyId, p_profile: ctx.profileId, p_match: matchId, p_reponse: reponse, p_motif: c.motif ?? null, p_note: c.note ?? null,
  })
  if (error) {
    console.error('wa_matching_consigner failed:', (error.message ?? 'error').slice(0, 120))
    return consignationEchec(lang)
  }
  const r = (data ?? {}) as { ok?: boolean; deja?: boolean; statut?: string }
  if (!r.ok) return consignationImpossible(lang)
  // Rien n'a été écrit : le statut trouvé dit pourquoi. Celui que CETTE réponse écrit, c'est qu'elle l'était déjà ;
  // un autre, que le bien a bougé entre la question et le « oui » — et « pas encore », qui n'écrit aucun statut,
  // n'est jamais « déjà consigné ».
  if (r.deja) {
    return r.statut != null && r.statut === STATUT_D_ARRIVEE[reponse]
      ? consignationDeja(lang, c.nom, c.bien)
      : consignationChangee(lang, c.nom, c.bien)
  }
  return consigne(lang, c)
}
