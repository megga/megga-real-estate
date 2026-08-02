/**
 * Hooks React Query de la console super-admin des agences : liste enrichie de
 * compteurs, détail d'une agence et ses sous-ressources (membres, biens,
 * transactions, activité). Alimente AdminAgencyDetailPage.
 *
 * Étape 15 : la liste passe par la RPC `get_admin_agencies()` — UN appel là où il en
 * fallait trois (select agencies + get_agency_stats + select subscriptions). Elle
 * apporte en plus le MRR, le score d'activation et le statut de vérification KYB, que
 * cette liste ne savait pas afficher.
 *
 * ⚠ Le MRR vient du SERVEUR et n'est jamais recalculé ici (§4.3). C'est la même règle
 * qui sert l'écran Plans : deux calculs séparés divergent, et ils divergeaient déjà —
 * l'ancien calcul de useAdminBilling ignorait les agences SUSPENDUES.
 *
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AgencyWithStats {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  plan: string | null
  status: string
  created_at: string
  agent_count: number
  property_count: number
  transaction_count: number
  // Statut d'abonnement Stripe (miroir subscriptions) — pour badges trials/past_due.
  subscription_status: string | null
  current_period_end: string | null
  /** MRR serveur (§4.3). Essai, impayé et agence suspendue comptent zéro. */
  mrr: number
  /** Score d'activation 0-100 (`agency_activation`), null tant que le cron n'a pas tourné. */
  score: number | null
  /** Statut de vérification KYB (C9) — pour le renvoi vers la revue (§5.13). */
  verification_status: string | null
  /** Dernière activité, dérivée d'`activity_events`. */
  last_activity_at: string | null
}

/** Ligne brute de `get_admin_agencies()`, re-typée à la main faute de types générés. */
interface AdminAgencyRow {
  id: string; name: string; email: string | null; city: string | null; canton: string | null
  plan: string | null; agents: number; properties: number; deals: number; mrr: number | string
  status: string | null; sub: string | null; score: number | null
  since: string; last: string | null; verification_status: string | null
  slug: string; logo_url: string | null; phone: string | null
  current_period_end: string | null
}

/** Liste des agences + compteurs agrégés côté serveur, et mutation suspend/réactive (via edge `admin-agency-lifecycle`). */
export function useAdminAgencies() {
  const queryClient = useQueryClient()

  const agencies = useQuery({
    queryKey: ['admin-agencies'],
    queryFn: async (): Promise<AgencyWithStats[]> => {
      const { data, error } = await supabase.rpc('get_admin_agencies', { p_limit: 2000, p_offset: 0 })
      if (error) throw error

      return ((data ?? []) as AdminAgencyRow[]).map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        logo_url: r.logo_url,
        // `address` n'est pas servie par la RPC : le registre ne l'affiche pas, et la
        // fiche la relit en entier via useAdminAgency(). L'ajouter au registre aurait
        // chargé une colonne pour personne.
        address: null,
        phone: r.phone,
        email: r.email,
        plan: r.plan,
        status: r.status ?? 'active',
        created_at: r.since,
        agent_count: Number(r.agents),
        property_count: Number(r.properties),
        transaction_count: Number(r.deals),
        subscription_status: r.sub,
        current_period_end: r.current_period_end,
        mrr: Number(r.mrr),
        score: r.score,
        verification_status: r.verification_status,
        last_activity_at: r.last,
      }))
    },
    staleTime: 30_000,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'suspended' }) => {
      // P4 : passe par l'edge admin-agency-lifecycle — l'ancien update nu de
      // agencies.status ne bloquait personne (aucun ban GoTrue des membres).
      const { error } = await supabase.functions.invoke('admin-agency-lifecycle', {
        body: { action: status === 'suspended' ? 'suspend' : 'reactivate', agency_id: id },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-agencies'] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  return {
    agencies: agencies.data ?? [],
    isLoading: agencies.isLoading,
    isError: agencies.isError,
    refetch: agencies.refetch,
    updateStatus,
  }
}

/** Détail complet d'une agence par id (`select('*')`). */
export function useAdminAgency(id: string) {
  return useQuery({
    queryKey: ['admin-agency', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}

/** Membres (profiles) d'une agence, les plus récents d'abord. */
export function useAgencyMembers(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-members', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role, phone, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}

/** Biens d'une agence (colonnes de liste seulement, sans description lourde). */
export function useAgencyProperties(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-properties', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, status, price, city, canton, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}

/** Transactions d'une agence (stade pipeline, statut, montant offert). */
export function useAgencyTransactions(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-transactions', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, stage, status, price_offered, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}

/** 30 derniers événements d'activité d'une agence. */
export function useAgencyActivity(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-activity', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, metadata, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })
}
