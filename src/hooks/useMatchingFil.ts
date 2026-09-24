/**
 * Données du fil de matchs : « À proposer » sur les biens de l'agence (lot 1), une ligne « Marché » par
 * acheteur, résumée côté serveur par `matching_fil_marche_resume()` (lot 2), et la BOUCLE (lot B) — les matchs
 * proposés, répondus ou en visite, et les relances de proposition en cours.
 *
 * Conceptions : `docs/superpowers/specs/2026-09-17-matching-fil-design.md` §8 ;
 * `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md` §4 et §5.
 *
 * ⛔ DES LECTURES PLATES, AUCUNE JOINTURE EMBARQUÉE. L'atelier charge tous les matchs de l'agence
 * avec `properties(*)` et `market_listings(*)` — descriptions et galeries comprises, 1 628 lignes
 * en production le 17.09.2026 — contre le §7 de CLAUDE.md. Ici : les matchs `suggested` des biens
 * en mandat (10 en production), puis leurs contacts, leurs recherches, leurs biens (colonnes légères)
 * et le KYC, par `in`. Et le banc `/dev/crm` n'applique pas `select` : une jointure y rendrait des
 * lignes sans acheteur ni bien, et l'écran mentirait sur ce que la production affiche.
 *
 * ⛔ LES CRITÈRES VIENNENT DE LA RECHERCHE DU MATCH (`client_searches.criteria`, par
 * `matches.client_search_id`) — ce que le moteur a noté. `contacts.search_criteria` n'est qu'un
 * repli : mesuré le 17.09.2026, il est vide pour 3 acheteurs sur 4.
 *
 * ⚠ UNE RECHERCHE MODIFIÉE GARDE LES RAISONS DE L'ANCIENNE : `insert_internal_matches` ne re-note pas
 * une paire existante (`ON CONFLICT DO NOTHING`). Seule une correction d'« Apprendre » (lot B) renote les
 * matchs à proposer de SA recherche (`matching-engine`, mode `rescore-search`). Aucun signal fiable ne
 * permet d'écarter les autres ici — `client_searches.updated_at` bouge à CHAQUE enregistrement du contact
 * (trigger de synchro), et s'y fier effacerait les verdicts d'un acheteur dont on a corrigé la nationalité.
 *
 * ⚠ LA BOUCLE SE LIT EN ENTIER, sans pagination : ses statuts (`sent`, `interested`, `rejected`,
 * `visit_planned`) ne naissent que d'un geste de l'agent — aucun en production le 21.09.2026 —, servis par
 * `idx_matches_boucle`. Au-delà de 1 000 lignes, `max_rows` tronquerait en silence : à surveiller avant la
 * bascule (conception du fil, §13). Lue dans un ORDRE TOTAL, la plus récemment proposée d'abord : sans lui,
 * une troncature garderait n'importe quelles lignes, et pas les mêmes d'une lecture à l'autre.
 *
 * ⚠ Le filtre « bien en mandat » est posé DEUX fois : `not(property_id, is, null)` pour la base, et
 * côté client pour le banc, qui ne connaît pas l'opérateur `not`.
 *
 * ⚠ `chargeLe` est l'heure du DÉBUT des lectures, pas de leur fin : le fil la compare à l'heure où un
 * geste a fini d'écrire pour savoir si ces données le reflètent déjà. Prise à la fin, une lecture
 * partie avant l'écriture passerait pour postérieure.
 */
import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { mapKycStatus } from '@/lib/crmAdapters'
import {
  refAnnonceMarche, refBienInterne, STATUTS_RELANCE_OUVERTE, type AcheteurGeste, type BienGeste,
} from '@/hooks/useAtelierMatching'
import type { SearchCriteria } from '@/types/contact'
import type { KycDossierStatus } from '@/types/kyc'
import {
  CLE_FIL, compterHistorique, lire, listeEquipements, nombreOuNull, photoAnnonce, type FilBien, type FilMatch,
  type FilSelectionResume, type Historique, type RaisonsMoteur, type SuiviMatch,
} from '@/components/matching-fil/filModele'
import type { RelanceProposition } from '@/components/matching-fil/filBoucle'

// Le préfixe des clés du fil et `lire` vivent dans le module pur (`filModele`) : ré-exportés ici pour que leurs
// importeurs ne changent pas. « Aujourd'hui » et « Sa boucle » les prennent à la source — ce module tire
// `useAtelierMatching` statiquement.
export { CLE_FIL, lire } from '@/components/matching-fil/filModele'

/** Ce qu'une ligne `matches` porte de son suivi (lot B). */
interface ColonnesSuivi {
  sent_at: string | null; response_at: string | null; reaction_motif: string | null; reaction_note: string | null
  prix_propose: number | string | null
}
interface LigneMatch extends ColonnesSuivi {
  id: string; contact_id: string; property_id: string | null; client_search_id: string | null; score: number
  reasons: RaisonsMoteur | null; snoozed_until: string | null; created_at: string | null
}
/** Un match de la boucle : proposé, répondu ou en visite (lot B). */
interface LigneBoucle extends ColonnesSuivi {
  id: string; contact_id: string; property_id: string | null; market_listing_id: string | null
  client_search_id: string | null; score: number; reasons: RaisonsMoteur | null; status: string
  created_at: string | null; apprentissage_at: string | null
}
export interface LigneContact {
  id: string; first_name: string; last_name: string; email: string | null; phone: string | null
  search_criteria: SearchCriteria | null
}
interface LigneBien {
  id: string; title: string | null; type: string | null; transaction_type: string | null
  price: number | string | null; rooms: number | string | null; surface_m2: number | string | null
  address: string | null; city: string | null; canton: string | null; features: unknown; photos: string[] | null
  /** Lot C. */
  bedrooms: number | string | null; condition: string | null; year_built: number | string | null
  off_market: boolean | null; mandate_signed_at: string | null; published_at: string | null
}
/** Une annonce du marché, colonnes légères (§7 de CLAUDE.md) : la sélection (lot 2) et la boucle (lot B) la lisent pareil. */
export interface LigneAnnonce {
  id: string; title: string | null; type: string | null; transaction_type: string | null
  price: number | string | null; current_price: number | string | null; rooms: number | string | null
  surface_m2: number | string | null; address: string | null; city: string | null; canton: string | null
  features: unknown; photos: string[] | null; photos_cf: unknown; status: string | null
  source_portal: string | null; source_id: string | null; source_url: string | null
  /** Lot C : chambres et années (état) ; première apparition, premier prix, dernière baisse (signaux). */
  bedrooms: number | string | null; year_built: number | string | null; year_renovated: number | string | null
  first_seen_at: string | null; price_at_first_seen: number | string | null; price_reduced_at: string | null
}
interface LigneRelance {
  id: string; contact_id: string | null; match_id: string | null; match_ids: string[] | null; trigger_at: string | null
}
interface DonneesFil {
  matchs: FilMatch[]
  selections: FilSelectionResume[]
  /** La boucle (lot B) : proposés, répondus, en visite. */
  boucle: FilMatch[]
  /** Les relances de proposition en cours. */
  relances: RelanceProposition[]
  historique: Map<string, Historique>
  chargeLe: number
}

/** Les colonnes d'une annonce du marché que le fil lit. */
export const COLONNES_ANNONCE = 'id, title, type, transaction_type, price, current_price, rooms, surface_m2, address, city, canton, features, photos, photos_cf, status, source_portal, source_id, source_url, bedrooms, year_built, year_renovated, first_seen_at, price_at_first_seen, price_reduced_at'
/** Les statuts de la boucle — ceux que compte aussi « Déjà proposé » (`compterHistorique`), et l'index `idx_matches_boucle`. */
const STATUTS_BOUCLE = ['sent', 'interested', 'rejected', 'visit_planned']
const VIDE: DonneesFil = { matchs: [], selections: [], boucle: [], relances: [], historique: new Map(), chargeLe: 0 }
const nonNul = (id: string | null): id is string => id != null

/** La plus récente de deux dates ISO ; l'une absente, l'autre. */
function plusRecente(a: string | null, b: string | null): string | null {
  if (!a || !b) return a ?? b
  return Date.parse(a) >= Date.parse(b) ? a : b
}

function versBien(b: LigneBien): FilBien {
  return {
    id: b.id, titre: b.title ?? '', prix: nombreOuNull(b.price), location: b.transaction_type === 'rent',
    type: b.type, pieces: nombreOuNull(b.rooms), surface: nombreOuNull(b.surface_m2), ville: b.city, canton: b.canton,
    adresse: b.address, equipements: listeEquipements(b.features), photo: b.photos?.[0] ?? null,
    chambres: nombreOuNull(b.bedrooms), etatSaisi: b.condition, anneeConstruction: nombreOuNull(b.year_built),
    offMarket: b.off_market === true,
    // `mandate_signed_at` n'est posé que par « Nouveau bien » (0 mandat sur 6 en production le 22.09.2026) :
    // la mise en service (`published_at`) date aussi un nouveau mandat.
    mandatLe: plusRecente(b.mandate_signed_at, b.published_at),
  }
}

/** Une annonce du marché, dans la forme du fil. */
export function versBienMarche(a: LigneAnnonce): FilBien {
  const ref = refAnnonceMarche(a.source_portal, a.source_id, a.id)
  return {
    // Une annonce sans titre (le portail n'en donne pas toujours) : une ligne sans nom ne se coche pas
    // en connaissance de cause, et la case comme « Écarter » se nomment d'après lui.
    id: a.id, titre: a.title?.trim() || a.address?.trim() || a.city?.trim() || ref,
    prix: nombreOuNull(a.current_price) ?? nombreOuNull(a.price),
    location: a.transaction_type === 'rent', type: a.type, pieces: nombreOuNull(a.rooms), surface: nombreOuNull(a.surface_m2),
    ville: a.city, canton: a.canton, adresse: a.address, equipements: listeEquipements(a.features),
    photo: photoAnnonce(a.photos_cf, a.photos),
    marche: { ref, sourceUrl: a.source_url },
    chambres: nombreOuNull(a.bedrooms), anneeConstruction: nombreOuNull(a.year_built), anneeRenovation: nombreOuNull(a.year_renovated),
    // Une annonce du marché est publique par définition.
    offMarket: false,
    vuLe: a.first_seen_at, prixInitial: nombreOuNull(a.price_at_first_seen), baisseLe: a.price_reduced_at,
  }
}

function versSuivi(m: ColonnesSuivi & { status: string; apprentissage_at?: string | null }): SuiviMatch {
  return {
    statut: m.status as SuiviMatch['statut'], proposeLe: m.sent_at, reponduLe: m.response_at,
    motif: m.reaction_motif, note: m.reaction_note, prixPropose: nombreOuNull(m.prix_propose), apprisLe: m.apprentissage_at ?? null,
  }
}

/**
 * Le suivi d'un match ENCORE à proposer — seulement s'il a déjà été proposé : un bien refusé pour le prix et
 * revenu par une baisse (trigger `match_retour_prix_*`) garde son motif et son prix proposé.
 */
export function suiviAProposer(m: ColonnesSuivi): SuiviMatch | undefined {
  return m.prix_propose != null || m.reaction_motif != null ? versSuivi({ ...m, status: 'suggested' }) : undefined
}

/** Un contact lu, dans la forme du fil. */
export function versAcheteur(c: LigneContact, kyc: KycDossierStatus | null | undefined): FilMatch['acheteur'] {
  return {
    id: c.id, prenom: c.first_name, nom: c.last_name, telephone: c.phone, email: c.email,
    kyc: mapKycStatus(kyc ?? undefined),
  }
}

async function chargerFil(agencyId: string): Promise<DonneesFil> {
  const debut = Date.now()
  const [bruts, resumes, boucleBrute, relancesBrutes] = await Promise.all([
    lire<LigneMatch>(
      supabase.from('matches')
        .select('id, contact_id, property_id, client_search_id, score, reasons, snoozed_until, created_at, sent_at, response_at, reaction_motif, reaction_note, prix_propose')
        .eq('agency_id', agencyId)
        .eq('status', 'suggested')
        .not('property_id', 'is', null)
        .order('score', { ascending: false }),
    ),
    // ⛔ UNE RPC ABSENTE NE FAIT PAS TOMBER LE FIL. L'écran part AVANT les migrations (`deploy-app.yml`
    // n'attend pas `deploy.yml`, CLAUDE.md §8) : la fonction peut ne pas exister encore, et les biens en
    // mandat n'en dépendent pas. Sans lignes « Marché », mais pas sans fil — et pas en silence.
    // ⚠ CETTE TOLÉRANCE NE VAUT QUE POUR L'ABSENCE (PostgREST `PGRST202`, Postgres `42883`). Un échec
    // passager doit faire échouer la lecture ENTIÈRE : TanStack garde alors les données déjà chargées et
    // le fil le dit (« rafraîchissement impossible »). Avalé, il rendait un fil sans ses lignes « Marché »,
    // cohérent en apparence et faux en substance.
    lire<{
      contact_id: string; nombre: number; meilleur_score: number; vignettes: string[] | null
      nouveaux: number | null; baisses: number | null
    }>(supabase.rpc('matching_fil_marche_resume'))
      .catch((e: unknown) => {
        const code = (e as { code?: unknown } | null)?.code
        if (code !== 'PGRST202' && code !== '42883') throw e
        console.error('[matching-fil] matching_fil_marche_resume absente : migration pas encore appliquée', e)
        return []
      }),
    lire<LigneBoucle>(
      supabase.from('matches')
        .select('id, contact_id, property_id, market_listing_id, client_search_id, score, reasons, status, created_at, sent_at, response_at, reaction_motif, reaction_note, prix_propose, apprentissage_at')
        .eq('agency_id', agencyId)
        .in('status', STATUTS_BOUCLE)
        .order('sent_at', { ascending: false, nullsFirst: false })
        .order('id'),
    ),
    // Les relances de PROPOSITION en cours, repoussées depuis « Aujourd'hui » comprises (`snoozed`) : « En
    // attente » en tire l'échéance de chaque acheteur.
    lire<LigneRelance>(
      supabase.from('reminders')
        .select('id, contact_id, match_id, match_ids, trigger_at')
        .eq('agency_id', agencyId)
        .eq('type', 'follow_up_sent_property')
        .in('status', STATUTS_RELANCE_OUVERTE),
    ),
  ])
  const lignes = bruts.filter((m) => m.property_id != null)
  if (lignes.length === 0 && resumes.length === 0 && boucleBrute.length === 0) return { ...VIDE, historique: new Map(), chargeLe: debut }
  const avecBien = [...lignes, ...boucleBrute]
  const contactIds = [...new Set([...avecBien.map((m) => m.contact_id), ...resumes.map((r) => r.contact_id)])]
  const bienIds = [...new Set(avecBien.map((m) => m.property_id).filter(nonNul))]
  const annonceIds = [...new Set(boucleBrute.map((m) => m.market_listing_id).filter(nonNul))]
  const rechercheIds = [...new Set(avecBien.map((m) => m.client_search_id).filter(nonNul))]

  const [contacts, recherches, biens, annonces, kyc] = await Promise.all([
    lire<LigneContact>(supabase.from('contacts').select('id, first_name, last_name, email, phone, search_criteria').in('id', contactIds)),
    rechercheIds.length > 0
      ? lire<{ id: string; criteria: SearchCriteria | null }>(supabase.from('client_searches').select('id, criteria').in('id', rechercheIds))
      : Promise.resolve([]),
    bienIds.length > 0
      ? lire<LigneBien>(
        supabase.from('properties')
          .select('id, title, type, transaction_type, price, rooms, surface_m2, address, city, canton, features, photos, bedrooms, condition, year_built, off_market, mandate_signed_at, published_at')
          .in('id', bienIds),
      )
      : Promise.resolve([]),
    annonceIds.length > 0
      ? lire<LigneAnnonce>(supabase.from('market_listings').select(COLONNES_ANNONCE).in('id', annonceIds))
      : Promise.resolve([]),
    lire<{ contact_id: string; dossier_status: KycDossierStatus | null }>(
      supabase.from('kyc_cases').select('contact_id, dossier_status')
        .in('contact_id', contactIds).in('type', ['buyer_pp', 'buyer_pm']).order('created_at', { ascending: false }),
    ),
  ])

  const contactParId = new Map(contacts.map((c) => [c.id, c]))
  const criteresParRecherche = new Map(recherches.map((r) => [r.id, r.criteria]))
  const bienParId = new Map(biens.map((b) => [b.id, versBien(b)]))
  const annonceParId = new Map(annonces.map((a) => [a.id, versBienMarche(a)]))
  const kycParContact = new Map<string, KycDossierStatus | null>()
  for (const k of kyc) if (!kycParContact.has(k.contact_id)) kycParContact.set(k.contact_id, k.dossier_status)
  const criteresDe = (m: { client_search_id: string | null }, c: LigneContact): SearchCriteria | null =>
    (m.client_search_id ? criteresParRecherche.get(m.client_search_id) : null) ?? c.search_criteria

  const matchs: FilMatch[] = []
  for (const m of lignes) {
    const c = contactParId.get(m.contact_id)
    const bien = bienParId.get(m.property_id as string)
    // Un contact ou un bien que la RLS ne rend pas : on n'invente pas la ligne.
    if (!c || !bien) continue
    matchs.push({
      id: m.id, score: m.score, raisons: m.reasons, creeLe: m.created_at, reporteJusquau: m.snoozed_until, bien,
      criteres: criteresDe(m, c), rechercheId: m.client_search_id,
      acheteur: versAcheteur(c, kycParContact.get(c.id)), suivi: suiviAProposer(m),
    })
  }

  const boucle: FilMatch[] = []
  for (const m of boucleBrute) {
    const c = contactParId.get(m.contact_id)
    const bien = m.property_id ? bienParId.get(m.property_id) : m.market_listing_id ? annonceParId.get(m.market_listing_id) : undefined
    if (!c || !bien) continue
    boucle.push({
      id: m.id, score: m.score, raisons: m.reasons, creeLe: m.created_at, reporteJusquau: null, bien,
      criteres: criteresDe(m, c), rechercheId: m.client_search_id,
      acheteur: versAcheteur(c, kycParContact.get(c.id)), suivi: versSuivi(m),
    })
  }

  const selections: FilSelectionResume[] = []
  for (const r of resumes) {
    const c = contactParId.get(r.contact_id)
    if (!c || r.nombre <= 0) continue
    selections.push({
      acheteur: versAcheteur(c, kycParContact.get(c.id)),
      nombre: r.nombre, meilleurScore: r.meilleur_score, vignettes: r.vignettes ?? [],
      nouveaux: r.nouveaux ?? 0, baisses: r.baisses ?? 0,
    })
  }

  // Une relance sans `match_ids` (un seul bien, ou d'avant le lot B) couvre son seul `match_id`.
  const relances: RelanceProposition[] = relancesBrutes
    .filter((r): r is LigneRelance & { contact_id: string } => r.contact_id != null)
    .map((r) => ({ id: r.id, contactId: r.contact_id, matchIds: r.match_ids ?? (r.match_id ? [r.match_id] : []), echeance: r.trigger_at }))
  return { matchs, selections, boucle, relances, historique: compterHistorique(boucleBrute), chargeLe: debut }
}

interface EtatFil {
  isLoading: boolean
  isError: boolean
  /** Des données sont déjà là : un rafraîchissement en échec ne doit pas les remplacer par l'erreur. */
  aDesDonnees: boolean
  /** Horodatage du dernier échec (0 si aucun) : un échec signalé ne l'est qu'une fois. */
  erreurLe: number
  /** Rend la promesse d'invalidation : un appelant qui doit attendre la fin du rafraîchissement
   *  (relâcher un verrou, par exemple) le peut ; les autres l'ignorent avec `void`. */
  rafraichir: () => Promise<void>
}

/** Les matchs du fil — à proposer, du marché, de la boucle —, les relances en cours, et l'heure du chargement. */
export function useMatchingFil(): DonneesFil & EtatFil {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const client = useQueryClient()
  const requete = useQuery({
    queryKey: [CLE_FIL, agencyId],
    queryFn: () => chargerFil(agencyId as string),
    enabled: agencyId != null,
  })
  const rafraichir = useCallback((): Promise<void> => client.invalidateQueries({ queryKey: [CLE_FIL] }), [client])
  // ⚠ Une requête DÉSACTIVÉE n'est pas « en chargement » pour TanStack v5 (`isLoading` faux) : sans
  // la garde sur le profil, le fil afficherait « Tout est à jour » le temps que la session arrive.
  return {
    ...(requete.data ?? VIDE),
    isLoading: profile == null || requete.isLoading,
    isError: requete.isError,
    aDesDonnees: requete.data !== undefined,
    erreurLe: requete.errorUpdatedAt,
    rafraichir,
  }
}

/** Ce que les exécuteurs de l'atelier lisent d'un match du fil : ils restent la source unique des écritures. */
export function versGeste(m: FilMatch): { acheteur: AcheteurGeste; bien: BienGeste } {
  const marche = m.bien.marche
  return {
    acheteur: { id: m.acheteur.id, matchId: m.id, first: m.acheteur.prenom, last: m.acheteur.nom, score: m.score },
    bien: {
      kind: marche ? 'market' : 'property',
      id: m.bien.id,
      ref: marche ? marche.ref : refBienInterne(m.bien.id),
      title: m.bien.titre,
    },
  }
}
