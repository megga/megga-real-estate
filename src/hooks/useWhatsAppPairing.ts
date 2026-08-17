// src/hooks/useWhatsAppPairing.ts
// Statut du lien WhatsApp de l'agent courant, numéro Business auquel écrire,
// génération d'un code d'appairage et déliaison.
// RLS : l'agent ne voit que sa propre ligne (policy wa_agent_links_self_read).
//
// ⚠ Depuis la migration 20260817133200, la table est en LECTURE SEULE côté client :
// toute écriture passe par une RPC SECURITY DEFINER. C'est ce qui rend la
// vérification opposable — avant, un UPDATE direct suffisait à se déclarer vérifié.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { MEGGA_WA_BUSINESS_DIGITS } from '@/lib/whatsappBusiness'

export interface WhatsAppLinkStatus {
  verified: boolean
  wa_number: string | null
  pairing_code: string | null
  pairing_expires_at: string | null
  /** Numéro REVENDIQUÉ par la vérification en cours — pas encore prouvé. */
  pending_number: string | null
  otp_expires_at: string | null
  otp_attempts: number
}

/**
 * Statut du lien WhatsApp de l'agent (`status`), numéro Business à composer
 * (`businessNumber`, chiffres seuls), génération d'un code d'appairage
 * (`generateCode`, RPC `generate_whatsapp_pairing_code`) et déliaison (`unlink`,
 * RPC `unlink_whatsapp_number`). Les mutations invalident le statut.
 */
export function useWhatsAppPairing(options?: { enabled?: boolean }) {
  const qc = useQueryClient()
  // Même convention que useAgentProfileScreen / useAgencySettings : les écrans de
  // démonstration montent les mêmes composants hors session, et une requête qui part
  // en anon ne rend pas une erreur mais un `null` — donc un « non vérifié » silencieux
  // impossible à distinguer d'un vrai. Mieux vaut ne pas la lancer.
  const enabled = options?.enabled ?? true

  const status = useQuery({
    queryKey: ['whatsapp-agent-link'],
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<WhatsAppLinkStatus | null> => {
      const { data, error } = await supabase
        .from('whatsapp_agent_links')
        // ⚠ `otp_hash` est ABSENT, et pas par oubli : la migration 20260817133939 le
        // retire du GRANT colonne. Le demander ferait échouer la requête entière.
        .select('verified, wa_number, pairing_code, pairing_expires_at, pending_number, otp_expires_at, otp_attempts')
        .maybeSingle()
      if (error) throw error
      return (data as WhatsAppLinkStatus | null) ?? null
    },
  })

  // Numéro Business de l'agence, quand elle en a un déclaré. La RLS de
  // `agency_wa_numbers` borne déjà la lecture à l'agence de l'agent — aucun filtre
  // client à écrire, et rien à voir des autres tenants.
  //
  // `created_at DESC` : au pilote une agence n'a qu'un numéro, mais le jour où elle en
  // enregistre un nouveau (bascule de portefeuille Meta), c'est le DERNIER inscrit qui
  // reçoit. Prendre le premier ferait revivre exactement le bug qu'on corrige.
  //
  // Repli sur la constante de plateforme : le pilote tourne sur un numéro MEGGA
  // PARTAGÉ, et aucune des agences réelles n'a de ligne dans ce registre — le
  // registre sert le routage multi-tenant à venir, pas l'affichage d'aujourd'hui.
  const business = useQuery({
    queryKey: ['whatsapp-business-number'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('agency_wa_numbers')
        .select('wa_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      const own = (data as { wa_number: string } | null)?.wa_number
      const digits = (own ?? '').replace(/\D/g, '')
      return digits || MEGGA_WA_BUSINESS_DIGITS
    },
  })

  const generateCode = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('generate_whatsapp_pairing_code')
      if (error) throw error
      return (data as string) ?? ''
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-agent-link'] }) },
  })

  const unlink = useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('unlink_whatsapp_number')
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-agent-link'] }) },
  })

  // ── Vérification par code ENVOYÉ (l'agent saisit son numéro) ────────────────
  // Chemin ALTERNATIF à l'appairage, et volontairement second : il dépend d'un template
  // Meta approuvé, alors que l'appairage ne dépend de rien. Tant que le template n'est
  // pas posé, `startVerification` échoue en `template_not_configured` et l'UI retombe
  // sur l'appairage — c'est un repli prévu, pas une panne.
  const startVerification = useMutation({
    mutationFn: async (number: string): Promise<void> => {
      const { data, error } = await supabase.functions.invoke('whatsapp-verify-number', {
        body: { number },
      })
      // ⚠ `error` ne suffit pas : `functions.invoke` remonte bien les statuts ≥ 400 en
      // erreur, mais le CORPS porte le motif métier (`number_taken`, `rate_limited`,
      // `template_not_configured`) et c'est LUI que l'écran doit montrer. Sans ce
      // déballage, tous les refus se ressemblent — « une erreur est survenue ».
      const motif = (data as { error?: string } | null)?.error
      if (motif) throw new Error(motif)
      if (error) {
        const corps = await (error as { context?: { json?: () => Promise<unknown> } })
          .context?.json?.().catch(() => null)
        throw new Error((corps as { error?: string } | null)?.error ?? error.message)
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-agent-link'] }) },
  })

  const confirmVerification = useMutation({
    mutationFn: async (code: string): Promise<void> => {
      const { data, error } = await supabase.rpc('confirm_whatsapp_number_verification', {
        p_code: code,
      })
      if (error) throw error
      // La RPC rend un verdict, pas une exception : un mauvais code est un fait normal,
      // pas une panne. C'est `ok` qui décide, jamais l'absence d'`error`.
      const row = (data as { ok: boolean; reason: string }[] | null)?.[0]
      if (!row?.ok) throw new Error(row?.reason ?? 'unknown')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-agent-link'] }) },
  })

  return {
    status,
    generateCode,
    unlink,
    startVerification,
    confirmVerification,
    /** Chiffres seuls (format wa.me). Jamais vide : repli sur la constante plateforme. */
    businessNumber: business.data ?? MEGGA_WA_BUSINESS_DIGITS,
  }
}
