// supabase/functions/sync-service-key/index.ts
// Self-heal de la copie DB de la clé service-role.
//
// Problème (incident 2026-06-10) : les wrappers pg_cron (daily_matching_scan,
// hourly_automation_scan, run_search_alerts, crons WhatsApp…) appellent les edge
// functions avec app_config.service_role_key. Cette ligne était une copie MANUELLE
// de la clé : après la rotation post-incident (cf. src/lib/supabase.ts), elle est
// restée périmée → 401 silencieux sur tous les crons internes ; daily_matching_scan
// n'a plus créé un seul match du 16/04 au 10/06.
//
// Fix : l'env du runtime edge (SUPABASE_SERVICE_ROLE_KEY) est gérée par la
// plateforme et toujours à jour — c'est la source de vérité. Cette fonction
// recopie env → app_config. Déclenchée par le cron sync-service-key-hourly
// (wrapper public.sync_service_role_key) et à la demande après une rotation.
// La valeur écrite vient EXCLUSIVEMENT de l'env : le caller ne peut rien injecter.
//
// Auth : header x-sync-token comparé à app_config.service_key_sync_token
// (provisionné hors-git ; si absent → 500 explicite, rien n'est écrit).
// Pas de CORS : endpoint serveur↔serveur uniquement, jamais appelé du navigateur.
// Ne retourne JAMAIS la clé (ni en clair, ni hashée).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function sha256hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'runtime env missing' })

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: tokenRow, error: tokenErr } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'service_key_sync_token')
    .maybeSingle()
  if (tokenErr) return json(500, { error: 'config read failed' })
  if (!tokenRow?.value) return json(500, { error: 'sync token not provisioned' })

  const presented = req.headers.get('x-sync-token') ?? ''
  // Comparaison d'empreintes : pas de short-circuit dépendant du contenu du jeton.
  if (!presented || (await sha256hex(presented)) !== (await sha256hex(tokenRow.value))) {
    return json(401, { error: 'unauthorized' })
  }

  const { data: keyRow, error: keyErr } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'service_role_key')
    .maybeSingle()
  if (keyErr) return json(500, { error: 'config read failed' })

  const updated = keyRow?.value !== serviceRoleKey
  if (updated) {
    const { error: upErr } = await supabase
      .from('app_config')
      .upsert({ key: 'service_role_key', value: serviceRoleKey })
    if (upErr) return json(500, { error: 'config write failed' })
  }

  return json(200, { ok: true, updated })
})
