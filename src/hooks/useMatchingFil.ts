/**
 * Données du fil de matchs : « À traiter » sur les biens de l'agence (lot 1), et une ligne « Marché »
 * par acheteur, résumée côté serveur par `matching_fil_marche()` (lot 2).
 *
 * Conception : `docs/superpowers/specs/2026-09-17-matching-fil-design.md`, §8.
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
 * une paire existante (`ON CONFLICT DO NOTHING`). Aucun signal fiable ne permet de les écarter ici —
 * `client_searches.updated_at` bouge à CHAQUE enregistrement du contact (trigger de synchro), et s'y
 * fier effacerait les verdicts d'un acheteur dont on a corrigé la nationalité. La re-notation est un
 * chantier du moteur, à trancher avant la bascule de production (conception §13).
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
import { refBienInterne, type AcheteurGeste, type BienGeste } from '@/hooks/useAtelierMatching'
import type { SearchCriteria } from '@/types/contact'
import type { KycDossierStatus } from '@/types/kyc'
import {
  compterHistorique, type FilBien, type FilMatch, type FilSelectionResume, type Historique, type RaisonsMoteur,
} from '@/components/matching-fil/filModele'

interface LigneMatch {
  id: string; contact_id: string; property_id: string | null; client_search_id: string | null; score: number
  reasons: RaisonsMoteur | null; snoozed_until: string | null; created_at: string | null
}
export interface LigneContact {
  id: string; first_name: string; last_name: string; email: string | null; phone: string | null
  search_criteria: SearchCriteria | null
}
interface LigneBien {
  id: string; title: string | null; type: string | null; transaction_type: string | null
  price: number | string | null; rooms: number | string | null; surface_m2: number | string | null
  address: string | null; city: string | null; canton: string | null; features: unknown; photos: string[] | null
}
interface DonneesFil {
  matchs: FilMatch[]
  selections: FilSelectionResume[]
  historique: Map<string, Historique>
  chargeLe: number
}

/** Préfixe des clés de requête du fil : l'invalider rafraîchit aussi les sélections ouvertes. */
export const CLE_FIL = 'matching-fil'
const VIDE: DonneesFil = { matchs: [], selections: [], historique: new Map(), chargeLe: 0 }

export async function lire<T>(requete: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await requete
  if (error) throw error
  return (data ?? []) as T[]
}

export const nombreOuNull = (v: number | string | null): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

export function listeEquipements(brut: unknown): string[] {
  if (Array.isArray(brut)) return brut.filter((f): f is string => typeof f === 'string')
  if (brut && typeof brut === 'object') {
    return Object.entries(brut as Record<string, unknown>).filter(([, v]) => Boolean(v)).map(([k]) => k)
  }
  return []
}

function versBien(b: LigneBien): FilBien {
  return {
    id: b.id, titre: b.title ?? '', prix: nombreOuNull(b.price), location: b.transaction_type === 'rent',
    type: b.type, pieces: nombreOuNull(b.rooms), surface: nombreOuNull(b.surface_m2), ville: b.city, canton: b.canton,
    adresse: b.address, equipements: listeEquipements(b.features), photo: b.photos?.[0] ?? null,
  }
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
  const [bruts, resumes] = await Promise.all([
    lire<LigneMatch>(
      supabase.from('matches')
        .select('id, contact_id, property_id, client_search_id, score, reasons, snoozed_until, created_at')
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
    lire<{ contact_id: string; nombre: number; meilleur_score: number; vignettes: string[] | null }>(supabase.rpc('matching_fil_marche'))
      .catch((e: unknown) => {
        const code = (e as { code?: unknown } | null)?.code
        if (code !== 'PGRST202' && code !== '42883') throw e
        console.error('[matching-fil] matching_fil_marche absente : migration pas encore appliquée', e)
        return []
      }),
  ])
  const lignes = bruts.filter((m) => m.property_id != null)
  if (lignes.length === 0 && resumes.length === 0) return { matchs: [], selections: [], historique: new Map(), chargeLe: debut }
  const contactIds = [...new Set([...lignes.map((m) => m.contact_id), ...resumes.map((r) => r.contact_id)])]
  const bienIds = [...new Set(lignes.map((m) => m.property_id as string))]
  const rechercheIds = [...new Set(lignes.map((m) => m.client_search_id).filter((id): id is string => id != null))]

  const [contacts, recherches, biens, kyc, historique] = await Promise.all([
    lire<LigneContact>(supabase.from('contacts').select('id, first_name, last_name, email, phone, search_criteria').in('id', contactIds)),
    rechercheIds.length > 0
      ? lire<{ id: string; criteria: SearchCriteria | null }>(supabase.from('client_searches').select('id, criteria').in('id', rechercheIds))
      : Promise.resolve([]),
    bienIds.length > 0
      ? lire<LigneBien>(
        supabase.from('properties')
          .select('id, title, type, transaction_type, price, rooms, surface_m2, address, city, canton, features, photos')
          .in('id', bienIds),
      )
      : Promise.resolve([]),
    lire<{ contact_id: string; dossier_status: KycDossierStatus | null }>(
      supabase.from('kyc_cases').select('contact_id, dossier_status')
        .in('contact_id', contactIds).in('type', ['buyer_pp', 'buyer_pm']).order('created_at', { ascending: false }),
    ),
    lire<{ contact_id: string; status: string }>(
      supabase.from('matches').select('contact_id, status')
        .eq('agency_id', agencyId).in('contact_id', contactIds).in('status', ['sent', 'interested', 'rejected', 'visit_planned']),
    ),
  ])

  const contactParId = new Map(contacts.map((c) => [c.id, c]))
  const criteresParRecherche = new Map(recherches.map((r) => [r.id, r.criteria]))
  const bienParId = new Map(biens.map((b) => [b.id, versBien(b)]))
  const kycParContact = new Map<string, KycDossierStatus | null>()
  for (const k of kyc) if (!kycParContact.has(k.contact_id)) kycParContact.set(k.contact_id, k.dossier_status)

  const matchs: FilMatch[] = []
  for (const m of lignes) {
    const c = contactParId.get(m.contact_id)
    const bien = bienParId.get(m.property_id as string)
    // Un contact ou un bien que la RLS ne rend pas : on n'invente pas la ligne.
    if (!c || !bien) continue
    matchs.push({
      id: m.id, score: m.score, raisons: m.reasons, creeLe: m.created_at, reporteJusquau: m.snoozed_until, bien,
      criteres: (m.client_search_id ? criteresParRecherche.get(m.client_search_id) : null) ?? c.search_criteria,
      acheteur: versAcheteur(c, kycParContact.get(c.id)),
    })
  }

  const selections: FilSelectionResume[] = []
  for (const r of resumes) {
    const c = contactParId.get(r.contact_id)
    if (!c || r.nombre <= 0) continue
    selections.push({
      acheteur: versAcheteur(c, kycParContact.get(c.id)),
      nombre: r.nombre, meilleurScore: r.meilleur_score, vignettes: r.vignettes ?? [],
    })
  }
  return { matchs, selections, historique: compterHistorique(historique), chargeLe: debut }
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

/** Les matchs « À traiter » des biens de l'agence, leur historique de propositions, et l'heure du chargement. */
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
