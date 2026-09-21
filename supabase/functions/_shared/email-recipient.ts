// supabase/functions/_shared/email-recipient.ts
//
// La garde de SORTIE des e-mails pilotés par un agent — ce qui ferme le relais ouvert.
//
// ⛔ CE QUE L'AUDIT DU 13.09.2026 A MESURÉ. `send-email`, `send-property-email` (retirée le
// 21.09.2026 : le matching reste chez l'agent) et `send-relance-email` acceptaient un `to`
// ARBITRAIRE derrière `requireAgentAuth`. Or un jeton d'agent est gratuit (l'inscription
// provisionne une agence solo) : n'importe qui faisait partir un e-mail signé DKIM par
// `noreply@getmegga.com` vers n'importe quel destinataire, sans limite — un gabarit
// d'hameçonnage à l'identité MEGGA. La porte `lint:edge-auth` était
// verte, parce qu'elle vérifie qu'une garde est IMPORTÉE, pas ce qu'elle laisse passer.
//
// Trois questions, dans cet ordre, et la première refusée arrête tout :
//   1. PÉRIMÈTRE — le destinataire est-il connu de l'agence de l'appelant (contact, lead
//      attribué, membre, adresse de l'agence) ? RPC `email_recipient_scope`. Sinon 403.
//   2. SUPPRESSION — la personne a-t-elle dit stop (registre par adresse et par contact) ?
//      C'est `emailSendAllowed`, déjà présente sur deux des trois expéditeurs. Sinon 409.
//   3. QUOTA — l'agence a-t-elle encore une place (60/h, 300/j par défaut) ? RPC
//      `email_send_quota_take`, qui PREND la place. Sinon 429.
// Une garde indisponible (RPC en erreur) REFUSE : ce sont des envois que nous initions,
// personne n'attend une réponse qu'un refus priverait.
//
// ⚠ Le périmètre passe AVANT la suppression : sinon un appelant testerait, adresse par
// adresse, qui s'est désinscrit — c'est l'oracle que `email_send_allowed` est réservé au
// service_role pour fermer.
//
// L'ordre périmètre → suppression → quota → Resend est gardé par
// tests/unit/email-senders-scope.spec.ts : sur la source de `send-email`, qui appelle
// Resend elle-même, et sur celle de
// `_shared/relance-email-send.ts`, l'envoi de relance que partagent `send-relance-email` et
// l'exécuteur WhatsApp (`executeSendClientEmail`, exécuté par `whatsapp-webhook`).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailSendAllowed, type EmailPurpose } from './email-guard.ts'

/** Ce qui rattache le destinataire à l'agence — ou rien. */
export type RecipientScope = 'contact' | 'lead' | 'member' | 'agency'

/**
 * La fonction edge qui envoie un e-mail piloté par un agent — journalisée dans email_send_log.
 * `whatsapp-webhook` exécute le « oui » de l'agent à une relance rédigée par le copilote
 * (`executeSendClientEmail` → `_shared/relance-email-send.ts`).
 */
export type OutboundEmailSender = 'send-email' | 'send-relance-email' | 'whatsapp-webhook'

export interface OutboundEmailCaller {
  /**
   * L'agence d'un appelant VÉRIFIÉ : `profile.agency_id` rendu par requireAgentAuth, ou celle
   * du lien WhatsApp vérifié (`ActionCtx.agencyId`) — jamais un identifiant du corps.
   */
  agencyId: string
  actorId: string
}

export interface OutboundEmailIntent {
  to: string
  purpose: EmailPurpose
  sender: OutboundEmailSender
}

export type QuotaVerdict =
  | { allowed: true; hour: number; day: number }
  | { allowed: false; reason: 'hourly_cap' | 'daily_cap' | 'no_agency' | 'quota_unavailable' }

/** Le destinataire appartient-il au fichier de l'agence ? `null` = inconnu, donc refusé. */
export async function recipientScope(
  admin: SupabaseClient,
  agencyId: string,
  to: string,
): Promise<RecipientScope | null> {
  const { data, error } = await admin.rpc('email_recipient_scope', {
    p_agency_id: agencyId, p_email: to,
  })
  if (error) throw new Error(error.message)
  return (data as RecipientScope | null) ?? null
}

/** Prend une place dans le quota de l'agence. Refuse fermé si la RPC est indisponible. */
export async function takeEmailQuota(
  admin: SupabaseClient,
  caller: OutboundEmailCaller,
  intent: OutboundEmailIntent,
): Promise<QuotaVerdict> {
  try {
    const { data, error } = await admin.rpc('email_send_quota_take', {
      p_agency_id: caller.agencyId,
      p_actor_id: caller.actorId,
      p_recipient: intent.to,
      p_purpose: intent.purpose,
      p_sender: intent.sender,
    })
    if (error) throw new Error(error.message)
    const v = (data as Array<{ allowed: boolean; reason: string; hour_count: number; day_count: number }> | null)?.[0]
    if (!v) throw new Error('verdict absent')
    if (v.allowed) return { allowed: true, hour: v.hour_count, day: v.day_count }
    const reason = v.reason === 'hourly_cap' || v.reason === 'daily_cap' || v.reason === 'no_agency'
      ? v.reason
      : 'quota_unavailable'
    return { allowed: false, reason }
  } catch (e) {
    console.error('email quota: verdict indisponible:', String((e as Error)?.message ?? 'error').slice(0, 120))
    return { allowed: false, reason: 'quota_unavailable' }
  }
}

function json(status: number, body: Record<string, unknown>, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Les trois questions, dans l'ordre. Rend `null` si l'envoi peut partir, sinon la réponse
 * HTTP à renvoyer telle quelle. La place de quota est prise au passage : appeler
 * IMMÉDIATEMENT avant l'appel Resend, jamais « pour voir ».
 */
export async function guardOutboundEmail(
  admin: SupabaseClient,
  caller: OutboundEmailCaller,
  intent: OutboundEmailIntent,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  // 1. Périmètre. Une RPC en erreur est traitée comme « inconnu » : refus.
  let scope: RecipientScope | null = null
  try {
    scope = await recipientScope(admin, caller.agencyId, intent.to)
  } catch (e) {
    console.error('email scope: verdict indisponible:', String((e as Error)?.message ?? 'error').slice(0, 120))
  }
  if (!scope) {
    return json(403, {
      error: 'recipient_out_of_scope',
      message: "Ce destinataire n'est ni un contact, ni un membre de votre agence. Créez d'abord la fiche contact.",
    }, corsHeaders)
  }

  // 2. Suppression — même forme de réponse qu'avant ce chantier ({ error, blocked: true }).
  const verdict = await emailSendAllowed(admin, { to: intent.to, purpose: intent.purpose })
  if (!verdict.allowed) {
    return json(409, { error: verdict.reason, blocked: true }, corsHeaders)
  }

  // 3. Quota.
  const quota = await takeEmailQuota(admin, caller, intent)
  if (!quota.allowed) {
    if (quota.reason === 'quota_unavailable') {
      return json(503, { error: 'quota_unavailable', message: "Le quota d'envoi n'a pas pu être vérifié. Réessayez dans un instant." }, corsHeaders)
    }
    return json(429, {
      error: quota.reason,
      message: quota.reason === 'hourly_cap'
        ? "Plafond horaire d'e-mails atteint pour votre agence. Réessayez dans une heure."
        : "Plafond quotidien d'e-mails atteint pour votre agence.",
    }, corsHeaders)
  }

  return null
}
