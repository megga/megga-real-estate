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
import { useAuth } from '@/hooks/useAuth'
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
  const { profile: authProfile } = useAuth()
  const profileId = authProfile?.id
  // Même convention que useAgentProfileScreen / useAgencySettings : les écrans de
  // démonstration montent les mêmes composants hors session, et une requête qui part
  // en anon ne rend pas une erreur mais un `null` — donc un « non vérifié » silencieux
  // impossible à distinguer d'un vrai. Mieux vaut ne pas la lancer.
  const enabled = (options?.enabled ?? true) && !!profileId

  // ⛔ `profileId` DANS LA CLÉ, et ce n'est pas cosmétique. Les clés étaient globales
  // (`['whatsapp-agent-link']` nu) alors que la déconnexion NE VIDE PAS le cache React
  // Query — `handleSignOut` (useAuth.tsx) remet session/profile à null et appelle
  // `supabase.auth.signOut()`, rien de plus ; aucun `clear()`/`removeQueries` n'existe
  // dans tout `src/`. Sur un poste d'agence PARTAGÉ, l'agent B qui ouvrait Réglages après
  // l'agent A recevait donc, au premier rendu et pendant tout le `staleTime`, le numéro
  // masqué de A et son état « Lié ». La même donnée alimente la ligne « Numéro WhatsApp »
  // du Profil. `useAgentProfileScreen` s'en gardait déjà par `['agent-profile', profileId]`.
  //
  // ⚠ Les invalidations restent écrites SANS l'id : React Query fait un appariement par
  // PRÉFIXE, donc `['whatsapp-agent-link']` couvre `['whatsapp-agent-link', <id>]`.
  const status = useQuery({
    queryKey: ['whatsapp-agent-link', profileId],
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

  // Numéro Business de l'agence, quand elle en a un déclaré.
  //
  // ⛔ LE FILTRE D'AGENCE EST EXPLICITE, ET SON ABSENCE A RESSUSCITÉ LE NUMÉRO MORT.
  // La version précédente s'en remettait à la RLS : « elle borne déjà la lecture à
  // l'agence de l'agent, aucun filtre client à écrire ». C'est faux pour un rôle dont la
  // policy est plus large. `agency_wa_numbers` en porte DEUX : `…_agency_select`
  // (agency_id = get_my_agency_id()) et `…_super_admin_all` (FOR ALL, is_super_admin()).
  // Un super-admin voit donc TOUTES les lignes, et `created_at DESC LIMIT 1` lui rendait
  // celle d'une autre agence — en l'occurrence la seule du registre, qui porte le numéro
  // pilote décommissionné le 14.08. L'écran lui demandait d'envoyer son code à un numéro
  // qui ne reçoit plus, c'est-à-dire exactement le défaut que cette série corrigeait.
  // Mesuré le 17.08.2026 sur `hello@juarts.com` (super_admin, agence NULL).
  //
  // La leçon : **la RLS est un PLANCHER, pas un filtre.** Elle garantit qu'on ne voit pas
  // TROP ; elle ne garantit pas qu'on voit ce qu'on croit. Une requête « ma ligne » doit
  // dire laquelle.
  //
  // ⚠ Agence NULL (le cas du super-admin) : on ne cherche RIEN et on prend la constante.
  // Interroger sans filtre lui rendrait la ligne d'un tenant au hasard.
  //
  // `created_at DESC` : au pilote une agence n'a qu'un numéro, mais le jour où elle en
  // enregistre un nouveau (bascule de portefeuille Meta), c'est le DERNIER inscrit qui
  // reçoit. Prendre le premier ferait revivre le même bug par l'autre bout.
  const agencyId = authProfile?.agency_id ?? null
  const business = useQuery({
    // La valeur dépend de l'AGENCE, pas seulement du profil : deux agents d'agences
    // différentes ne doivent pas se partager une entrée de cache.
    queryKey: ['whatsapp-business-number', agencyId],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string> => {
      if (!agencyId) return MEGGA_WA_BUSINESS_DIGITS
      const { data, error } = await supabase
        .from('agency_wa_numbers')
        .select('wa_number')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      const own = (data as { wa_number: string } | null)?.wa_number
      const digits = (own ?? '').replace(/\D/g, '')
      return digits || MEGGA_WA_BUSINESS_DIGITS
    },
  })

  // La voie OTP est-elle ARMÉE ? Seule la fonction edge le sait — le nom du template
  // approuvé vit dans son env. Sans cette sonde, la carte peignait la saisie de numéro en
  // affordance primaire et l'agent découvrait après le clic qu'elle n'est pas activée.
  //
  // ⚠ Repli sur `false` en cas d'échec : mieux vaut proposer l'appairage — qui marche
  // toujours — que d'ouvrir une voie dont on ne sait pas si elle mène quelque part.
  // `retry: false` parce qu'une capacité absente n'est pas une panne à réessayer.
  // ⚠ TRI-ÉTAT, et pas un booléen. La première version rendait `false` aussi bien quand la
  // capacité est éteinte que quand la SONDE a échoué — deux faits très différents réduits
  // au même écran vide. L'agent qui vient de poser le secret et ne voit toujours rien n'a
  // alors aucun moyen de savoir s'il s'est trompé de nom, si la fonction n'est pas
  // déployée, ou si tout va bien et que c'est autre chose. Le silence ressemblait à une
  // réponse.
  const otpDispo = useQuery({
    queryKey: ['whatsapp-otp-available', profileId],
    enabled,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async (): Promise<'available' | 'unavailable'> => {
      const { data, error } = await supabase.functions.invoke('whatsapp-verify-number', {
        body: { action: 'status' },
      })
      // Un 501 `template_not_configured` remonte en `error` avec un corps lisible : c'est
      // une réponse, pas une panne. On la déballe pour ne pas la confondre avec un échec.
      if (error) {
        const corps = await (error as { context?: { json?: () => Promise<unknown> } })
          .context?.json?.().catch(() => null)
        const motif = (corps as { error?: string } | null)?.error
        if (motif === 'template_not_configured') return 'unavailable'
        throw error
      }
      return (data as { otp_available?: boolean } | null)?.otp_available === true
        ? 'available'
        : 'unavailable'
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

  // ⚠ Les DEUX gestes qui touchent `profiles.phone` invalident aussi le PROFIL. La
  // déliaison l'efface directement, la confirmation le réécrit par le trigger
  // `trg_sync_profile_phone_from_wa_link` — dans les deux cas la base change sous une
  // query (`['agent-profile', profileId]`, staleTime 60 s) que rien ne prévenait. Pendant
  // une minute, `profileCompletionScore` comptait donc l'ancien numéro et tout lecteur de
  // `profile.phone` servait une valeur déjà périmée.
  const invalideLienEtProfil = () => {
    qc.invalidateQueries({ queryKey: ['whatsapp-agent-link'] })
    qc.invalidateQueries({ queryKey: ['agent-profile'] })
  }

  const unlink = useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('unlink_whatsapp_number')
      if (error) throw error
    },
    onSuccess: invalideLienEtProfil,
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

  // Annuler ≠ délier, et les confondre coûtait cher : le bouton « Annuler » de l'écran
  // OTP appelait `unlink`, qui SUPPRIMAIT la ligne — donc le compteur d'envois avec elle.
  // Saisir un numéro, envoyer, annuler, recommencer donnait des envois illimités vers un
  // numéro arbitraire. Ici on abandonne le code en vol, rien d'autre : aucune preuve
  // acquise n'est retirée, `profiles.phone` n'est pas touché, et le jeton reste consommé
  // puisque le message est bel et bien parti.
  const cancelVerification = useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('cancel_whatsapp_number_verification')
      if (error) throw error
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
    // ⚠ `onSettled` et NON `onSuccess`, et l'écart est visible à l'écran : un code REFUSÉ
    // lève (donc passe par onError), alors qu'il vient d'INCRÉMENTER `otp_attempts` en
    // base. Avec `onSuccess`, le compteur d'essais restants n'aurait été rafraîchi qu'au
    // succès — c'est-à-dire jamais, puisqu'au succès l'écran disparaît. Il aurait affiché
    // un nombre périmé exactement quand il compte, à un essai du mur.
    onSettled: invalideLienEtProfil,
  })

  return {
    status,
    generateCode,
    unlink,
    startVerification,
    confirmVerification,
    cancelVerification,
    /** Chiffres seuls (format wa.me). Jamais vide : repli sur la constante plateforme. */
    businessNumber: business.data ?? MEGGA_WA_BUSINESS_DIGITS,
    /**
     * La voie « recevoir un code » est-elle activée ?
     *
     * ⚠ TROIS ÉTATS, et le troisième n'est pas un détail de typage. Ce champ rendait un
     * booléen — `otpDispo.data === 'available'` — qui écrasait « pas encore su » sur
     * « non ». Tant qu'il ne servait qu'à masquer un bloc, l'amalgame passait ; il ne
     * passe plus depuis que l'écran AVERTIT au lieu de cacher, parce qu'un `false`
     * pendant le chargement affiche « capacité non activée » une seconde, puis se
     * dédit. `null` = on ne sait pas encore (ou la sonde a échoué), et l'écran se tait.
     */
    otpAvailable: otpDispo.data === undefined ? null : otpDispo.data === 'available',
    /**
     * La sonde n'a pas pu conclure (fonction absente, réseau, erreur inattendue). À
     * distinguer d'une capacité simplement éteinte : ici on ne SAIT pas, et l'écran doit
     * le dire plutôt que de faire disparaître la voie sans un mot.
     */
    otpProbeFailed: otpDispo.isError,
  }
}
