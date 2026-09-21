// supabase/functions/credits-checkout-status/index.ts
//
// LE REÇU : ce que l'agent voit au retour de Stripe. Il donne l'état d'UNE session de
// Checkout — payée ou non —, le pack, le solde APRÈS, et le lien de la facture.
//
// ⛔ ET IL CRÉDITE LUI AUSSI, faute de quoi la confirmation serait une promesse sur
// autrui. Le webhook (`checkout.session.completed`) reste la voie normale, mais il
// arrive APRÈS la redirection — parfois quelques secondes, parfois jamais (secret de
// signature tourné, événement perdu, fonction en échec). Un écran qui attend un
// webhook affiche « paiement en cours » sur un paiement abouti, et l'agent recommence.
// `credits_purchase` est idempotent par PaymentIntent : les deux chemins convergent,
// le second voit `duplicate` et ne recrédite rien.
//
// ⛔ LA SESSION EST RELUE CHEZ STRIPE, JAMAIS CRUE SUR PAROLE. Le navigateur n'envoie
// qu'un identifiant de session ; c'est Stripe qui dit `payment_status`, et c'est la
// MÉTADONNÉE de la session qui dit à quelle agence elle appartient. Une session dont
// l'agence n'est pas celle de l'appelant rend `not_found` — pas `forbidden` : un motif
// qui distingue « pas à vous » de « n'existe pas » dirait à un curieux qu'un
// identifiant deviné est réel.
//
// La carte est notée ici aussi (recharge automatique) : si le webhook ne vient jamais,
// c'est le seul endroit qui la verra.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
import { clientStripeReel, packParId } from '../_shared/credits.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** `cs_test_…` / `cs_live_…` — la forme est vérifiée avant de déranger Stripe. */
const SESSION_RE = /^cs_[A-Za-z0-9_]{8,200}$/

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { profile } = auth

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  if (!stripeKey) return json({ error: 'stripe_not_configured' }, 503)
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })

  let body: { sessionId?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const sessionId = typeof body.sessionId === 'string' && SESSION_RE.test(body.sessionId) ? body.sessionId : null
  if (!sessionId) return json({ error: 'invalid_session' }, 400)

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['invoice', 'payment_intent'] })

    // L'agence de la MÉTADONNÉE contre celle du jeton : c'est le seul lien de propriété.
    if (session.metadata?.kind !== 'credits' || session.metadata?.agency_id !== profile.agency_id) {
      return json({ error: 'not_found' }, 404)
    }
    const pack = packParId(session.metadata?.pack)
    if (!pack) return json({ error: 'not_found' }, 404)

    const pi = typeof session.payment_intent === 'string'
      ? null
      : (session.payment_intent as Stripe.PaymentIntent | null)
    const piId = typeof session.payment_intent === 'string' ? session.payment_intent : pi?.id ?? null
    const invoice = typeof session.invoice === 'string' ? null : (session.invoice as Stripe.Invoice | null)
    const chf = (session.amount_total ?? pack.chf * 100) / 100

    const commun = {
      pack: pack.id,
      credits: pack.credits,
      chf,
      invoiceUrl: invoice?.hosted_invoice_url ?? null,
    }

    if (session.payment_status !== 'paid') {
      // `open` : l'agent est revenu sans payer, ou TWINT n'a pas encore abouti.
      // `expired` : la session a plus de 24 h. Deux états différents à l'écran.
      const etat = session.status === 'expired' ? 'expired' : session.payment_status === 'unpaid' && session.status === 'complete' ? 'processing' : 'unpaid'
      return json({ status: etat, ...commun, balance: null })
    }
    if (!piId) return json({ status: 'processing', ...commun, balance: null })

    // Payé : on crédite (idempotent) et on rend le solde. Le service_role est ouvert
    // ICI seulement, après que le jeton de l'agent a prouvé l'agence.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data, error } = await admin.rpc('credits_purchase', {
      p_agency: profile.agency_id,
      p_amount: pack.credits,
      p_kind: 'purchase',
      p_ref_type: 'stripe_payment_intent',
      p_ref_id: piId,
      p_amount_chf: chf,
      p_metadata: { pack: pack.id, checkout_session: session.id, user_id: session.metadata?.user_id ?? null },
    })
    if (error) throw error
    const r = (data ?? {}) as { duplicate?: boolean; balance?: number }

    // Le client qui a payé porte la carte : la recharge automatique le relira sur l'agence
    // (`credits_auto_topup_claim`). Le webhook le note aussi ; ici, il ne dépend pas de lui.
    const clientPaye = clientStripeReel(typeof session.customer === 'string' ? session.customer : session.customer?.id)
    if (clientPaye) await admin.from('agencies').update({ stripe_customer_id: clientPaye }).eq('id', profile.agency_id)

    // Le grand livre porte l'achat ; le journal de l'agence porte le FAIT, une fois.
    if (!r.duplicate) {
      await admin.from('activity_events').insert({
        agency_id: profile.agency_id,
        actor_id: null,
        actor_kind: 'system',
        action: 'credits_purchased',
        category: 'settings',
        entity_type: 'agency',
        entity_id: profile.agency_id,
        metadata: { pack: pack.id, credits: pack.credits, chf, payment_intent: piId, balance: r.balance ?? null, via: 'return' },
      })
    }

    // La carte, pour la recharge automatique — le webhook la note aussi, et
    // `credits_set_card` est un remplacement : la relire deux fois ne coûte rien.
    try {
      const plein = pi?.payment_method && typeof pi.payment_method === 'object'
        ? pi as Stripe.PaymentIntent
        : await stripe.paymentIntents.retrieve(piId, { expand: ['payment_method'] })
      const pm = plein.payment_method as Stripe.PaymentMethod | null
      if (pm && typeof pm === 'object' && pm.type === 'card' && pm.card && plein.setup_future_usage === 'off_session') {
        await admin.rpc('credits_set_card', {
          p_agency: profile.agency_id,
          p_payment_method_id: pm.id,
          p_brand: pm.card.brand ?? null,
          p_last4: pm.card.last4 ?? null,
        })
      }
    } catch (e) {
      // Un confort, pas le paiement : l'achat est déjà crédité, on ne le fait pas échouer.
      console.error('credits-checkout-status carte:', redactedErrorMessage(e))
    }

    return json({ status: 'paid', ...commun, balance: r.balance ?? null })
  } catch (e) {
    // Une session inconnue de Stripe est un 404 chez lui : c'est un `not_found` ici,
    // pas une panne — un identifiant recopié de travers ne doit pas rougir.
    if ((e as { statusCode?: number }).statusCode === 404) return json({ error: 'not_found' }, 404)
    console.error('credits-checkout-status:', redactedErrorMessage(e))
    return json({ error: 'status_failed' }, 500)
  }
})
