// supabase/functions/intercom-identity/index.ts
// Émet un JWT « Messenger Security » Intercom pour l'agent authentifié.
//   JWT HS256 signé avec INTERCOM_MESSENGER_SECRET, payload { user_id, email, exp }.
// (Intercom a déprécié le HMAC user_hash → JWT est la méthode actuelle. Le secret
//  ne quitte jamais l'Edge.) verify_jwt=false → l'auth se fait DANS la fonction via
// requireAgentAuth (Bearer du user validé contre Supabase Auth).
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const enc = new TextEncoder()

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? enc.encode(input) : input
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user } = auth

  const secret = Deno.env.get('INTERCOM_MESSENGER_SECRET')
  if (!secret) {
    return new Response(JSON.stringify({ error: 'INTERCOM_MESSENGER_SECRET missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { user_id: user.id, email: user.email, exp: now + 60 * 60 } // 1h

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput))
  const jwt = `${signingInput}.${b64url(new Uint8Array(sig))}`

  return new Response(JSON.stringify({ intercom_user_jwt: jwt }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
