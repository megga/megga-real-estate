// supabase/functions/_shared/relance-email-send.ts
//
// L'ENVOI d'une relance — validation, garde de sortie, gabarit, Resend — partagé par ses
// deux portes d'entrée :
//   · `send-relance-email`, l'edge du CRM, sous le JWT d'un agent (`requireAgentAuth`) ;
//   · `executeSendClientEmail` (_shared/whatsapp-actions.ts), le « oui » de l'agent à un
//     e-mail que le copilote WhatsApp a rédigé, exécuté par `whatsapp-webhook` sous le lien
//     WhatsApp vérifié.
// Le gabarit, lui, reste pur dans `relance-email.ts` : le banc de rendu le charge sans Deno.
//
// ⛔ POURQUOI UN MODULE, ET PLUS UN APPEL DE FONCTION À FONCTION. Jusqu'au 14.09.2026,
// l'exécuteur WhatsApp appelait l'edge `send-relance-email` sous la clé de SERVICE. Or elle
// exige un JWT d'AGENT, et `requireAgentAuth` refuse toute clé d'API (`isNonUserToken`) :
// 401 à chaque « oui », rattrapé en `emailSent = false`. Aucune relance post-oui n'est
// jamais partie ; l'agent lisait « L'email n'est pas parti (Invalid or expired session) »,
// une erreur de session qui n'était pas la sienne, et rien d'autre ne le signalait. Ouvrir
// l'edge à la clé de service n'était pas le correctif : il aurait fallu y croire l'agence
// lue dans le CORPS — le relais ouvert S1. L'exécuteur appelle donc ce module en direct,
// avec l'agence et l'agent de son contexte VÉRIFIÉ.
//
// L'ordre est celui de `guardOutboundEmail` (_shared/email-recipient.ts) : périmètre →
// suppression → quota, puis Resend. Bancs : relance-email-send.test.ts (l'ordre, les refus,
// la porte WhatsApp) et tests/unit/email-senders-scope.spec.ts (la source des deux portes).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildRelanceEmail } from './relance-email.ts'
import { unsubscribeHeaders, unsubscribeFooterHtml } from './email-guard.ts'
import { guardOutboundEmail, type OutboundEmailCaller, type OutboundEmailSender } from './email-recipient.ts'
import { bienDansMessage } from './message-sans-bien.ts'

/** Ce que l'agent a écrit ou validé : objet et corps libres. */
export interface RelanceEmail {
  to: string
  subject: string
  body: string
  agentName?: string | null
  /** Signature multiligne de l'agent, si elle est configurée. */
  agentSignature?: string | null
  /** Rattachement analytique (tag Resend `lead_id`) — n'autorise rien. */
  leadId?: string | null
}

/**
 * L'appelant, déjà VÉRIFIÉ par sa porte d'entrée : son agence juge le périmètre et porte le
 * quota, `sender` est la fonction edge qui envoie (journalisée dans email_send_log).
 */
export interface RelanceCaller extends OutboundEmailCaller {
  sender: OutboundEmailSender
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(status: number, body: Record<string, unknown>, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Envoie une relance, ou dit pourquoi elle ne part pas. Rend la réponse HTTP que l'edge
 * renvoie telle quelle — et que l'exécuteur WhatsApp lit comme il lisait l'appel HTTP :
 * mêmes statuts, mêmes corps (`{ error }`, plus `message` ou `blocked` sur un refus de la
 * garde). Une panne réseau ou un corps Resend illisible LÈVE : chaque porte a son `catch`.
 *
 * `signal` borne l'appel à Resend (l'exécuteur WhatsApp attend sa réponse pour la dire à
 * l'agent) ; l'edge du CRM n'en pose pas.
 */
export async function sendRelanceEmail(
  admin: SupabaseClient,
  caller: RelanceCaller,
  relance: RelanceEmail,
  corsHeaders: Record<string, string> = {},
  options: { signal?: AbortSignal } = {},
): Promise<Response> {
  if (!relance.to || !relance.subject || !relance.body) {
    return json(400, { error: 'to, subject and body are required' }, corsHeaders)
  }
  if (!EMAIL_REGEX.test(relance.to)) {
    return json(400, { error: 'Invalid email address' }, corsHeaders)
  }
  // ⛔ AUCUN BIEN DANS UNE RELANCE (21.09.2026) : le matching reste chez l'agent. Les deux portes
  // de ce module portent un texte que le copilote a pu rédiger (`send_client_email`, et la relance
  // d'« Aujourd'hui », brouillon de `draft_email`) : un lien d'annonce, une fiche de bien MEGGA ou une
  // référence MG-… ne part pas, même validé par l'agent. Vérifié AVANT la garde de sortie : un
  // refus de contenu ne consomme pas le quota. `message-sans-bien.ts` dit ce qui passe.
  if (bienDansMessage(relance.subject, relance.body)) {
    return json(422, {
      error: 'property_in_message',
      message: "Rien n'est parti : ce message contient un bien (lien d'annonce ou référence MG-…). Le matching reste chez l'agent, qui présente le bien lui-même.",
    }, corsHeaders)
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) {
    return json(500, { error: 'RESEND_API_KEY not configured' }, corsHeaders)
  }

  // ⛔ GARDE DE SORTIE (13.09.2026) : périmètre → suppression → quota.
  //   · PÉRIMÈTRE — le destinataire doit être connu de l'agence de l'appelant. Avant, `to`
  //     était libre derrière un jeton d'agent gratuit : un relais ouvert signé DKIM.
  //   · SUPPRESSION — une relance est un envoi que NOUS initions : un STOP reçu sur
  //     WhatsApp (channel='all') la bloque, tout comme un clic « se désinscrire » sur un
  //     e-mail précédent.
  //   · QUOTA — 60/h, 300/j par agence, réglable dans app_config.email_send_caps. L'acteur
  //     journalisé est l'AGENT, sur les deux portes.
  const refus = await guardOutboundEmail(
    admin,
    { agencyId: caller.agencyId, actorId: caller.actorId },
    { to: relance.to, purpose: 'relance', sender: caller.sender },
    corsHeaders,
  )
  if (refus) return refus

  const unsub = await unsubscribeHeaders(relance.to)
  const { html } = buildRelanceEmail({
    subject: relance.subject,
    body: relance.body,
    agentName: relance.agentName,
    agentSignature: relance.agentSignature,
    unsubscribeHtml: unsub ? unsubscribeFooterHtml(unsub.url) : undefined,
  })

  const tags = [
    { name: 'kind', value: 'relance' },
    ...(relance.leadId ? [{ name: 'lead_id', value: relance.leadId }] : []),
    // L'agence de l'appelant vérifié, jamais celle d'un corps de requête.
    { name: 'agency_id', value: caller.agencyId },
  ]

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'MEGGA Immobilier <noreply@getmegga.com>',
      to: [relance.to],
      subject: relance.subject,
      html,
      tags,
      // `List-Unsubscribe` + one-click : ce que Gmail et Outlook ATTENDENT. Leur absence
      // pèse sur la délivrabilité de tout le domaine, pas seulement de ce message.
      ...(unsub ? { headers: unsub.headers } : {}),
    }),
    ...(options.signal ? { signal: options.signal } : {}),
  })

  const resendData = await resendResponse.json() as { id?: string; message?: string }

  if (!resendResponse.ok) {
    return json(resendResponse.status, {
      error: resendData.message ?? 'Resend API error',
      details: resendData,
    }, corsHeaders)
  }

  return json(200, { success: true, emailId: resendData.id, to: relance.to }, corsHeaders)
}
