// supabase/functions/credits-checkout/index.ts
//
// Acheter un pack de crédits : ouvre une session Stripe Checkout en mode PAIEMENT
// (pas d'abonnement) et rend son URL. Le crédit du solde ne se fait JAMAIS ici — l'agent
// peut fermer l'onglet Stripe, le paiement n'en aboutit pas moins. Deux chemins le
// portent, tous deux idempotents par PaymentIntent : le webhook
// (`checkout.session.completed`, `stripe-webhook`) et le retour à l'écran
// (`credits-checkout-status`, qui doit pouvoir montrer un reçu sans attendre le premier).
//
// ⚠ Le prix vient du CATALOGUE SERVEUR (`CREDIT_PACKS`), écrit en ligne dans la session
// (`price_data`) : aucun `priceId` Stripe n'est reçu du navigateur, donc rien à
// confronter à une table de secrets — c'est l'identifiant du pack qui est validé.
// Pas de produit à créer dans le tableau de bord Stripe non plus : le catalogue se
// déploie avec le code.
//
// ⚠ La carte est ENREGISTRÉE pour la recharge automatique (`setup_future_usage` sur la
// carte seule) : TWINT reste proposé mais ne peut pas servir hors session, et Stripe
// refuserait la session si on le lui demandait. Le webhook ne note la carte que si le
// paiement s'est fait par carte.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
import { packParId } from '../_shared/credits.ts'
import { labsOuvertAuPlan } from '../_shared/labs.ts'
import { appDashboardUrl } from '../_shared/app-url.ts'

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase } = auth

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  if (!stripeKey) return json({ error: 'stripe_not_configured' }, 503)
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })

  let body: { pack?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  const pack = packParId(body.pack)
  if (!pack) return json({ error: 'pack_not_allowed' }, 400)

  // Le studio n'est ouvert qu'à partir de Pro : on ne vend pas des crédits qu'un plan
  // Starter ne pourrait pas dépenser.
  const { data: agency } = await supabase.from('agencies').select('id, name, plan, stripe_customer_id').eq('id', profile.agency_id).single()
  if (!labsOuvertAuPlan(agency?.plan as string | null)) return json({ error: 'upgrade_required' }, 403)

  try {
    // Même client Stripe que l'abonnement : la facture des crédits se lit au même endroit.
    const { data: sub } = await supabase.from('subscriptions').select('stripe_customer_id').eq('agency_id', profile.agency_id).maybeSingle()
    let customerId = (sub?.stripe_customer_id as string | null) || (agency?.stripe_customer_id as string | null) || null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? '',
        name: (agency?.name as string | null) ?? '',
        metadata: { agency_id: profile.agency_id, user_id: user.id },
      })
      customerId = customer.id
      await supabase.from('agencies').update({ stripe_customer_id: customerId }).eq('id', profile.agency_id)
    }

    // Le retour se fait sur l'ORIGINE de l'appelant (banc, aperçu, prod) ; sans origine,
    // c'est `app-url.ts` qui connaît l'adresse de l'app — jamais un littéral ici
    // (`app-url-unique.spec.ts` : un domaine figé se change en silence le jour où il bouge).
    const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/[^/]*$/, '') || null
    const retour = (query: string) => origin ? `${origin}/dashboard/settings?${query}` : appDashboardUrl(`/dashboard/settings?${query}`)
    const meta = { kind: 'credits', agency_id: profile.agency_id, user_id: user.id, pack: pack.id, credits: String(pack.credits) }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card', 'twint'],
      payment_method_options: { card: { setup_future_usage: 'off_session' } },
      line_items: [{
        price_data: {
          currency: 'chf',
          unit_amount: pack.chf * 100,
          product_data: {
            name: `${pack.credits} crédits MEGGA Labs`,
            description: 'Crédits de génération pour le studio Labs (images et vidéos). Ne périment pas.',
          },
        },
        quantity: 1,
      }],
      // Une facture pour la comptabilité de l'agence — c'est un achat B2B.
      invoice_creation: { enabled: true },
      metadata: meta,
      payment_intent_data: { metadata: meta, description: `${pack.credits} crédits MEGGA Labs` },
      // ⚠ `{CHECKOUT_SESSION_ID}` est substitué PAR STRIPE, il ne doit pas être encodé :
      // c'est ce jeton qui permet à `credits-checkout-status` de rendre un vrai reçu
      // (pack, montant, solde après, facture) au lieu d'un « merci » qui ne prouve rien.
      success_url: retour('tab=credits&success=true&session_id={CHECKOUT_SESSION_ID}'),
      cancel_url: retour('tab=credits&canceled=true'),
      locale: 'fr',
    })

    return json({ url: session.url })
  } catch (e) {
    console.error('credits-checkout:', redactedErrorMessage(e))
    return json({ error: 'checkout_failed' }, 500)
  }
})
