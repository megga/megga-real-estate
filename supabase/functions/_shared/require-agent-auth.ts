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
import { isNonUserToken } from './bearer-token.ts'

/**
 * Le contexte rendu quand l'agence est EXIGÉE (le défaut) : `agency_id` y est non nul,
 * parce que le garde a refusé avant de rendre.
 */
export interface AgentAuthContext {
  user: { id: string; email?: string }
  profile: { id: string; agency_id: string; role: string | null }
  supabase: SupabaseClient
}

/**
 * Le contexte rendu sous `allowNoAgency` : `agency_id` peut être NULL.
 *
 * ⛔ DEUX TYPES ET NON UN SEUL ÉLARGI, et l'écart n'est pas cosmétique. Élargir
 * `AgentAuthContext` en `string | null` a fait rougir SEPT appelants qui, eux, exigent
 * l'agence : le garde la leur garantit, mais le type ne le disait plus. Le remède aurait
 * été sept `!` ou sept `?? ''` — c'est-à-dire éteindre partout la vérification pour un
 * cas qui ne les concerne pas, et perdre le jour où l'un d'eux prendrait vraiment l'opt-in.
 * La surcharge fait porter la nullité par le SEUL appelant qui la demande.
 */
export interface AgentAuthContextSansAgence {
  user: { id: string; email?: string }
  profile: { id: string; agency_id: string | null; role: string | null }
  supabase: SupabaseClient
}

export interface AgentAuthOptions {
  /** Accepte un profil SANS agence. Réservé aux gestes qui concernent la personne. */
  allowNoAgency?: boolean
}

export function requireAgentAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AgentAuthContext | Response>
export function requireAgentAuth(
  req: Request,
  corsHeaders: Record<string, string>,
  options: { allowNoAgency: true },
): Promise<AgentAuthContextSansAgence | Response>
export function requireAgentAuth(
  req: Request,
  corsHeaders: Record<string, string>,
  options?: AgentAuthOptions,
): Promise<AgentAuthContext | Response>
export async function requireAgentAuth(
  req: Request,
  corsHeaders: Record<string, string>,
  options?: AgentAuthOptions,
): Promise<AgentAuthContextSansAgence | Response> {
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

  // Une clé d'API du projet (anon / service_role) est un JWT sans `sub` : GoTrue
  // la refuse à coup sûr. On tranche donc ici — même réponse qu'en dessous, mais
  // sans l'aller-retour ni la ligne d'erreur dans les journaux d'auth.
  if (isNonUserToken(token)) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired session' }),
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

  // ⛔ L'AGENCE N'EST PAS TOUJOURS REQUISE, et l'exiger partout a coûté un parcours entier.
  // Un super-admin n'a pas d'`agency_id` (mesuré le 17.08.2026 : `hello@juarts.com`,
  // agence NULL). Toute fonction passant par ce garde lui rendait donc 403 — y compris la
  // simple sonde « la vérification par code est-elle disponible ? », dont l'échec faisait
  // silencieusement disparaître la voie OTP de l'écran. L'appairage, lui, passe par une RPC
  // directe qui n'a jamais eu cette contrainte : d'où une asymétrie invisible où l'un des
  // deux chemins marchait et l'autre pas, sans que rien ne le dise.
  //
  // ⚠ `allowNoAgency` est un OPT-IN : le défaut reste l'exigence, parce que la plupart des
  // fonctions écrivent des données scopées au tenant et qu'un `agency_id` nul y serait un
  // trou. Ne l'activer que là où le geste concerne la PERSONNE et non son agence — vérifier
  // son propre numéro, par exemple.
  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ error: 'Agent profile or agency missing' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
  if (!profile.agency_id && !options?.allowNoAgency) {
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
