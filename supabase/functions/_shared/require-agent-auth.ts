// supabase/functions/_shared/require-agent-auth.ts
// Auth helper for Edge Functions that must run on behalf of an authenticated agent.
//
// Returns `{ user, profile, supabase }` if the JWT is valid AND the user has a
// profiles row with an agency_id. Returns an HTTP `Response` (401/403) otherwise,
// which the caller must return as-is.
//
// Usage:
//   const auth = await requireAgentAuth(req, corsHeaders)
//   if (auth instanceof Response) return auth
//   const { user, profile, supabase } = auth
//   // profile.agency_id is the only trusted source of agency identity.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AgentAuthContext {
  user: { id: string; email?: string }
  profile: { id: string; agency_id: string; role: string | null }
  supabase: SupabaseClient
}

export async function requireAgentAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AgentAuthContext | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: SUPABASE_URL / SERVICE_ROLE_KEY missing' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const token = authHeader.slice('bearer '.length).trim()
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: userData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userData.user) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired session' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, agency_id, role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile?.agency_id) {
    return new Response(
      JSON.stringify({ error: 'Agent profile or agency missing' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  return {
    user: { id: userData.user.id, email: userData.user.email },
    profile: { id: profile.id, agency_id: profile.agency_id, role: profile.role },
    supabase,
  }
}
