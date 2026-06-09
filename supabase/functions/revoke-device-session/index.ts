// supabase/functions/revoke-device-session/index.ts
//
// Révocation RÉELLE d'une session : « Déconnecter cet appareil » dans Réglages >
// Sécurité. Contrairement à la suppression de ligne (qui ne coupait que le suivi),
// on invalide la vraie session GoTrue via la RPC service_role revoke_user_session,
// puis on retire la ligne user_devices.
//
// Sécurité : le caller est authentifié (admin.getUser sur son JWT) ; on ne révoque
// que si la ligne lui appartient (user_id = caller) ; la RPC re-vérifie le user_id.
//
// Limite Supabase (assumée) : couper la session coupe le REFRESH ; l'access token
// déjà émis sur l'appareil reste valide jusqu'à son exp (~1h).
//
// DEPLOYMENT : déployer avec `--no-verify-jwt` (les tokens ES256 sont rejetés par
// la gateway avant d'arriver ici ; on vérifie nous-mêmes via admin.getUser).
//   supabase functions deploy revoke-device-session --no-verify-jwt

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) return json({ error: 'unauthorized' }, 401)

    const body = (await req.json().catch(() => ({}))) as { device_id?: string }
    const deviceId = body.device_id
    if (!deviceId) return json({ error: 'device_id required' }, 400)

    // Propriété : la ligne doit appartenir au caller (sinon 404, pas d'info leak).
    const { data: device, error: selErr } = await admin
      .from('user_devices')
      .select('id, session_id')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (selErr) return json({ error: 'internal' }, 500)
    if (!device) return json({ error: 'not_found' }, 404)

    // Révoque la vraie session GoTrue si le lien existe (lignes créées après la
    // migration session_id). Les lignes plus anciennes n'ont pas de session_id :
    // on retire alors juste le suivi (comportement historique, dégradation propre).
    let sessionRevoked = false
    if (device.session_id) {
      const { error: rpcErr } = await admin.rpc('revoke_user_session', {
        p_user_id: user.id,
        p_session_id: device.session_id,
      })
      if (rpcErr) {
        console.error('revoke_user_session rpc error:', rpcErr.message)
        return json({ error: 'revoke_failed' }, 500)
      }
      sessionRevoked = true
    }

    const { error: delErr } = await admin
      .from('user_devices')
      .delete()
      .eq('id', deviceId)
      .eq('user_id', user.id)
    if (delErr) return json({ error: 'internal' }, 500)

    return json({ ok: true, sessionRevoked })
  } catch (e) {
    console.error('revoke-device-session error:', (e as Error).message)
    return json({ error: 'internal' }, 500)
  }
})
