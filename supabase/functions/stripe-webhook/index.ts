// supabase/functions/stripe-webhook/index.ts
// Edge Function pour gérer les webhooks Stripe
// Met à jour la table subscriptions quand un événement Stripe arrive
// AUCUNE AUTH SUPABASE — validation via Stripe webhook signing secret

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

function getPlanFromPriceId(priceId: string): string {
  const priceMap: Record<string, string> = {
    [Deno.env.get('STRIPE_PRICE_PRO_MONTHLY') ?? '']: 'pro',
    [Deno.env.get('STRIPE_PRICE_PRO_YEARLY') ?? '']: 'pro',
    [Deno.env.get('STRIPE_PRICE_ENTREPRISE_MONTHLY') ?? '']: 'entreprise',
    [Deno.env.get('STRIPE_PRICE_ENTREPRISE_YEARLY') ?? '']: 'entreprise',
  }
  return priceMap[priceId] || 'starter'
}

function getBillingPeriod(priceId: string): string {
  const yearlyPrices = [
    Deno.env.get('STRIPE_PRICE_PRO_YEARLY'),
    Deno.env.get('STRIPE_PRICE_ENTREPRISE_YEARLY'),
  ]
  return yearlyPrices.includes(priceId) ? 'yearly' : 'monthly'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')!
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body, signature, webhookSecret
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', (err as Error).message)
      return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    switch (event.type) {
      // ─── Checkout completed — activate subscription ───
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        // Retrieve full subscription from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0].price.id
        const agencyId = subscription.metadata.agency_id

        if (!agencyId) {
          console.error('No agency_id in subscription metadata')
          break
        }

        // UPSERT subscription in DB
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            agency_id: agencyId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            plan: getPlanFromPriceId(priceId),
            billing_period: getBillingPeriod(priceId),
            status: 'active',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'agency_id' })

        if (error) console.error('Failed to upsert subscription:', error)

        // Update agencies.stripe_customer_id
        await supabaseAdmin
          .from('agencies')
          .update({ stripe_customer_id: customerId })
          .eq('id', agencyId)

        // Log activity event
        await supabaseAdmin.from('activity_events').insert({
          agency_id: agencyId,
          actor_id: null,
          actor_kind: 'system',
          action: 'subscription_activated',
          entity_type: 'agency',
          entity_id: agencyId,
          metadata: {
            plan: getPlanFromPriceId(priceId),
            stripe_customer_id: customerId,
            billing_period: getBillingPeriod(priceId),
          },
        })

        console.log(`Agency ${agencyId} subscription activated: ${getPlanFromPriceId(priceId)}`)
        break
      }

      // ─── Subscription updated (plan change, renewal, etc.) ───
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0].price.id
        const plan = getPlanFromPriceId(priceId)
        const status = subscription.status

        // Find agency by stripe_customer_id
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('agency_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        // Fallback: check agencies table
        let agencyId = sub?.agency_id
        if (!agencyId) {
          const { data: agency } = await supabaseAdmin
            .from('agencies')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()
          agencyId = agency?.id
        }

        if (!agencyId) {
          console.error('No agency found for Stripe customer:', customerId)
          break
        }

        // Update subscription
        await supabaseAdmin
          .from('subscriptions')
          .upsert({
            agency_id: agencyId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId,
            plan,
            billing_period: getBillingPeriod(priceId),
            status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'agency_id' })

        // Log activity
        await supabaseAdmin.from('activity_events').insert({
          agency_id: agencyId,
          actor_id: null,
          actor_kind: 'system',
          action: 'subscription_changed',
          entity_type: 'agency',
          entity_id: agencyId,
          metadata: { plan, status, billing_period: getBillingPeriod(priceId) },
        })

        console.log(`Agency ${agencyId} subscription updated: ${plan} (${status})`)
        break
      }

      // ─── Subscription deleted (cancelled) ───
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('agency_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        let agencyId = sub?.agency_id
        if (!agencyId) {
          const { data: agency } = await supabaseAdmin
            .from('agencies')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()
          agencyId = agency?.id
        }

        if (agencyId) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'canceled',
              plan: 'starter',
              updated_at: new Date().toISOString(),
            })
            .eq('agency_id', agencyId)

          await supabaseAdmin.from('activity_events').insert({
            agency_id: agencyId,
            actor_id: null,
            actor_kind: 'system',
            action: 'subscription_cancelled',
            entity_type: 'agency',
            entity_id: agencyId,
            metadata: { previous_customer_id: customerId },
          })

          console.log(`Agency ${agencyId} subscription cancelled → starter`)
        }
        break
      }

      // ─── Payment failed ───
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('agency_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        const agencyId = sub?.agency_id
        if (agencyId) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('agency_id', agencyId)

          await supabaseAdmin.from('activity_events').insert({
            agency_id: agencyId,
            actor_id: null,
            actor_kind: 'system',
            action: 'payment_failed',
            entity_type: 'agency',
            entity_id: agencyId,
            metadata: { invoice_id: invoice.id },
          })

          console.warn(`Payment failed for agency ${agencyId}`)
        }
        break
      }

      // ─── Payment succeeded ───
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('agency_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        const agencyId = sub?.agency_id
        if (agencyId && invoice.lines?.data?.[0]?.period) {
          const period = invoice.lines.data[0].period
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_start: new Date(period.start * 1000).toISOString(),
              current_period_end: new Date(period.end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('agency_id', agencyId)
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
