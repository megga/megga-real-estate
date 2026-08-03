/**
 * Hook super-admin — la fiche agence en UN appel (`get_admin_agency_detail`).
 *
 * La RPC était déployée, testée (`tests/backend/admin-console-read-views.spec.ts`)
 * et **consommée nulle part** : la fiche faisait six allers-retours là où le
 * serveur assemble déjà tout. Elle embarque même l'usage consolidé
 * (`get_admin_agency_usage`), qu'elle recalcule à chaque ouverture — le jeter
 * côté écran coûterait le calcul sans en tirer la valeur.
 *
 * ⚠ `agency` est la ligne du REGISTRE (`get_admin_agencies`), pas la ligne
 * `agencies` : elle porte les compteurs et le MRR, mais ni l'identité légale ni
 * l'adresse. C'est voulu — la fiche mesure l'usage de la plateforme, pas le
 * contenu du CRM.
 *
 * ⚠ La RPC est déclarée `Returns: Json` : le générateur de types ne sait pas
 * l'affiner, donc les interfaces ci-dessous sont écrites à la main et **aucune
 * vérification de forme n'existe côté client**. Un renommage serveur passerait
 * `tsc` sans un bruit ; la porte de fraîcheur des types ne le verrait pas non
 * plus (elle compare des présences, pas des formes).
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Ligne de registre. Nullabilité relevée en production, pas déduite des types générés. */
export interface AgencyDetailRow {
  id: string
  name: string
  email: string | null
  city: string | null
  canton: string | null
  plan: string | null
  agents: number
  properties: number
  deals: number
  mrr: number | string
  /** ⚠ `agencies.status` est NULLABLE en base : replier sur `active` à la lecture. */
  status: string | null
  sub: string | null
  score: number | null
  since: string
  last: string | null
  verification_status: string | null
  slug: string
  logo_url: string | null
  phone: string | null
  current_period_end: string | null
}

/** Usage de plateforme, servi par `get_admin_agency_usage` et embarqué par la RPC. */
export interface AgencyDetailUsage {
  active_properties?: number
  contacts_count?: number
  ai_cost_month_usd?: number | string
  ai_calls_month?: number
  wa_messages_month?: number
  storage_est_mb?: number | string
  last_activity_at?: string | null
}

export interface AgencyDetailMember {
  id: string
  name: string | null
  email: string | null
  role: string | null
  phone: string | null
  suspended: boolean
  since: string
  /** ⚠ Toujours `null` : la RPC filtre déjà `deleted_at is null`. Champ mort côté écran. */
  deleted_at: string | null
}

export interface AgencyDetailInvitation {
  id?: string
  email?: string
  role?: string
  status?: string
  created_at?: string
  expires_at?: string
}

/** ⚠ Amputé de `stripe_customer_id` / `_subscription_id` / `_price_id` par la RPC. */
export interface AgencyDetailSubscription {
  plan?: string | null
  status?: string | null
  billing_period?: string | null
  current_period_end?: string | null
  trial_end?: string | null
  last_invoice_status?: string | null
}

export interface AgencyDetailNote {
  note: string | null
  updated_at: string | null
  updated_by: string | null
}

export interface AgencyDetailPayload {
  found: boolean
  agency?: AgencyDetailRow
  usage?: AgencyDetailUsage
  team?: AgencyDetailMember[]
  invitations?: AgencyDetailInvitation[]
  subscription?: AgencyDetailSubscription | null
  note?: AgencyDetailNote | null
  activation?: Record<string, unknown> | null
}

export function useAdminAgencyDetail(id: string) {
  return useQuery({
    queryKey: ['admin-agency-detail', id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async (): Promise<AgencyDetailPayload> => {
      // La garde LÈVE (42501) au lieu de rendre une enveloppe : le refus arrive
      // dans `error`, jamais dans les données.
      const { data, error } = await supabase.rpc('get_admin_agency_detail', { p_agency_id: id })
      if (error) throw error
      return (data ?? { found: false }) as unknown as AgencyDetailPayload
    },
  })
}
