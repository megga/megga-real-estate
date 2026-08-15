// resend-webhook — événements de remise Resend (rebond, plainte, retard).
//
// POURQUOI CETTE FONCTION EXISTE. Jusqu'au 15.08.2026, le seul signal que le dépôt
// observait sur un envoi était le code de retour de l'API Resend. Or il vaut 200 dès que
// Resend ACCEPTE la requête : un destinataire sur liste de suppression, une boîte
// inexistante, un rebond dur, tout cela rend 200. Mesuré ce jour-là, `hello@juarts.com`
// était supprimé depuis le 05.08 et DIX JOURS d'alertes plateforme n'étaient jamais
// arrivées, sans que rien ne le dise. La même cécité couvrait les e-mails client.
//
// PUBLIC (verify_jwt=false, comme les trois autres webhooks) : l'authenticité est portée
// par la SIGNATURE SVIX et par rien d'autre — cf. `_shared/svix-signature.ts`. Sans
// secret configuré, la fonction refuse TOUT : fermée par défaut, jamais ouverte par
// omission.
//
// ⚠ Le corps est lu en TEXTE BRUT avant tout `JSON.parse` : la signature porte sur les
// octets reçus, et un aller-retour JSON réordonne les clés, donc invaliderait une requête
// parfaitement légitime.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { readSvixHeaders, verifySvixSignature } from '../_shared/svix-signature.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

/**
 * Les types d'événements que l'on ENREGISTRE. Volontairement restreint aux échecs :
 * `email.sent` et `email.delivered` arriveraient à chaque envoi et rempliraient la table
 * d'un journal que Resend tient déjà, pour une information dont personne n'a besoin ici.
 * La question à laquelle cette table répond est « qu'est-ce qui n'est PAS arrivé ».
 */
const TYPES_SUIVIS = new Set([
  'email.bounced',
  'email.complained',
  'email.delivery_delayed',
  'email.failed',
])

interface ResendEvent {
  type?: string
  created_at?: string
  data?: {
    email_id?: string
    to?: string[] | string
    subject?: string
    bounce?: { type?: string; subType?: string; message?: string }
    reason?: string
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const rawBody = await req.text()
  const verdict = await verifySvixSignature(
    rawBody,
    readSvixHeaders(req),
    Deno.env.get('RESEND_WEBHOOK_SECRET'),
    Math.floor(Date.now() / 1000),
  )

  if (!verdict.valid) {
    // Le MOTIF reste dans le journal du serveur. L'appelant, lui, reçoit un 401 nu :
    // distinguer « secret absent » de « signature fausse » renseignerait un tiers sur
    // l'état de notre configuration.
    console.error('[resend-webhook] signature refusée:', verdict.reason)
    return json({ error: 'unauthorized' }, 401)
  }

  let event: ResendEvent
  try {
    event = JSON.parse(rawBody) as ResendEvent
  } catch {
    return json({ error: 'bad_json' }, 400)
  }

  const type = event.type ?? ''
  // Acquitté, pas enregistré : un 2xx dit à Svix de ne pas rejouer. Répondre en erreur
  // sur un type qui ne nous intéresse pas déclencherait des rejeux à vie.
  if (!TYPES_SUIVIS.has(type)) return json({ ok: true, ignored: type })

  const svixId = req.headers.get('svix-id') ?? ''
  const destinataires = event.data?.to
  const recipient = Array.isArray(destinataires) ? destinataires[0] ?? null : destinataires ?? null

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error } = await admin.from('email_delivery_events').insert({
    provider: 'resend',
    provider_event_id: svixId,
    event_type: type,
    email_id: event.data?.email_id ?? null,
    recipient,
    subject: event.data?.subject ?? null,
    bounce_type: event.data?.bounce?.type ?? null,
    reason: event.data?.bounce?.message ?? event.data?.reason ?? null,
    occurred_at: event.created_at ?? new Date().toISOString(),
    payload: event as unknown as Record<string, unknown>,
  })

  if (error) {
    // 23505 = rejeu du même message de webhook : l'idempotence a fait son travail, ce
    // n'est pas un incident. Répondre 200 sinon Svix rejouerait indéfiniment.
    if ((error as { code?: string }).code === '23505') return json({ ok: true, duplicate: true })
    console.error('[resend-webhook] insert échoué:', error.message)
    return json({ error: 'insert_failed' }, 500)
  }

  return json({ ok: true })
})
