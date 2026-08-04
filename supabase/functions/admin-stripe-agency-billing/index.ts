// P8b — Facturation Stripe détaillée d'une agence (super-admin, à la demande).
// POST { agency_id } → abonnement courant + 12 dernières factures + facture à
// venir, via agencies.stripe_customer_id. Aucun cron, aucune table : appel
// ponctuel depuis la fiche agence. Garde _shared/require-super-admin.ts.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await requireSuperAdmin(req, corsHeaders)
    if (auth instanceof Response) return auth

    const { agency_id } = await req.json().catch(() => ({}))
    if (!agency_id) return json(400, { error: 'agency_id required' })

    // Client stripe de l'agence (service-role via le contexte).
    const { data: agency, error: agencyErr } = await auth.supabase
      .from('agencies')
      .select('stripe_customer_id, name')
      .eq('id', agency_id)
      .maybeSingle()
    if (agencyErr) return json(500, { error: agencyErr.message })
    if (!agency) return json(404, { error: 'agency not found' })
    if (!agency.stripe_customer_id) {
      return json(200, { configured: false, agency_name: agency.name })
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })
    const customer = agency.stripe_customer_id as string

    // Abonnement courant (le plus récent).
    const subs = await stripe.subscriptions.list({ customer, status: 'all', limit: 1 })
    const sub = subs.data[0]

    // 12 dernières factures.
    const invoices = await stripe.invoices.list({ customer, limit: 12 })

    // Facture à venir (peut ne pas exister → 404 Stripe toléré).
    let upcoming: Stripe.UpcomingInvoice | null = null
    try {
      upcoming = await stripe.invoices.retrieveUpcoming({ customer })
    } catch { /* pas d'échéance à venir */ }

    return json(200, {
      configured: true,
      agency_name: agency.name,
      subscription: sub ? {
        status: sub.status,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
      } : null,
      invoices: invoices.data.map((i: Stripe.Invoice) => ({
        id: i.id,
        number: i.number,
        status: i.status,
        amount_paid: i.amount_paid,
        amount_due: i.amount_due,
        currency: i.currency,
        created: i.created,
        hosted_invoice_url: i.hosted_invoice_url,
      })),
      upcoming: upcoming ? {
        amount_due: upcoming.amount_due,
        currency: upcoming.currency,
        next_payment_attempt: upcoming.next_payment_attempt,
      } : null,
    })
  } catch (err) {
    return json(500, { error: (err as Error).message })
  }
})
