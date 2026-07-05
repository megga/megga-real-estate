// supabase/functions/weekly-digest/index.ts
// Digest hebdomadaire (fin de Phase 3) : bilan de la semaine envoyé par email à
// chaque agent le vendredi. Appelé UNIQUEMENT par pg_cron (service-role).
//
// Bilan 100% AGRÉGÉ (compteurs) → aucune PII client ne part vers DeepSeek. Push
// vers l'AGENT seul, jamais un client. Gated app_config weekly_digest_enabled +
// opt-out par agent (profiles.weekly_digest_opt_out). Fallback déterministe.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildDigestSnapshot, digestPrompt, digestHtml, fallbackDigest, isQuietWeek,
  type WeeklyCounts,
} from '../_shared/weekly-digest.ts'
import { meggaProse } from '../_shared/megga-prose.ts'

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Cron-only : bearer == service-role (secret partagé, comparaison constante).
  const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!svcKey || !safeEqual(bearer, svcKey)) return json({ error: 'Forbidden' }, 403)

  let agencyId = ''
  try { agencyId = String((await req.json())?.agency_id ?? '') } catch { /* ignore */ }
  if (!agencyId) return json({ error: 'agency_id required' }, 400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, svcKey)

  // Kill-switch.
  const { data: flag } = await supabase.from('app_config').select('value').eq('key', 'weekly_digest_enabled').maybeSingle()
  if (flag?.value !== 'true') return json({ skipped: 'disabled' })

  // Destinataires : staff d'agence (agent/manager/admin), non désabonnés, avec email.
  // Les rôles clients (buyer/seller/particulier) sont exclus par construction.
  const { data: agents } = await supabase
    .from('profiles').select('id, email')
    .eq('agency_id', agencyId).in('role', ['agent', 'manager', 'admin']).eq('weekly_digest_opt_out', false)
  const recipients = (agents ?? []).filter((a) => a.email && a.email.includes('@'))
  if (!recipients.length) return json({ skipped: 'no_recipients' })

  // ── Bilan agrégé de la semaine (scope agence, 7 jours). Requêtes bornées
  //    (id + limit) : pas de count exact (règles perf §7). ────────────────────
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const countRows = async (q: { data: unknown[] | null }) => (q.data?.length ?? 0)

  const [dealEv, kycEv, newContacts, visitsDone, radar, activeTx] = await Promise.all([
    supabase.from('activity_events').select('id').eq('agency_id', agencyId).eq('category', 'deal').gte('created_at', weekAgo).limit(500),
    supabase.from('activity_events').select('id').eq('agency_id', agencyId).eq('category', 'kyc').gte('created_at', weekAgo).limit(500),
    supabase.from('contacts').select('id').eq('agency_id', agencyId).gte('created_at', weekAgo).limit(500),
    supabase.from('visits').select('id').eq('agency_id', agencyId).eq('status', 'done').gte('completed_at', weekAgo).limit(500),
    supabase.from('reminders').select('id').eq('agency_id', agencyId).eq('status', 'pending').in('type', ['deal_stagnant', 'match_ignored']).limit(500),
    supabase.from('transactions').select('price_offered, price_final, property:properties(price)').eq('agency_id', agencyId).eq('status', 'active').limit(500),
  ])

  type TxRow = { price_offered: number | null; price_final: number | null; property: { price: number | null } | { price: number | null }[] | null }
  const txRows = (activeTx.data ?? []) as TxRow[]
  const pipelineValue = txRows.reduce((sum, t) => {
    const prop = Array.isArray(t.property) ? t.property[0] : t.property
    const v = t.price_final ?? t.price_offered ?? prop?.price ?? 0
    return sum + (typeof v === 'number' ? v : 0)
  }, 0)

  const counts: WeeklyCounts = {
    dealsMoved: await countRows(dealEv),
    kycEvents: await countRows(kycEv),
    newContacts: await countRows(newContacts),
    visitsDone: await countRows(visitsDone),
    radarSignals: await countRows(radar),
    activeDeals: txRows.length,
    activePipelineValue: pipelineValue,
  }

  // Semaine calme → pas d'email (respect de l'attention de l'agent).
  if (isQuietWeek(counts)) return json({ skipped: 'quiet_week', agency_id: agencyId })

  // Synthèse (DeepSeek ne voit que des chiffres) + fallback déterministe.
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  let bodyText = fallbackDigest(counts)
  if (apiKey) {
    try {
      const r = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat', max_tokens: 500,
          messages: [{ role: 'user', content: digestPrompt(buildDigestSnapshot(counts)) }],
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (r.ok) {
        const d = await r.json()
        const raw = meggaProse(d.choices?.[0]?.message?.content || '')
        if (raw.trim()) bodyText = raw.trim()
      }
    } catch { /* garde le fallback */ }
  }

  const weekLabel = new Date().toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })
  const html = digestHtml(bodyText, `Semaine au ${weekLabel}`)
  const resendKey = Deno.env.get('RESEND_API_KEY')

  let sent = 0
  if (resendKey) {
    for (const a of recipients) {
      try {
        const rr = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'MEGGA AI <noreply@megga.ch>',
            to: [a.email],
            subject: 'Ton bilan de la semaine',
            html,
            tags: [{ name: 'type', value: 'weekly_digest' }, { name: 'agency', value: agencyId }],
          }),
        })
        if (rr.ok) sent++
      } catch { /* continue */ }
    }
  }

  // Audit (best-effort).
  try {
    await supabase.from('activity_events').insert({
      agency_id: agencyId, actor_id: null, actor_kind: 'ai',
      action: 'MEGGA AI — digest hebdo', entity_type: 'ai_chat', entity_id: null, category: 'ai',
      metadata: { recipients: recipients.length, sent, radar_signals: counts.radarSignals },
    })
  } catch { /* ignore */ }

  return json({ agency_id: agencyId, recipients: recipients.length, sent })
})
