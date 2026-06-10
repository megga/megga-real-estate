// supabase/functions/whatsapp-send/index.ts
// WhatsApp Phase 2 — envoi sortant (outbound) depuis le CRM.
//
// Authentifié AGENT (requireAgentAuth) : seul un agent connecté de l'agence
// propriétaire de la conversation peut envoyer. Le provider est sélectionné via
// WHATSAPP_PROVIDER (meta par défaut). La requête HTTP est construite par la
// couche gateway (provider-agnostic), exécutée ici, puis le message est stocké
// dans whatsapp_messages (direction='outbound') + audité dans activity_events.
//
// Sécurité / compliance (cf. brain whatsapp-rls-security) :
//  - l'agent ne peut envoyer QUE vers un contact de SON agence (vérif via RLS
//    sur la lecture du contact avec le client authentifié) ;
//  - fenêtre 24h Meta : hors fenêtre, l'API Meta refuse le texte libre (erreur
//    131047) — on remonte l'erreur telle quelle (templates = sprint ultérieur).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { getProvider, normalizePhone, type SendConfig } from '../_shared/whatsapp-gateway.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SendBody {
  /** Contact CRM destinataire (source de vérité pour le numéro + l'agence). */
  contactId?: string
  /** Alternative : numéro brut (digits/international) si pas de contact. */
  toPhone?: string
  /** Corps du message texte. */
  body?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  // 1. Auth agent — profile.agency_id = seule identité d'agence de confiance.
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { profile, supabase } = auth // supabase = client service-role (déjà créé)

  // 2. Payload
  let input: SendBody
  try { input = await req.json() } catch {
    return json({ error: 'Bad JSON' }, 400)
  }
  const text = (input.body ?? '').trim()
  if (!text) return json({ error: 'Message body required' }, 400)
  if (text.length > 4096) return json({ error: 'Message too long (max 4096)' }, 400)

  // 3. Résolution destinataire + autorisation d'agence
  let toPhone: string | null = null
  let contactId: string | null = null
  if (input.contactId) {
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('id, phone, agency_id')
      .eq('id', input.contactId)
      .single()
    if (error || !contact) return json({ error: 'Contact not found' }, 404)
    // Cloisonnement : l'agent ne peut écrire qu'à un contact de SON agence.
    if (contact.agency_id !== profile.agency_id) {
      return json({ error: 'Forbidden: contact belongs to another agency' }, 403)
    }
    if (!contact.phone) return json({ error: 'Contact has no phone number' }, 422)
    toPhone = normalizePhone(contact.phone)
    contactId = contact.id
  } else if (input.toPhone) {
    toPhone = normalizePhone(input.toPhone)
  }
  if (!toPhone) return json({ error: 'contactId or toPhone required' }, 400)

  // 4. Config provider (secrets serveur)
  const providerName = (Deno.env.get('WHATSAPP_PROVIDER') ?? 'meta') as 'meta' | 'openwa'
  const provider = getProvider(providerName)
  const config: SendConfig = {
    metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
    metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
    metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
    openwaBaseUrl: Deno.env.get('OPENWA_BASE_URL'),
    openwaApiKey: Deno.env.get('OPENWA_API_KEY'),
    openwaSessionId: Deno.env.get('OPENWA_SESSION_ID'),
  }
  if (providerName === 'meta' && (!config.metaToken || !config.metaPhoneNumberId)) {
    return json({ error: 'Server misconfigured: META_WHATSAPP_TOKEN / META_PHONE_NUMBER_ID missing' }, 500)
  }

  // 5. Construire + exécuter la requête d'envoi (gateway → fetch ici)
  const httpReq = provider.buildSendTextRequest({ toPhone, body: text }, config)
  let status: number
  let respBody: unknown
  try {
    const res = await fetch(httpReq.url, { method: httpReq.method, headers: httpReq.headers, body: httpReq.body })
    status = res.status
    respBody = await res.json().catch(() => ({}))
  } catch (err) {
    return json({ error: 'Send failed (network)', detail: String(err) }, 502)
  }
  const result = provider.parseSendResult(status, respBody)
  if (!result.ok) {
    return json({ error: result.error ?? 'Send failed', providerStatus: status }, 502)
  }

  // 6. Stocker le sortant (service-role ; idempotent sur provider+message_id).
  //    En cas d'absence d'id provider, on génère un id local pour respecter la
  //    contrainte UNIQUE sans bloquer l'envoi déjà réussi.
  const providerMessageId = result.providerMessageId ?? `local-${providerName}-${toPhone}-${text.length}-${status}`
  const { error: insErr } = await supabase
    .from('whatsapp_messages')
    .upsert({
      provider: providerName,
      provider_message_id: providerMessageId,
      direction: 'outbound',
      wa_from: config.metaPhoneNumberId ?? 'megga',
      wa_to: toPhone,
      contact_id: contactId,
      agency_id: profile.agency_id,
      body: text,
      status: 'received', // accepté provider ; progression sent/delivered/read/failed via events `statuses` (webhook)
      raw: respBody as Record<string, unknown>,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })
  if (insErr) {
    // L'envoi a réussi mais le log a échoué : on le signale sans masquer le succès.
    console.error('whatsapp_messages outbound insert error:', insErr.message)
  }

  // 7. Audit (best-effort)
  try {
    await supabase.from('activity_events').insert({
      agency_id: profile.agency_id,
      actor_id: profile.id,
      actor_kind: 'user',
      action: 'whatsapp_message_sent',
      entity_type: contactId ? 'contact' : 'whatsapp_message',
      entity_id: contactId,
      category: 'contact',
    })
  } catch { /* non bloquant */ }

  return json({ ok: true, providerMessageId, toPhone, contactId }, 200)

  function json(obj: unknown, code: number): Response {
    return new Response(JSON.stringify(obj), {
      status: code,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
