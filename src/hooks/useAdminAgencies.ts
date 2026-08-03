/**
 * Hooks React Query du REGISTRE des agences (console super-admin) : liste
 * enrichie de compteurs serveur, et le geste de cycle de vie.
 *
 * La FICHE d'une agence ne vit plus ici : elle lit `get_admin_agency_detail()`
 * via `useAdminAgencyDetail` — voir la note en pied de fichier.
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
  city: string | null
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

/** Ligne brute de `get_admin_agencies()`. Re-typée à la main NON par absence des types
 *  générés — la RPC y est entrée avec #1064 — mais parce que le générateur perd la
 *  NULLABILITÉ des colonnes d'un `returns table` : il déclare `email`, `sub`, `logo_url`
 *  et `current_period_end` non-nullables, alors qu'elles sont nulles en prod (mesuré le
 *  02.08.2026 : respectivement 9, 10, 10 et 10 agences sur 10). Le type ci-dessous est
 *  donc le plus vrai des deux ; c'est lui qui justifie les `??` du mapping. */
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
        city: r.city,
        // `address` n'est pas servie par la RPC : le registre ne l'affiche pas, et la
        // fiche ne la montre plus non plus depuis la refonte (elle mesure l'usage de
        // la plateforme, pas l'identité de l'agence). Champ conservé pour la forme
        // exportée, jamais rempli.
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
      const { data, error } = await supabase.functions.invoke('admin-agency-lifecycle', {
        body: { action: status === 'suspended' ? 'suspend' : 'reactivate', agency_id: id },
      })
      if (error) throw error
      // ⚠ L'absence d'`error` NE SUFFIT PAS : c'est le contrat client des gestes
      // admin. Une réponse 200 qui ne porte pas `success` est un échec silencieux
      // à l'écran, le geste paraissant réussi.
      if (data && (data as { success?: boolean }).success === false) {
        throw new Error((data as { error?: string }).error ?? 'lifecycle failed')
      }
      return data
    },
    // ⚠ `onSettled`, pas `onSuccess`. L'edge écrit l'état de l'agence AVANT le
    // registre et lève si `admin_log_write` échoue : un geste réellement appliqué
    // peut donc remonter en erreur. Invalider seulement au succès laisserait
    // l'écran afficher l'ancien état d'une agence déjà suspendue.
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-agencies'] })
      // L'edge bannit les comptes GoTrue et écrit `profiles.is_suspended` : le
      // registre Utilisateurs est concerné autant que celui des agences.
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      if (vars?.id) queryClient.invalidateQueries({ queryKey: ['admin-agency-detail', vars.id] })
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

/*
 * ── Cinq hooks retirés le 03.08.2026 avec la refonte de la fiche agence ──────
 *
 * `useAdminAgency`, `useAgencyMembers`, `useAgencyProperties`,
 * `useAgencyTransactions` et `useAgencyActivity` faisaient SIX allers-retours
 * pour peupler six onglets. La fiche lit désormais `get_admin_agency_detail()`,
 * qui assemble tout côté serveur — et qui existait déjà, sans consommateur.
 *
 * ⚠ `useAgencyProperties` avait un HOMONYME dans `@/hooks/useProperties`, lui
 * bien vivant (six surfaces du CRM agent). Ne pas confondre les deux : un grep
 * sur le seul nom donne huit fichiers dont un seul concernait celui-ci.
 */
