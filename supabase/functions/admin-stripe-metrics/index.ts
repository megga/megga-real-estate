import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'super_admin') throw new Error('Forbidden')

    // Init Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // ── Subscriptions ──
    // Paginate all subscriptions (Stripe max 100 per page)
    const allSubs: Stripe.Subscription[] = []
    let hasMore = true
    let startingAfter: string | undefined
    while (hasMore) {
      const page = await stripe.subscriptions.list({
        limit: 100,
        status: 'all',
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
      allSubs.push(...page.data)
      hasMore = page.has_more
      if (page.data.length > 0) startingAfter = page.data[page.data.length - 1].id
    }
    const subscriptions = { data: allSubs }
    const activeSubs = subscriptions.data.filter(s => s.status === 'active' || s.status === 'trialing')
    const canceledThisMonth = subscriptions.data.filter(s =>
      s.status === 'canceled' && s.canceled_at && new Date(s.canceled_at * 1000) >= monthStart
    )
    const pastDueSubs = subscriptions.data.filter(s => s.status === 'past_due')

    // MRR calculation
    let mrr = 0
    for (const sub of activeSubs) {
      const item = sub.items.data[0]
      if (item?.price?.unit_amount && item.price.recurring) {
        const amount = item.price.unit_amount / 100 // cents to CHF
        if (item.price.recurring.interval === 'year') {
          mrr += amount / 12
        } else {
          mrr += amount
        }
      }
    }

    // ── Recent charges (payments) ──
    // Paginate all charges for the period
    const allCharges: Stripe.Charge[] = []
    let chargesHasMore = true
    let chargesStartingAfter: string | undefined
    while (chargesHasMore) {
      const page = await stripe.charges.list({
        limit: 100,
        created: { gte: Math.floor(prevMonthStart.getTime() / 1000) },
        ...(chargesStartingAfter ? { starting_after: chargesStartingAfter } : {}),
      })
      allCharges.push(...page.data)
      chargesHasMore = page.has_more
      if (page.data.length > 0) chargesStartingAfter = page.data[page.data.length - 1].id
    }
    const charges = { data: allCharges }

    const revenueThisMonth = charges.data
      .filter(c => c.paid && !c.refunded && new Date(c.created * 1000) >= monthStart)
      .reduce((sum, c) => sum + (c.amount / 100), 0)

    const revenuePrevMonth = charges.data
      .filter(c => c.paid && !c.refunded && new Date(c.created * 1000) >= prevMonthStart && new Date(c.created * 1000) < monthStart)
      .reduce((sum, c) => sum + (c.amount / 100), 0)

    // ── Failed payments ──
    const failedCharges = charges.data.filter(c => !c.paid && new Date(c.created * 1000) >= monthStart)

    // ── Upcoming invoices (next renewals) ──
    const upcomingInvoices: { customer: string; amount: number; date: number }[] = []
    for (const sub of activeSubs.slice(0, 20)) {
      if (sub.current_period_end) {
        upcomingInvoices.push({
          customer: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          amount: (sub.items.data[0]?.price?.unit_amount ?? 0) / 100,
          date: sub.current_period_end,
        })
      }
    }
    upcomingInvoices.sort((a, b) => a.date - b.date)

    // ── Plan breakdown ──
    const planMap: Record<string, { count: number; mrr: number }> = {}
    for (const sub of activeSubs) {
      const priceId = sub.items.data[0]?.price?.id ?? ''
      let plan = 'starter'
      if (priceId.includes('pro') || sub.items.data[0]?.price?.unit_amount === 8900 || sub.items.data[0]?.price?.unit_amount === 85440) plan = 'pro'
      if (priceId.includes('entreprise') || sub.items.data[0]?.price?.unit_amount === 24900 || sub.items.data[0]?.price?.unit_amount === 239040) plan = 'entreprise'

      if (!planMap[plan]) planMap[plan] = { count: 0, mrr: 0 }
      planMap[plan].count++
      const amount = (sub.items.data[0]?.price?.unit_amount ?? 0) / 100
      const interval = sub.items.data[0]?.price?.recurring?.interval
      planMap[plan].mrr += interval === 'year' ? amount / 12 : amount
    }

    // ── Monthly revenue history (last 6 months) ──
    const revenueHistory: { month: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthCharges = charges.data.filter(c =>
        c.paid && !c.refunded &&
        new Date(c.created * 1000) >= start &&
        new Date(c.created * 1000) < end
      )
      revenueHistory.push({
        month: start.toLocaleDateString('fr-CH', { month: 'short', year: '2-digit' }),
        amount: monthCharges.reduce((sum, c) => sum + (c.amount / 100), 0),
      })
    }

    // ── Recent transactions ──
    const recentPayments = charges.data
      .filter(c => c.paid)
      .slice(0, 10)
      .map(c => ({
        id: c.id,
        amount: c.amount / 100,
        currency: c.currency.toUpperCase(),
        status: c.refunded ? 'refunded' : c.paid ? 'succeeded' : 'failed',
        customer_email: c.billing_details?.email
          ? c.billing_details.email.replace(/^(.{2}).*@/, '$1***@')
          : null,
        description: c.description ?? null,
        created: new Date(c.created * 1000).toISOString(),
      }))

    const result = {
      mrr: Math.round(mrr),
      activeSubscriptions: activeSubs.length,
      totalSubscriptions: subscriptions.data.length,
      churnedThisMonth: canceledThisMonth.length,
      pastDue: pastDueSubs.length,
      failedPaymentsThisMonth: failedCharges.length,
      revenueThisMonth: Math.round(revenueThisMonth),
      revenuePrevMonth: Math.round(revenuePrevMonth),
      revenueGrowth: revenuePrevMonth > 0 ? Math.round(((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100) : 0,
      arpu: activeSubs.length > 0 ? Math.round(mrr / activeSubs.length) : 0,
      planBreakdown: Object.entries(planMap).map(([plan, data]) => ({ plan, ...data, mrr: Math.round(data.mrr) })),
      revenueHistory,
      upcomingRenewals: upcomingInvoices.slice(0, 5),
      recentPayments,
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = (err as Error).message
    const status = msg === 'Forbidden' ? 403 : msg === 'Unauthorized' ? 401 : 500
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
