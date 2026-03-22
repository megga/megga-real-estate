// supabase/functions/stripe-checkout/index.ts
// Edge Function pour créer une session Stripe Checkout
// L'agent clique "Choisir" sur un plan → cette function crée la session → redirect vers Stripe

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stripe price IDs (configured in Stripe Dashboard)
const PLAN_PRICES: Record<string, string> = {
  starter: Deno.env.get('STRIPE_PRICE_STARTER') ?? '',
  pro: Deno.env.get('STRIPE_PRICE_PRO') ?? '',
  agency: Deno.env.get('STRIPE_PRICE_AGENCY') ?? '',
}

interface CheckoutRequest {
  plan: 'starter' | 'pro' | 'agency'
  returnUrl?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
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
      return new Response(JSON.stringify({ error: 'No agency found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get agency details (check for existing Stripe customer)
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: agency } = await adminSupabase
      .from('agencies')
      .select('id, name, stripe_customer_id')
      .eq('id', profile.agency_id)
      .single()

    const { plan, returnUrl } = await req.json() as CheckoutRequest
    const priceId = PLAN_PRICES[plan]

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create or reuse Stripe customer
    let customerId = agency?.stripe_customer_id

    if (!customerId) {
      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: profile.email ?? user.email ?? '',
          name: agency?.name ?? profile.full_name ?? '',
          'metadata[agency_id]': profile.agency_id,
          'metadata[user_id]': user.id,
        }),
      })
      const customer = await customerResponse.json()
      customerId = customer.id

      // Store customer ID
      await adminSupabase
        .from('agencies')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.agency_id)
    }

    // Check if agency already has an active subscription (upgrade/downgrade)
    const { data: currentAgency } = await adminSupabase
      .from('agencies')
      .select('stripe_subscription_id')
      .eq('id', profile.agency_id)
      .single()

    // If existing subscription, create a billing portal session instead
    if (currentAgency?.stripe_subscription_id) {
      const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          customer: customerId,
          return_url: returnUrl ?? `${req.headers.get('origin')}/dashboard/settings`,
        }),
      })
      const portal = await portalResponse.json()

      return new Response(JSON.stringify({ url: portal.url, type: 'portal' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create Stripe Checkout Session for new subscription
    const checkoutResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: `${returnUrl ?? req.headers.get('origin')}/dashboard/settings?stripe=success`,
        cancel_url: `${returnUrl ?? req.headers.get('origin')}/dashboard/settings?stripe=cancelled`,
        'metadata[agency_id]': profile.agency_id,
        'subscription_data[metadata][agency_id]': profile.agency_id,
        allow_promotion_codes: 'true',
      }),
    })
    const session = await checkoutResponse.json()

    if (session.error) {
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ url: session.url, type: 'checkout' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
