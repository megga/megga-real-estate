/**
 * État de consentement WhatsApp d'un contact, tel que l'agent doit le voir.
 *
 * POURQUOI UN HOOK À PART, alors que `contacts` porte déjà quatre colonnes de cache : ces
 * colonnes disent QUE le contact n'est pas joignable, jamais POURQUOI ni DEPUIS QUAND. Or un
 * agent à qui l'on grise une action sans motif réessaie, puis contourne. Le motif vit dans
 * `contact_suppressions.reason` et l'historique dans `whatsapp_consents` — deux lectures que
 * la fiche ne fait qu'à l'ouverture, pas à chaque rendu de liste.
 *
 * ⚠ Le cache de `contacts` n'est JAMAIS la source de vérité d'un envoi : la garde interroge
 * le registre. Ici il ne sert qu'à afficher, ce pour quoi il a été posé.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Ce qui a bloqué le numéro. Le domaine SQL de `contact_suppressions.reason`. */
export type SuppressionReason = 'stop_keyword' | 'meta_block' | 'agent_manual' | 'bounce_hard'

export interface ConsentEntry {
  id: string
  createdAt: string
  event: 'opt_in' | 'opt_out'
  source: string
  scope: string
  purpose: string
  legalBasis: string
}

export interface ContactConsentState {
  /** Un blocage ACTIF existe sur ce numéro (tous canaux confondus). */
  suppressed: boolean
  /** Origine du blocage actif. `stop_keyword`/`meta_block` = la PERSONNE a demandé. */
  reason: SuppressionReason | null
  /** Date du blocage actif. */
  suppressedAt: string | null
  /** Canal bloqué : 'whatsapp' | 'email' | 'all'. */
  channel: string | null
  /** L'accusé de désinscription est parti (il porte l'avis LPD). */
  ackSentAt: string | null
  /** Journal, du plus récent au plus ancien. */
  journal: ConsentEntry[]
}

const EMPTY: ContactConsentState = {
  suppressed: false, reason: null, suppressedAt: null, channel: null, ackSentAt: null, journal: [],
}

export function contactConsentKey(contactId: string | undefined) {
  return ['contact-consent', contactId ?? ''] as const
}

/**
 * Lit le blocage actif et le journal.
 *
 * La RLS fait le tri : `cs_select_agency` ne rend la ligne que si le contact appartient à
 * l'agence. Un numéro bloqué chez quelqu'un d'autre reste donc invisible — c'est voulu, et
 * c'est la même frontière que `publicReason` côté garde d'envoi : dire à l'agence B qu'un
 * numéro a écrit STOP à l'agence A serait un oracle sur le fichier des autres.
 */
export function useContactConsent(contactId: string | undefined) {
  return useQuery({
    queryKey: contactConsentKey(contactId),
    enabled: !!contactId,
    queryFn: async (): Promise<ContactConsentState> => {
      if (!contactId) return EMPTY
      const [sup, log] = await Promise.all([
        supabase
          .from('contact_suppressions')
          .select('reason, created_at, channel, ack_sent_at')
          .eq('contact_id', contactId)
          .is('lifted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('whatsapp_consents')
          .select('id, created_at, event, source, scope, purpose, legal_basis')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      // Une erreur de lecture n'est PAS « pas de blocage » : la fiche préfère ne rien
      // affirmer plutôt qu'affirmer « contactable » sur une lecture ratée.
      if (sup.error) throw new Error(sup.error.message)
      const row = sup.data as
        { reason: string; created_at: string; channel: string; ack_sent_at: string | null } | null
      return {
        suppressed: !!row,
        reason: (row?.reason as SuppressionReason | undefined) ?? null,
        suppressedAt: row?.created_at ?? null,
        channel: row?.channel ?? null,
        ackSentAt: row?.ack_sent_at ?? null,
        journal: ((log.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          id: String(r.id),
          createdAt: String(r.created_at),
          event: r.event === 'opt_in' ? 'opt_in' : 'opt_out',
          source: String(r.source),
          scope: String(r.scope),
          purpose: String(r.purpose),
          legalBasis: String(r.legal_basis),
        })),
      }
    },
  })
}

/**
 * Geste « ne plus contacter » de la fiche.
 *
 * ⛔ Passe par `record_whatsapp_consent`, jamais par un INSERT direct — les GRANTs
 * d'écriture sont révoqués, et c'est la RPC qui applique les EFFETS dans la même
 * transaction : blocage du numéro, suggestions de relance écartées, rappels WhatsApp
 * annulés, action stashée supprimée, cache de la fiche recalculé.
 *
 * ⚠ `agent_manual` est le seul `source` qu'un agent puisse écrire, et la RPC le vérifie :
 * un opt-IN fabriqué depuis le CRM lèverait 42501. C'est ce qui empêche de contourner le
 * double opt-in d'un clic.
 */
export function useSetDoNotContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { contactId: string; phone: string }) => {
      const { error } = await supabase.rpc('record_whatsapp_consent', {
        p_kind: 'contact',
        p_wa_phone: v.phone,
        p_event: 'opt_out',
        p_source: 'agent_manual',
        p_contact_id: v.contactId,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: contactConsentKey(v.contactId) })
      // Le cache `contacts` a bougé (wa_opt_in, wa_opt_out_at, wa_suppressed) : la fiche et
      // la liste le lisent toutes deux.
      void qc.invalidateQueries({ queryKey: ['contacts'] })
      void qc.invalidateQueries({ queryKey: ['contacts-sugar'] })
    },
  })
}
