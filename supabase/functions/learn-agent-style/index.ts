// supabase/functions/learn-agent-style/index.ts
// Cron quotidien : distille le style de communication de chaque agent (via DeepSeek)
// et écrit learned_style dans agent_ai_profiles (status = 'suggested' par défaut,
// préserve 'active'/'off' posé par l'humain).
// Appelé UNIQUEMENT par pg_cron en service-role. verify_jwt=false (config.toml) — garde
// applicative alignée sur app_config.service_role_key (comme whatsapp-agent-async, §3.5).
//
// Compliance/PII : le prompt interdit explicitement toute donnée personnelle dans les traits ;
// traits bornés à 240 chars. Best-effort : DeepSeek timeout ou signal insuffisant → continue.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MIN_MSGS = 10            // pas de profil tant qu'on n'a pas assez de signal
const SAMPLE = 30              // derniers messages échantillonnés
const BATCH = 5               // agents distillés par tick (cron quotidien, coût borné)
const DEEPSEEK_TIMEOUT_MS = 20_000

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0
}
const json = (o: unknown, c: number) => new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // Garde : appelé par pg_cron avec Bearer = app_config.service_role_key (comme whatsapp-agent-async).
  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()
  const expected = (cfg?.value as string) ?? ''
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!expected || !safeEqual(provided, expected)) return json({ error: 'Forbidden' }, 403)

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) return json({ error: 'no deepseek key' }, 200)

  // Agents vérifiés avec un numéro WhatsApp.
  const { data: links } = await admin.from('whatsapp_agent_links')
    .select('profile_id, wa_number').eq('verified', true).not('wa_number', 'is', null).limit(BATCH)
  let done = 0
  for (const link of links ?? []) {
    const waNumber = (link.wa_number as string) ?? ''
    if (!waNumber) continue
    // Messages ENTRANTS de l'agent (son style), récents.
    const { data: msgs } = await admin.from('whatsapp_messages')
      .select('body').eq('wa_from', waNumber).eq('direction', 'inbound')
      .not('body', 'is', null).order('created_at', { ascending: false }).limit(SAMPLE)
    const texts = (msgs ?? []).map((m) => (m.body as string)).filter((b) => b && b.trim().length > 1)
    if (texts.length < MIN_MSGS) continue

    const prompt = `Voici des messages écrits par un agent immobilier à son assistante. Résume SON style de communication. Réponds UNIQUEMENT en JSON strict: {"language":"fr|en|mixed","formality":"tu|vous|direct","emoji":true|false,"traits":"1-2 phrases sur ses tournures/préférences"}. RÈGLE ABSOLUE: décris le STYLE seulement — AUCUN nom, adresse, montant, ni donnée de contact. Messages:\n${texts.slice(0, SAMPLE).map((t) => `- ${t.slice(0, 200)}`).join('\n')}`
    let style: { language: string; formality: string; emoji: boolean; traits: string } | null = null
    try {
      const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0, max_tokens: 300, response_format: { type: 'json_object' } }),
        signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
      })
      if (!r.ok) { console.error('deepseek http', r.status); continue }
      const d = await r.json()
      style = JSON.parse(d?.choices?.[0]?.message?.content ?? 'null')
    } catch (e) { console.error('distill failed:', (e as Error)?.name ?? 'error'); continue }
    if (!style || !['fr', 'en', 'mixed'].includes(style.language)) continue

    // Préserve un status posé par l'humain (active/off) ; sinon 'suggested'.
    const { data: existing } = await admin.from('agent_ai_profiles')
      .select('learned_style').eq('agent_id', link.profile_id).maybeSingle()
    const prevStatus = (existing?.learned_style as { status?: string } | null)?.status
    const status = prevStatus === 'active' || prevStatus === 'off' ? prevStatus : 'suggested'
    const learned = {
      language: style.language, formality: ['tu', 'vous', 'direct'].includes(style.formality) ? style.formality : 'tu',
      emoji: !!style.emoji, traits: (style.traits ?? '').slice(0, 240),
      status, updated_at: new Date().toISOString(), sample_count: texts.length,
    }
    // upsert : agent_ai_profiles a agent_id en PK ; un profil Day-0 existe déjà normalement.
    await admin.from('agent_ai_profiles').upsert({ agent_id: link.profile_id, learned_style: learned }, { onConflict: 'agent_id' })
    done++
  }
  return json({ ok: true, distilled: done }, 200)
})
