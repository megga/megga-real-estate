/**
 * Hooks super-admin — file de revue KYB (étape 5, tâche 3).
 *
 * `useAdminKybReviewQueue` liste UNE PAGE des dossiers en `manual_review`, avec le
 * nombre total en attente (get_admin_agency_review_queue, 20260728160000 — paginée
 * par le correctif de revue étape 6, voir son en-tête). `useAdminKybReviewDetail`
 * assemble, pour UN dossier, quatre lectures : les checks eux-mêmes
 * (get_admin_agency_review_detail), les personnes liées + leurs rôles (pour
 * légender les checks « personne » avec un nom plutôt qu'un UUID, et calculer
 * les signataires actifs), le catalogue des vétos EN VIGUEUR (pour détecter un
 * véto qui n'a AUCUNE ligne — aucun connecteur câblé, cf. AGENCY_KYB_SOURCES —
 * distinct d'un véto exécuté mais `unavailable`), et l'historique d'audit
 * (`activity_events`, category=kyc) — c'est cette dernière lecture, et nulle
 * autre, qui porte le motif d'un rejet passé (metadata.reason) :
 * get_admin_agency_review_detail ne le rend pas (voir son commentaire SQL).
 *
 * `useAdminKybReviewActions` porte les quatre décisions humaines. Résoudre une
 * pièce d'identité enchaîne DEUX appels serveur volontairement distincts
 * (admin_resolve_agency_id_document PUIS admin_relaunch_agency_review, voir
 * 20260728160000 §6) derrière une seule mutation, pour qu'un seul geste à
 * l'écran suffise — le relecteur n'a pas à se souvenir qu'il faut aussi relancer.
 *
 * Client casté (`db`) : les 2 tables (verification_check_config/_types) et les
 * 6 RPC de cette migration ne sont pas encore dans les types générés
 * (src/types/database.ts — auto-généré, en retard sur ces migrations récentes,
 * cf. son en-tête). Même motif que useAgencyFollowupSuggestions.ts : client
 * casté en `SupabaseClient` non paramétré, entrées/sorties re-typées à la main
 * juste après. À nettoyer (retirer `db`, repasser sur `supabase` typé) à la
 * prochaine régénération (`supabase gen types typescript --local`).
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CheckResult, PersonRoleRow } from '@/pages/admin/AdminKybReviewPage'

const db = supabase as unknown as SupabaseClient

// ─── Liste ──────────────────────────────────────────────────────────────────

export interface KybReviewQueueRow {
  agencyId: string
  agencyName: string
  country: string | null
  verificationStatus: string
  verificationScore: number | null
  identitySubmittedAt: string | null
  verificationSweepAttempts: number
}

const QUEUE_KEY = ['admin-kyb-review-queue'] as const

/** Dossiers par page. Reprend le défaut de la RPC (patron des RPC admin voisines,
 *  20260726002000). La RPC plafonne de toute façon à 1000 = `max_rows` de PostgREST
 *  (supabase/config.toml) : au-delà, la réponse serait tronquée en silence. */
export const KYB_REVIEW_PAGE_SIZE = 50

interface QueueRpcRow {
  agency_id: string
  agency_name: string
  country: string | null
  verification_status: string
  verification_score: number | null
  identity_submitted_at: string | null
  verification_sweep_attempts: number
  /** Nombre TOTAL de dossiers en attente, répété sur chaque ligne (sous-requête scalaire
   *  côté RPC). `bigint` en SQL : PostgREST peut le rendre en nombre ou en texte, d'où
   *  le `Number()` plutôt qu'une confiance aveugle au type. */
  total_count: number | string
}

export interface KybReviewQueuePage {
  rows: KybReviewQueueRow[]
  /** Dossiers en attente TOUTES pages confondues — jamais `rows.length`, qui ne dit
   *  que la taille de la fenêtre courante. */
  total: number
  /** Décalage RÉELLEMENT servi, qui peut différer de celui demandé quand la file a
   *  rétréci sous le relecteur (voir `useAdminKybReviewQueue`). L'écran numérote la
   *  page à partir d'ICI, jamais à partir de ce qu'il a demandé. */
  servedOffset: number
}

/** Une lecture de la RPC paginée, remise en forme camelCase. `limit` n'est explicite
 *  que pour la sonde d'une seule ligne du repli ci-dessous ; tout le reste lit une page
 *  entière. */
async function fetchQueuePage(offset: number, limit = KYB_REVIEW_PAGE_SIZE): Promise<KybReviewQueuePage> {
  const res = await db.rpc('get_admin_agency_review_queue', { p_limit: limit, p_offset: offset })
  const { data, error } = res as unknown as { data: QueueRpcRow[] | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  const rpcRows = data ?? []
  return {
    rows: rpcRows.map((r) => ({
      agencyId: r.agency_id,
      agencyName: r.agency_name,
      country: r.country,
      verificationStatus: r.verification_status,
      verificationScore: r.verification_score,
      identitySubmittedAt: r.identity_submitted_at,
      verificationSweepAttempts: r.verification_sweep_attempts,
    })),
    // `total_count` est répété sur chaque ligne : une page vide n'en porte donc aucun,
    // d'où le 0 — que l'appelant ne doit jamais lire comme « la file est vide » sans
    // avoir vérifié (cf. le repli de useAdminKybReviewQueue).
    total: rpcRows.length > 0 ? Number(rpcRows[0]!.total_count) : 0,
    servedOffset: offset,
  }
}

/**
 * Une PAGE de la file `manual_review`, déjà triée par score croissant (NULLS FIRST)
 * côté RPC, accompagnée du total réel.
 *
 * Paginée depuis le correctif de revue étape 6 : sans `p_limit`/`p_offset`, PostgREST
 * coupait la réponse à `max_rows` (1000, supabase/config.toml) sans le dire, et comme
 * le tri est croissant, ce sont les dossiers les MIEUX notés qui disparaissaient —
 * invisibles, donc jamais tranchés, sur un dispositif où la revue humaine est l'unique
 * voie de sortie (docs/agency-kyb-handoff.md §7bis).
 *
 * Se replie sur la DERNIÈRE page réelle quand `offset` tombe au-delà de la fin. Ce cas
 * n'a rien d'exotique : un relecteur qui tranche les derniers dossiers de la dernière
 * page la vide sous ses propres pieds. Le repli vit ici, dans la fonction de lecture,
 * plutôt que dans un effet côté écran qui corrigerait un `useState` après coup —
 * `setState` synchrone dans un effet déclenche un rendu en cascade
 * (react-hooks/set-state-in-effect), que ce fichier et AdminKybReviewPage évitent
 * partout ailleurs. `servedOffset` dit ensuite à l'écran quelle page il regarde
 * VRAIMENT ; il n'a plus rien à corriger.
 */
export function useAdminKybReviewQueue(offset = 0) {
  return useQuery({
    // L'offset entre dans la clé, QUEUE_KEY restant le préfixe : chaque page se cache
    // séparément, et une invalidation sur QUEUE_KEY les atteint toutes d'un coup.
    queryKey: [...QUEUE_KEY, offset],
    queryFn: async (): Promise<KybReviewQueuePage> => {
      const page = await fetchQueuePage(offset)
      if (page.rows.length > 0 || offset === 0) return page

      // Fenêtre au-delà de la fin : une page vide ne porte AUCUN total (la colonne vit
      // sur les lignes), donc impossible de savoir d'ici si la file est terminée ou si
      // elle a simplement rétréci. Une lecture d'une seule ligne tranche la question
      // sans ramener de données inutiles.
      const head = await fetchQueuePage(0, 1)
      if (head.total === 0) return { rows: [], total: 0, servedOffset: 0 }

      const lastOffset = Math.floor((head.total - 1) / KYB_REVIEW_PAGE_SIZE) * KYB_REVIEW_PAGE_SIZE
      return await fetchQueuePage(lastOffset)
    },
    // File de travail partagée entre relecteurs : fraîcheur courte plutôt que le
    // défaut habituel, pour qu'un dossier tranché par un collègue ne traîne pas
    // trop longtemps dans la liste d'un autre.
    staleTime: 15_000,
    // Garde la page précédente affichée pendant le chargement de la suivante : sans
    // cela, chaque changement de page repasse par le squelette et fait « sauter » la
    // liste sous le curseur du relecteur.
    placeholderData: keepPreviousData,
  })
}

// ─── Détail ─────────────────────────────────────────────────────────────────

export interface KybReviewCheckRow {
  checkId: string
  relatedPersonId: string | null
  checkType: string
  source: string
  result: CheckResult
  rawResponse: unknown
  checkedAt: string
  applicableWeight: number | null
  isVeto: boolean | null
}

interface DetailRpcRow {
  check_id: string
  related_person_id: string | null
  check_type: string
  source: string
  result: CheckResult
  raw_response: unknown
  checked_at: string
  applicable_weight: number | null
  is_veto: boolean | null
}

/** Checks du dossier, entité et personne confondus (get_admin_agency_review_detail). */
function useKybReviewChecks(agencyId: string) {
  return useQuery({
    queryKey: ['admin-kyb-review-checks', agencyId],
    queryFn: async (): Promise<KybReviewCheckRow[]> => {
      const res = await db.rpc('get_admin_agency_review_detail', { p_agency_id: agencyId })
      const { data, error } = res as unknown as { data: DetailRpcRow[] | null; error: { message: string } | null }
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => ({
        checkId: r.check_id,
        relatedPersonId: r.related_person_id,
        checkType: r.check_type,
        source: r.source,
        result: r.result,
        rawResponse: r.raw_response,
        checkedAt: r.checked_at,
        applicableWeight: r.applicable_weight,
        isVeto: r.is_veto,
      }))
    },
    staleTime: 10_000,
  })
}

export interface KybReviewPerson {
  id: string
  firstName: string
  lastName: string
  roles: PersonRoleRow[]
}

interface PersonRpcRow {
  id: string
  first_name: string
  last_name: string
  roles: Array<{ role: 'signatory' | 'ubo'; valid_to: string | null }> | null
}

/** Personnes liées à l'agence + leurs rôles — légende les checks « personne » (nom
 *  plutôt qu'UUID) et alimente le calcul des signataires actifs (activeSignatoryIds).
 *  `agency_related_persons`/`agency_person_roles` SONT dans les types générés (client
 *  `supabase` normal, pas `db`) — table plus ancienne que le trou de régénération
 *  décrit en en-tête de fichier. */
function useKybReviewPersons(agencyId: string) {
  return useQuery({
    queryKey: ['admin-kyb-review-persons', agencyId],
    queryFn: async (): Promise<KybReviewPerson[]> => {
      const { data, error } = await supabase
        .from('agency_related_persons')
        .select('id, first_name, last_name, roles:agency_person_roles(role, valid_to)')
        .eq('agency_id', agencyId)
      if (error) throw error
      return ((data ?? []) as unknown as PersonRpcRow[]).map((p) => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        roles: (p.roles ?? []).map((r) => ({ role: r.role, validTo: r.valid_to })),
      }))
    },
    staleTime: 10_000,
  })
}

export interface KybReviewCurrentVeto {
  checkType: string
  scope: 'agency' | 'person'
}

/** Types de véto EN VIGUEUR AUJOURD'HUI (valid_to is null) — permet de détecter un
 *  véto qui n'a AUCUNE ligne du tout dans les checks (aucun connecteur câblé pour ce
 *  type, ex. registry_number_format/registry_country_match, cf. AGENCY_KYB_SOURCES),
 *  distinct d'un check exécuté qui répond `unavailable`. Deux lectures simples plutôt
 *  qu'un embed PostgREST : catalogue minuscule (~19 lignes), lu rarement, la
 *  robustesse prime sur l'aller-retour économisé. Lisible par un super-admin (RLS
 *  vcc_select_super_admin sur verification_check_config, vct_select_all sur
 *  verification_check_types, 20260728103000). */
function useKybReviewCurrentVetoTypes() {
  return useQuery({
    queryKey: ['admin-kyb-review-current-vetos'],
    queryFn: async (): Promise<KybReviewCurrentVeto[]> => {
      const configRes = await db
        .from('verification_check_config')
        .select('check_type')
        .eq('is_veto', true)
        .is('valid_to', null)
      const { data: configRows, error: configError } = configRes as unknown as {
        data: Array<{ check_type: string }> | null
        error: { message: string } | null
      }
      if (configError) throw new Error(configError.message)

      const codes = (configRows ?? []).map((r) => r.check_type)
      if (codes.length === 0) return []

      const typeRes = await db
        .from('verification_check_types')
        .select('code, scope')
        .in('code', codes)
      const { data: typeRows, error: typeError } = typeRes as unknown as {
        data: Array<{ code: string; scope: 'agency' | 'person' }> | null
        error: { message: string } | null
      }
      if (typeError) throw new Error(typeError.message)

      return (typeRows ?? []).map((t) => ({ checkType: t.code, scope: t.scope }))
    },
    staleTime: 5 * 60_000, // catalogue quasi statique — ne change qu'à un réglage de barème
  })
}

export interface KybReviewEvent {
  id: string
  action: string
  createdAt: string
  metadata: Record<string, unknown> | null
}

interface EventRpcRow {
  id: string
  action: string
  created_at: string
  metadata: Record<string, unknown> | null
}

/** Historique d'audit du dossier (activity_events, category=kyc) — soumission,
 *  recalculs, tentatives du filet, décisions humaines passées. C'est la SEULE lecture
 *  qui porte le motif d'un rejet (metadata.reason sous action=agency_verification_rejected) :
 *  get_admin_agency_review_detail ne le rend pas, contrat non documenté ailleurs de
 *  façon durable — voir decisionReasonFromEvent (AdminKybReviewPage.tsx) qui le lit.
 *  `activity_events` est dans les types générés (client `supabase` normal). */
function useKybReviewEvents(agencyId: string) {
  return useQuery({
    queryKey: ['admin-kyb-review-events', agencyId],
    queryFn: async (): Promise<KybReviewEvent[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, created_at, metadata')
        .eq('agency_id', agencyId)
        .eq('category', 'kyc')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return ((data ?? []) as unknown as EventRpcRow[]).map((e) => ({
        id: e.id, action: e.action, createdAt: e.created_at, metadata: e.metadata,
      }))
    },
    staleTime: 10_000,
  })
}

/** Assemble les quatre lectures du détail d'un dossier. `agencyId` requis : ce hook
 *  n'est monté que par le tiroir de détail, lui-même rendu uniquement quand un
 *  dossier est sélectionné (cf. AdminKybReviewPage) — pas de branche "en attente
 *  d'id" à gérer ici. */
export function useAdminKybReviewDetail(agencyId: string) {
  const checks = useKybReviewChecks(agencyId)
  const persons = useKybReviewPersons(agencyId)
  const currentVetoTypes = useKybReviewCurrentVetoTypes()
  const events = useKybReviewEvents(agencyId)

  return {
    checks,
    persons,
    currentVetoTypes,
    events,
    // checks/persons sont INDISPENSABLES à la lecture du dossier (sans elles, rien à
    // montrer) ; currentVetoTypes/events ENRICHISSENT l'écran (véto absent au sens
    // strict, historique) mais leur échec ne doit pas bloquer l'affichage des checks
    // déjà là — dégradation gracieuse, cf. leurs `?? []` par défaut côté page.
    isLoading: checks.isLoading || persons.isLoading,
    isError: checks.isError || persons.isError,
  }
}

// ─── Actions (décision humaine) ──────────────────────────────────────────────

/** Invalide la file ET le détail du dossier concerné — commun aux quatre actions :
 *  chacune peut faire quitter la file (validé/rejeté) ou changer le score/les checks
 *  (relancé/résolu). C'est au composant appelant de refermer le tiroir quand l'agence
 *  a quitté la file (AdminKybReviewPage : effet qui compare selectedAgencyId à la
 *  file fraîchement invalidée). */
function useInvalidateKybReview(agencyId: string) {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: QUEUE_KEY })
    await queryClient.invalidateQueries({ queryKey: ['admin-kyb-review-checks', agencyId] })
    await queryClient.invalidateQueries({ queryKey: ['admin-kyb-review-events', agencyId] })
  }
}

/** Lève une Error lisible depuis le résultat casté d'un appel RPC — factorise le
 *  triptyque `res as unknown as {...}; if (error) throw` répété par les 4 actions. */
async function callRpc(fn: string, args: Record<string, unknown>): Promise<void> {
  const res = await db.rpc(fn, args)
  const { error } = res as unknown as { error: { message: string } | null }
  if (error) throw new Error(error.message)
}

/** Les cinq actions de décision humaine sur UN dossier (la cinquième, `requestCorrection`,
 *  vient de l'étape 7/tâche 5). `agencyId` requis, même raison que useAdminKybReviewDetail. */
export function useAdminKybReviewActions(agencyId: string) {
  const invalidate = useInvalidateKybReview(agencyId)

  const validate = useMutation({
    mutationFn: () => callRpc('admin_validate_agency_review', { p_agency_id: agencyId }),
    onSuccess: invalidate,
  })

  const reject = useMutation({
    mutationFn: (reason: string) => callRpc('admin_reject_agency_review', { p_agency_id: agencyId, p_reason: reason }),
    onSuccess: invalidate,
  })

  const relaunch = useMutation({
    mutationFn: () => callRpc('admin_relaunch_agency_review', { p_agency_id: agencyId }),
    onSuccess: invalidate,
  })

  // Cinquième décision (étape 7, tâche 5) : renvoyer au dirigeant plutôt que rejeter. Le
  // motif est OBLIGATOIRE côté RPC, et pour une raison de fond : le dirigeant ne voit pas la
  // file, il ne sait de la demande que ce que ce texte lui dit. Un motif vide le ferait
  // resoumettre à l'identique.
  const requestCorrection = useMutation({
    mutationFn: (reason: string) =>
      callRpc('admin_request_agency_correction', { p_agency_id: agencyId, p_reason: reason }),
    onSuccess: invalidate,
  })

  // Résoudre PUIS relancer, deux appels distincts (voir en-tête de fichier) : si la
  // résolution échoue, la relance ne part jamais (callRpc lève avant la ligne suivante).
  const resolveIdentityDocument = useMutation({
    mutationFn: async ({ checkId, result }: { checkId: string; result: 'match' | 'partial' | 'mismatch' }) => {
      await callRpc('admin_resolve_agency_id_document', { p_agency_id: agencyId, p_check_id: checkId, p_result: result })
      await callRpc('admin_relaunch_agency_review', { p_agency_id: agencyId })
    },
    onSuccess: invalidate,
  })

  return { validate, reject, relaunch, requestCorrection, resolveIdentityDocument }
}
