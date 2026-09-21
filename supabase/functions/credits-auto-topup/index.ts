// supabase/functions/credits-auto-topup/index.ts
//
// La recharge AUTOMATIQUE : quand un débit fait passer le solde sous le seuil réglé
// par l'agence, `labs-image` / `labs-video` réveillent cette fonction (secret de
// service, sans attendre), qui charge la carte enregistrée HORS SESSION et crédite le
// pack choisi.
//
// Trois gardes, dans cet ordre :
//   1. le secret de service — personne d'autre ne déclenche une charge ;
//   2. `credits_auto_topup_claim` — un verrou de 10 min posé DANS la transaction qui
//      relit le porte-monnaie : deux réveils simultanés obtiennent un seul `ok` ;
//   3. `credits_purchase` — idempotent par PaymentIntent : le webhook
//      `payment_intent.succeeded` repassera par là et ne créditera pas deux fois.
//
// Une carte qui refuse laisse le verrou 24 h et écrit l'erreur sur le porte-monnaie
// (`auto_topup_last_error`), que l'écran « Consommation » montre. On ne martèle pas.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
import { packParId } from '../_shared/credits.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  if (!(await isServiceSecret(admin, req))) return json({ error: 'unauthorized' }, 401)

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  if (!stripeKey) return json({ error: 'stripe_not_configured' }, 503)
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })

  let body: { agencyId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const agencyId = typeof body.agencyId === 'string' && UUID_RE.test(body.agencyId) ? body.agencyId : null
  if (!agencyId) return json({ error: 'invalid_agency' }, 400)

  const { data: claim, error: claimErr } = await admin.rpc('credits_auto_topup_claim', { p_agency: agencyId })
  if (claimErr) {
    console.error('credits_auto_topup_claim:', claimErr.message)
    return json({ error: 'claim_failed' }, 500)
  }
  const c = (claim ?? {}) as { ok?: boolean; error?: string; pack?: string; payment_method_id?: string; customer_id?: string }
  if (!c.ok) return json({ ok: false, skipped: c.error ?? 'not_due' })

  const pack = packParId(c.pack)
  if (!pack || !c.payment_method_id || !c.customer_id) {
    await admin.rpc('credits_auto_topup_release', { p_agency: agencyId, p_error: 'invalid_settings' })
    return json({ ok: false, error: 'invalid_settings' }, 400)
  }

  try {
    const pi = await stripe.paymentIntents.create({
      amount: pack.chf * 100,
      currency: 'chf',
      customer: c.customer_id,
      payment_method: c.payment_method_id,
      off_session: true,
      confirm: true,
      description: `Recharge automatique — ${pack.credits} crédits MEGGA Labs`,
      metadata: { kind: 'credits', auto: '1', agency_id: agencyId, pack: pack.id, credits: String(pack.credits) },
    })

    if (pi.status !== 'succeeded') {
      await admin.rpc('credits_auto_topup_release', { p_agency: agencyId, p_error: `payment_${pi.status}` })
      return json({ ok: false, error: pi.status })
    }

    // La carte est DÉBITÉE : le crédit se retente sur une panne passagère.
    let achat: { balance?: number; duplicate?: boolean } | null = null
    let panne: string | null = null
    for (let essai = 1; essai <= 3; essai++) {
      const { data, error } = await admin.rpc('credits_purchase', {
        p_agency: agencyId,
        p_amount: pack.credits,
        p_kind: 'auto_topup',
        p_ref_type: 'stripe_payment_intent',
        p_ref_id: pi.id,
        p_amount_chf: pack.chf,
        p_metadata: { pack: pack.id, auto: true },
      })
      const r = (data ?? null) as { ok?: boolean; error?: string; balance?: number; duplicate?: boolean } | null
      if (!error && r?.ok !== false) {
        achat = r ?? {}
        break
      }
      panne = error?.message ?? r?.error ?? 'unknown'
      if (essai < 3) await new Promise((fin) => setTimeout(fin, essai * 500))
    }
    // ⛔ UNE CARTE DÉBITÉE SANS CRÉDIT N'EST PAS UNE RÉUSSITE. Avant la revue du 21.09.2026,
    // l'erreur était ignorée : verrou libéré, journal « recharge », `ok: true`, et plus rien.
    // Le verrou reste désormais 24 h — aucune seconde charge — et le webhook
    // `payment_intent.succeeded` créditera, idempotent par PaymentIntent.
    if (!achat) {
      console.error('credits-auto-topup credits_purchase:', panne, pi.id)
      await admin.rpc('credits_auto_topup_release', { p_agency: agencyId, p_error: 'credit_pending' })
      return json({ ok: false, error: 'credit_pending' }, 500)
    }
    await admin.rpc('credits_auto_topup_release', { p_agency: agencyId, p_error: null })

    // Le journal porte le fait une fois : si le webhook est passé avant, c'est lui qui l'a écrit.
    if (!achat.duplicate) {
      await admin.from('activity_events').insert({
        agency_id: agencyId,
        actor_id: null,
        actor_kind: 'system',
        action: 'credits_auto_topup',
        category: 'settings',
        entity_type: 'agency',
        entity_id: agencyId,
        metadata: { pack: pack.id, credits: pack.credits, chf: pack.chf, payment_intent: pi.id, balance: achat.balance ?? null },
      })
    }

    return json({ ok: true, credits: pack.credits, balance: achat.balance ?? null })
  } catch (e) {
    // `StripeCardError` (carte refusée, authentification exigée hors session…) : on
    // note le motif, sans la trace — le message Stripe cite parfois les 4 derniers chiffres.
    const code = (e as { code?: string; decline_code?: string }).decline_code
      ?? (e as { code?: string }).code
      ?? 'charge_failed'
    console.error('credits-auto-topup stripe:', redactedErrorMessage(e))
    await admin.rpc('credits_auto_topup_release', { p_agency: agencyId, p_error: String(code).slice(0, 80) })
    return json({ ok: false, error: 'charge_failed' }, 502)
  }
})
