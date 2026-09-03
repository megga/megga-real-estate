// supabase/functions/mail-sync/index.ts
// Balayage de synchronisation. Deux appelants :
//   - pg_cron `mail-sync-2min` (Bearer = clé service, corps {}) : jusqu'à 25 comptes dus ;
//   - un agent connecté (`{ account_id }`) via mail-actions `sync_now` ou directement :
//     UN compte, visible par lui, budget court — c'est le « rafraîchir » de l'écran.
// Un bail en base (mail_cron_locks) empêche deux balayages simultanés : le budget
// (60 s) dépasse l'intervalle (120 s) rarement, mais un tick lent + un tick suivant
// = double coût fournisseur et curseurs en course. Le TTL (180 s) est le filet.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { loadVisibleAccount, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import type { MailAccountRow } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const SWEEP_BUDGET_MS = 60_000
const PER_ACCOUNT_BUDGET_MS = 20_000
const TARGETED_BUDGET_MS = 20_000
const MAX_ACCOUNTS_PER_TICK = 25
const LOCK_TTL_MS = 180_000

async function acquireLock(admin: SupabaseClient): Promise<boolean> {
  const until = new Date(Date.now() + LOCK_TTL_MS).toISOString()
  const { data } = await admin.from('mail_cron_locks').update({ locked_until: until })
    .eq('job', 'mail-sync').lt('locked_until', new Date().toISOString()).select('job')
  return (data ?? []).length === 1
}
async function releaseLock(admin: SupabaseClient): Promise<void> {
  await admin.from('mail_cron_locks').update({ locked_until: new Date().toISOString() }).eq('job', 'mail-sync')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // Le client service-role est la SEULE lecture de configuration autorisée avant la
  // garde : `isServiceSecret` en a besoin pour lire `app_config`. Les secrets des
  // fournisseurs, eux, se lisent APRÈS — règle 4 du lot (corrigé le 03.09.2026 :
  // la version d'origine lisait les quatre secrets et interrogeait app_config avant
  // de refuser un appelant anonyme).
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* corps vide = balayage */ }

  // ── Appel ciblé par un agent ───────────────────────────────────────────────
  if (typeof body.account_id === 'string') {
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth
    const cfg = providerConfigFromEnv((k) => Deno.env.get(k))
    const account = await loadVisibleAccount(auth.supabase, body.account_id, { userId: auth.user.id, agencyId: auth.profile.agency_id })
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.status !== 'active') return json({ error: 'account_not_active', status: account.status }, 409)
    const r = await syncAccount(auth.supabase, account, cfg, TARGETED_BUDGET_MS)
    return json({ account_id: account.id, ...r })
  }

  // ── Balayage cron ──────────────────────────────────────────────────────────
  if (!(await isServiceSecret(admin, req))) return json({ error: 'unauthorized' }, 401)
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))
  if (!(await acquireLock(admin))) return json({ ok: true, skipped: 'locked' })
  const started = Date.now()
  const results: Record<string, unknown>[] = []
  try {
    const { data: due } = await admin.from('mail_accounts').select('*')
      .eq('status', 'active').lte('next_sync_at', new Date().toISOString())
      .order('next_sync_at', { ascending: true }).limit(MAX_ACCOUNTS_PER_TICK)
    for (const account of (due ?? []) as MailAccountRow[]) {
      if (Date.now() - started > SWEEP_BUDGET_MS) break
      const r = await syncAccount(admin, account, cfg, Math.min(PER_ACCOUNT_BUDGET_MS, SWEEP_BUDGET_MS - (Date.now() - started)))
      results.push({ account_id: account.id, provider: account.provider, ...r })
    }
  } finally {
    await releaseLock(admin)
  }
  return json({ ok: true, synced: results.length, elapsed_ms: Date.now() - started, results })
})
