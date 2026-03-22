// supabase/functions/stripe-webhook/index.ts
// Edge Function pour gérer les webhooks Stripe
// Met à jour agencies.plan quand un paiement est confirmé

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// Map Stripe price IDs to MEGGA plan names
const PRICE_TO_PLAN: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_STARTER') ?? 'price_starter']: 'starter',
  [Deno.env.get('STRIPE_PRICE_PRO') ?? 'price_pro']: 'pro',
  [Deno.env.get('STRIPE_PRICE_AGENCY') ?? 'price_agency']: 'agency',
}

interface StripeEvent {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

async function verifyStripeSignature(body: string, signature: string): Promise<StripeEvent | null> {
  // In production, use Stripe SDK to verify webhook signature
  // For now, parse the event directly (configure STRIPE_WEBHOOK_SECRET in production)
  if (!STRIPE_WEBHOOK_SECRET) {
    console.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification')
    return JSON.parse(body) as StripeEvent
  }

  // Stripe signature verification using Web Crypto API
  const parts = signature.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2)
  const v1Signature = parts.find(p => p.startsWith('v1='))?.slice(3)

  if (!timestamp || !v1Signature) return null

  const payload = `${timestamp}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const expectedSignature = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (expectedSignature !== v1Signature) {
    console.error('Stripe webhook signature verification failed')
    return null
  }

  return JSON.parse(body) as StripeEvent
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature') ?? ''

    const event = await verifyStripeSignature(body, signature)
    if (!event) {
      return new Response('Invalid signature', { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    switch (event.type) {
      // Checkout completed — activate subscription
      case 'checkout.session.completed': {
        const session = event.data.object as Record<string, unknown>
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const agencyId = (session.metadata as Record<string, string>)?.agency_id

        if (!agencyId) {
          console.error('No agency_id in checkout session metadata')
          break
        }

        // Get subscription details to find the plan
        const subResponse = await fetch(
          `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
          {
            headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
          }
        )
        const subscription = await subResponse.json()
        const priceId = subscription.items?.data?.[0]?.price?.id ?? ''
        const plan = PRICE_TO_PLAN[priceId] ?? 'starter'

        // Update agency plan + store Stripe customer ID
        const { error } = await supabase
          .from('agencies')
          .update({
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', agencyId)

        if (error) console.error('Failed to update agency plan:', error)

        // Log activity event
        await supabase.from('activity_events').insert({
          agency_id: agencyId,
          actor_id: 'system',
          action: 'subscription_activated',
          entity_type: 'agency',
          entity_id: agencyId,
          metadata: { plan, stripe_customer_id: customerId },
        })

        console.log(`Agency ${agencyId} upgraded to ${plan}`)
        break
      }

      // Subscription updated (plan change)
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Record<string, unknown>
        const priceId = (subscription.items as Record<string, unknown[]>)?.data?.[0]?.price?.id ?? ''
        const plan = PRICE_TO_PLAN[priceId as string] ?? 'starter'
        const customerId = subscription.customer as string
        const status = subscription.status as string

        // Find agency by Stripe customer ID
        const { data: agency } = await supabase
          .from('agencies')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!agency) {
          console.error('No agency found for Stripe customer:', customerId)
          break
        }

        // Update plan (only if subscription is active)
        if (status === 'active' || status === 'trialing') {
          await supabase
            .from('agencies')
            .update({ plan })
            .eq('id', agency.id)

          await supabase.from('activity_events').insert({
            agency_id: agency.id,
            actor_id: 'system',
            action: 'subscription_changed',
            entity_type: 'agency',
            entity_id: agency.id,
            metadata: { plan, status },
          })
        }
        break
      }

      // Payment failed
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Record<string, unknown>
        const customerId = invoice.customer as string

        const { data: agency } = await supabase
          .from('agencies')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (agency) {
          await supabase.from('activity_events').insert({
            agency_id: agency.id,
            actor_id: 'system',
            action: 'payment_failed',
            entity_type: 'agency',
            entity_id: agency.id,
            metadata: { invoice_id: invoice.id },
          })
          console.warn(`Payment failed for agency ${agency.id}`)
        }
        break
      }

      // Subscription cancelled
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Record<string, unknown>
        const customerId = subscription.customer as string

        const { data: agency } = await supabase
          .from('agencies')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (agency) {
          // Downgrade to starter
          await supabase
            .from('agencies')
            .update({
              plan: 'starter',
              stripe_subscription_id: null,
            })
            .eq('id', agency.id)

          await supabase.from('activity_events').insert({
            agency_id: agency.id,
            actor_id: 'system',
            action: 'subscription_cancelled',
            entity_type: 'agency',
            entity_id: agency.id,
            metadata: { previous_customer_id: customerId },
          })
          console.log(`Agency ${agency.id} downgraded to starter (subscription cancelled)`)
        }
        break
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Stripe webhook error:', err)
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
