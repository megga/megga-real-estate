// supabase/functions/whatsapp-agent-async/index.ts
// Worker cron des outils KYC lents (run_kyc_screening, send_kyc_report) sortis de la
// boucle DeepSeek. Réclame des jobs (claim_whatsapp_async_jobs), exécute l'outil hors
// requête, et LIVRE LE RÉSULTAT À L'AGENT SEUL (jamais au client) via buildSendTextRequest.
// Appelé UNIQUEMENT par pg_cron en service-role. verify_jwt=false (config.toml) — garde
// applicative alignée sur app_config.service_role_key (comme whatsapp-process, §3.5).
//
// Compliance : le résultat va au numéro de l'agent ; aucune validation KYC automatique
// (is_completed reste réservé MLRO). DeepSeek inchangé : les exec* font le travail.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, type SendConfig } from '../_shared/whatsapp-gateway.ts'
import { execRunKycScreening, execSendKycReport, type ActionCtx } from '../_shared/whatsapp-actions.ts'
import { asWaLang } from '../_shared/whatsapp-i18n.ts'

// Jobs lourds (~50-60s chacun) : on en réclame UN par tick. Le cron tourne chaque minute,
// donc un backlog se draine à 1/min — largement suffisant pour du KYC déclenché par l'agent,
// et ça évite de sur-réclamer (claim > traitable = jobs bloqués en 'processing' 5 min).
const BATCH = 1
const MAX_RETRIES = 3
const BUDGET_MS = 90_000

function json(o: unknown, c: number): Response {
  return new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json' } })
}
// Comparaison à temps constant (anti timing-attack sur le secret service-role).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Garde service-role : pg_cron envoie Bearer <service_role_key d'app_config>. verify_jwt=FALSE
  // (clé legacy rejetée sinon) — on compare le token reçu à app_config (même source que le cron).
  {
    const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()
    const expectedKey = (cfg?.value as string | undefined) ?? ''
    const providedKey = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!expectedKey || !safeEqual(providedKey, expectedKey)) return json({ error: 'Forbidden' }, 403)
  }

  const t0 = Date.now()
  const overBudget = () => Date.now() - t0 > BUDGET_MS
  const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
  const apiVersion = Deno.env.get('META_API_VERSION') ?? 'v22.0'
  const metaPhoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID') ?? ''
  const provider = getProvider('meta')
  const sendCfg: SendConfig = { metaToken, metaPhoneNumberId, metaApiVersion: apiVersion }

  const { data: jobs, error } = await admin.rpc('claim_whatsapp_async_jobs', { p_batch: BATCH })
  if (error) return json({ error: error.message }, 500)

  let done = 0, failed = 0
  for (const j of (jobs ?? []) as Array<Record<string, unknown>>) {
    if (overBudget()) break  // reste 'processing' → repris au tick suivant (>5 min)
    const id = j.id as string
    try {
      const ctx: ActionCtx = {
        supabase: admin,
        profileId: j.profile_id as string,
        agencyId: (j.agency_id as string | null) ?? null,
        inboundMedia: null,
        lang: asWaLang(j.lang),
        agentPhone: j.wa_agent_phone as string,
      }
      const args = (j.args as Record<string, unknown>) ?? {}
      const tool = j.tool as string
      const result = tool === 'run_kyc_screening'
        ? await execRunKycScreening(ctx, args)
        : await execSendKycReport(ctx, args)

      // Livrer le résultat à l'AGENT seul (jamais au client). Fenêtre 24h ouverte.
      // send_kyc_report : execSendKycReport a DÉJÀ envoyé le PDF (avec légende) à l'agent
      // via kyc-report-pdf → pas de texte redondant ici. C'est aussi une garde anti-doublon :
      // un échec d'envoi APRÈS le PDF ferait re-tourner le job (PDF en double, pas de verrou
      // côté report). run_kyc_screening : ce texte EST la seule livraison → on l'envoie, mais
      // en try/catch ISOLÉ pour qu'un échec Meta ne déclenche pas un retry du job entier
      // (qui re-screenerait — le verrou P1 l'en empêcherait, mais on évite le bruit).
      if (tool === 'run_kyc_screening' && metaToken && metaPhoneNumberId) {
        try {
          const sreq = provider.buildSendTextRequest({ toPhone: j.wa_agent_phone as string, body: result }, sendCfg)
          const sres = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
          if (!sres.ok) console.error('wa-agent-async agent send not ok:', sres.status)
        } catch (e) {
          console.error('wa-agent-async agent send failed:', (e as Error)?.name ?? 'error')
        }
      }
      await admin.from('whatsapp_async_jobs').update({
        status: 'done', result_summary: result.slice(0, 500), last_error: null,
      }).eq('id', id)
      done++
    } catch (e) {
      const rc = ((j.retry_count as number) ?? 0) + 1
      await admin.from('whatsapp_async_jobs').update({
        status: rc >= MAX_RETRIES ? 'failed' : 'pending',
        retry_count: rc,
        last_error: String((e as Error)?.message ?? 'error').slice(0, 300),
      }).eq('id', id)
      failed++
    }
  }

  return json({ ok: true, claimed: (jobs ?? []).length, done, failed }, 200)
})
