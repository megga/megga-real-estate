// supabase/functions/stripe-checkout/index.ts
// Edge Function pour créer une session Stripe Checkout
// L'agent clique "Passer au Pro/Entreprise" → cette function crée la session → redirect vers Stripe

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface CheckoutRequest {
  priceId: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non connecté' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user profile + agency
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id, full_name, email')
      .eq('id', user.id)
      .single()

    if (!profile?.agency_id) {
      return new Response(JSON.stringify({ error: 'Aucune agence trouvée' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { priceId } = await req.json() as CheckoutRequest

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'priceId requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin client to bypass RLS
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Check if agency already has a Stripe customer in subscriptions table
    const { data: existingSub } = await adminSupabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('agency_id', profile.agency_id)
      .maybeSingle()

    // Also check agencies table for legacy stripe_customer_id
    const { data: agency } = await adminSupabase
      .from('agencies')
      .select('id, name, stripe_customer_id')
      .eq('id', profile.agency_id)
      .single()

    let stripeCustomerId = existingSub?.stripe_customer_id || agency?.stripe_customer_id

    // Create Stripe customer if needed
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile.email ?? user.email ?? '',
        name: agency?.name ?? profile.full_name ?? '',
        metadata: {
          agency_id: profile.agency_id,
          user_id: user.id,
        },
      })
      stripeCustomerId = customer.id

      // Store customer ID in agencies
      await adminSupabase
        .from('agencies')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', profile.agency_id)
    }

    // Determine origin for redirect URLs
    const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/[^/]*$/, '') || 'https://megga-real-estate.pages.dev'

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card', 'twint'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/settings?tab=abonnement&success=true`,
      cancel_url: `${origin}/dashboard/settings?tab=abonnement&canceled=true`,
      subscription_data: {
        metadata: { agency_id: profile.agency_id },
      },
      locale: 'fr',
      allow_promotion_codes: true,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return new Response(JSON.stringify({ error: 'Erreur lors de la création du checkout' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
