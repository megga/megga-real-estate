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

export interface PendingInvite {
  id: string
  createdAt: string
  expiresAt: string
  lang: string
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
  /** La dernière déclaration est un consentement. */
  optedIn: boolean
  /** Invitation ENVOYÉE, ni consommée ni expirée. Empêche d'inviter en boucle. */
  pendingInvite: PendingInvite | null
}

const EMPTY: ContactConsentState = {
  suppressed: false, reason: null, suppressedAt: null, channel: null, ackSentAt: null,
  journal: [], optedIn: false, pendingInvite: null,
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
      const [sup, log, inv] = await Promise.all([
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
        supabase
          .from('whatsapp_optin_invites')
          .select('id, created_at, expires_at, lang')
          .eq('contact_id', contactId)
          .is('consumed_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      // Une erreur de lecture n'est PAS « pas de blocage » : la fiche préfère ne rien
      // affirmer plutôt qu'affirmer « contactable » sur une lecture ratée.
      //
      // ⛔ LES TROIS, et la doctrine ne vaut que si elle vaut pour les trois. Un timeout sur
      // `whatsapp_optin_invites` rendait `pendingInvite: null` : la carte réaffichait le
      // bouton et l'agent envoyait une SECONDE invitation — deux liens vivants pour la même
      // personne, donc un consentement qu'on ne saurait plus attribuer. Un échec sur
      // `whatsapp_consents` rendait `optedIn: false` : on proposait d'inviter quelqu'un qui
      // avait déjà consenti.
      if (sup.error) throw new Error(sup.error.message)
      if (log.error) throw new Error(log.error.message)
      if (inv.error) throw new Error(inv.error.message)
      const row = sup.data as
        { reason: string; created_at: string; channel: string; ack_sent_at: string | null } | null
      const invRow = inv.data as Record<string, unknown> | null
      const journal: ConsentEntry[] = ((log.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        createdAt: String(r.created_at),
        event: r.event === 'opt_in' ? 'opt_in' : 'opt_out',
        source: String(r.source),
        scope: String(r.scope),
        purpose: String(r.purpose),
        legalBasis: String(r.legal_basis),
      }))
      return {
        suppressed: !!row,
        reason: (row?.reason as SuppressionReason | undefined) ?? null,
        suppressedAt: row?.created_at ?? null,
        channel: row?.channel ?? null,
        ackSentAt: row?.ack_sent_at ?? null,
        journal,
        // La DERNIÈRE déclaration décide — même règle que `whatsapp_send_allowed`. Compter
        // les opt-in ferait dire « consenti » à quelqu'un qui a accepté puis refusé.
        optedIn: journal[0]?.event === 'opt_in',
        pendingInvite: invRow
          ? {
              id: String(invRow.id), createdAt: String(invRow.created_at),
              expiresAt: String(invRow.expires_at), lang: String(invRow.lang),
            }
          : null,
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

/**
 * Motif MÉTIER d'un refus d'edge function.
 *
 * ⛔ `functions.invoke` range TOUTE réponse non-2xx dans `error` — un `FunctionsHttpError`
 * dont le `message` est le même pour tous les codes (« Edge Function returned a non-2xx
 * status code ») — et laisse `data` à `null`. Le motif ne vit donc que dans le CORPS de la
 * réponse, exposé par `supabase-js` sur `error.context`, qui est la `Response` brute.
 *
 * Sans cette lecture, la carte cherchait `fiche.consent.inviteError.<message générique>`,
 * ne trouvait rien et retombait sur le texte passe-partout : les cinq motifs traduits
 * étaient inatteignables, ce qui est l'inverse du but de la carte.
 */
async function readInvokeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | undefined)?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const reason = ((await ctx.json()) as { error?: unknown } | null)?.error
      if (typeof reason === 'string' && reason) return reason
    } catch {
      // Corps non-JSON : un 502 de passerelle, une page d'erreur. Le message générique
      // reste alors la meilleure information disponible.
    }
  }
  return (error as { message?: string } | undefined)?.message || 'optin_invite_failed'
}

/**
 * Envoie l'invitation d'opt-in par e-mail (`click_to_wa`).
 *
 * ⛔ L'edge function fait TOUT : elle crée l'invitation, signe le jeton et envoie le mail.
 * Le jeton n'est jamais rendu ici — un agent qui pourrait se le faire remettre pourrait
 * fabriquer le consentement du contact depuis son propre téléphone.
 */
export function useSendOptinInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { contactId: string }) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-optin-invite', {
        body: { contact_id: v.contactId },
      })
      // Les refus MÉTIER (numéro bloqué, contact sans e-mail, numéro Business non
      // enregistré) reviennent en 4xx avec un corps : c'est `readInvokeError` qui l'ouvre.
      if (error) throw new Error(await readInvokeError(error))
      const d = data as { ok?: boolean; error?: string } | null
      // Ceinture et bretelles : une edge qui rendrait 200 avec `{ ok: false }` ne doit pas
      // faire dire « envoyé » alors que rien n'est parti.
      if (!d?.ok) throw new Error(d?.error || 'optin_invite_failed')
      return d
    },
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: contactConsentKey(v.contactId) })
    },
  })
}
