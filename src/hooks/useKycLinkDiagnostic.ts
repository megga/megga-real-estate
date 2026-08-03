/**
 * Hooks du diagnostic de lien KYC (§5.5) — recherche et demande de réémission.
 *
 * ⚠ Deux MUTATIONS, jamais un `useQuery` : le résultat est NOMINATIF (nom,
 * e-mail, téléphone d'un client final). Un cache React Query le conserverait
 * après la fermeture de la modale, en violation directe de la clause de
 * rétention zéro du handoff. Une mutation ne garde rien au-delà de son appel.
 */
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  readKycLookup,
  readKycRegenerate,
  type KycLookupResult,
  type KycRegenerateResult,
} from '@/lib/kycDiagnostic'

export interface KycLookupInput {
  agencyId: string
  ref: string
  query: string
}

/** Recherche gardée par un motif obligatoire, plafonnée à 3 correspondances côté serveur. */
export function useKycLinkLookup() {
  return useMutation({
    mutationFn: async (input: KycLookupInput): Promise<KycLookupResult> => {
      const { data, error } = await supabase.rpc('admin_kyc_link_lookup', {
        p_motive_agency_id: input.agencyId,
        p_motive_ref: input.ref,
        p_query: input.query,
      })
      // La garde de rang LÈVE (42501) ; les refus MÉTIER reviennent en enveloppe
      // dans `data`. Les deux chemins existent et ne se confondent pas.
      if (error) throw error
      return readKycLookup(data)
    },
  })
}

export interface KycRegenerateInput {
  linkId: string
  agencyId: string
  ref: string
  /** Rejouée à l'identique sur réessai : deux clics ne doivent pas déposer deux jobs. */
  idempotencyKey: string
}

/** Demande de réémission. Ne réémet RIEN elle-même : elle dépose un job d'outbox. */
export function useKycLinkRegenerate() {
  return useMutation({
    mutationFn: async (input: KycRegenerateInput): Promise<KycRegenerateResult> => {
      const { data, error } = await supabase.rpc('admin_kyc_link_regenerate', {
        p_link_id: input.linkId,
        p_motive_agency_id: input.agencyId,
        p_motive_ref: input.ref,
        p_idempotency_key: input.idempotencyKey,
      })
      if (error) throw error
      return readKycRegenerate(data)
    },
  })
}
