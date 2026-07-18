// supabase/functions/_shared/require-super-admin.ts
// Garde d'authentification pour les Edge Functions SUPER-ADMIN.
//
// Vérifie, dans l'ordre :
//   1. Bearer token → auth.getUser() (session valide)
//   2. profiles.role === 'super_admin'
//   3. Email allowlisté via la RPC SQL super_admin_allowlist_match — MÊME
//      source de vérité que is_super_admin() (migration 20260705160000) :
//      un rôle super_admin posé sur un email hors allowlist ne passe PAS.
//
// Retourne `{ user, supabase }` (client service-role) si tout passe, sinon
// une `Response` 401/403 que l'appelant doit renvoyer telle quelle.
//
// Usage :
//   const auth = await requireSuperAdmin(req, corsHeaders)
//   if (auth instanceof Response) return auth
//   const { user, supabase } = auth

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface SuperAdminContext {
  user: { id: string; email: string }
  supabase: SupabaseClient
}

function json(status: number, body: unknown, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export async function requireSuperAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<SuperAdminContext | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: 'Server misconfigured: SUPABASE_URL / SERVICE_ROLE_KEY missing' }, corsHeaders)
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json(401, { error: 'Authentication required' }, corsHeaders)
  }
  const token = authHeader.slice('bearer '.length).trim()
  if (!token) {
    return json(401, { error: 'Authentication required' }, corsHeaders)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const { data: userData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userData.user) {
    return json(401, { error: 'Invalid or expired session' }, corsHeaders)
  }
  const user = userData.user

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'super_admin') {
    return json(403, { error: 'Forbidden: super_admin required' }, corsHeaders)
  }

  const { data: allowed, error: allowError } = await supabase.rpc('super_admin_allowlist_match', {
    p_email: user.email ?? '',
  })
  if (allowError || allowed !== true) {
    return json(403, { error: 'Forbidden: account not allowlisted' }, corsHeaders)
  }

  return { user: { id: user.id, email: user.email ?? '' }, supabase }
}
