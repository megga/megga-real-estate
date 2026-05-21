// MEGGA Auth — Audit log côté client
// Insère une ligne dans `auth_events` via l'edge function `log-auth-event`
// (qui hash l'IP côté serveur — voir supabase/functions/log-auth-event/).
//
// Fallback : si l'edge function ne répond pas, on insert directement dans la
// table (sans ip_hash). On préfère un audit partiel plutôt qu'un audit absent.
// nLPD : aucun email/PII brut envoyé, juste action + sévérité + détail technique.
import { supabase } from '@/lib/supabase'

export type AuthAction =
  | 'signin.success'
  | 'signin.failure'
  | 'signup.created'
  | 'signup.failure'
  | 'magic_link.sent'
  | 'magic_link.failure'
  | 'password.reset_requested'
  | 'password.reset_failure'
  | 'password.reset_confirmed'
  | 'oauth.signin.success'
  | 'oauth.signin.failure'
  | 'signout'

type Severity = 'info' | 'warn' | 'error'

const SEVERITY_DEFAULT: Record<AuthAction, Severity> = {
  'signin.success': 'info',
  'signin.failure': 'warn',
  'signup.created': 'info',
  'signup.failure': 'warn',
  'magic_link.sent': 'info',
  'magic_link.failure': 'warn',
  'password.reset_requested': 'info',
  'password.reset_failure': 'warn',
  'password.reset_confirmed': 'info',
  'oauth.signin.success': 'info',
  'oauth.signin.failure': 'warn',
  signout: 'info',
}

function truncatedUA(): string {
  if (typeof navigator === 'undefined') return ''
  return (navigator.userAgent || '').slice(0, 256)
}

export async function logAuthEvent(
  action: AuthAction,
  options: { userId?: string | null; detail?: string; severity?: Severity } = {},
): Promise<void> {
  const { userId, detail, severity } = options
  const payload = {
    action,
    user_id: userId ?? null,
    detail: detail?.slice(0, 512) ?? null,
    severity: severity ?? SEVERITY_DEFAULT[action],
  }

  // 1. Edge function (hashes IP server-side). Best path.
  try {
    const { error } = await supabase.functions.invoke('log-auth-event', {
      body: payload,
    })
    if (!error) return
    // Function returned a non-2xx — fall through to direct insert.
  } catch {
    // Network error or function not deployed — fall through.
  }

  // 2. Fallback : direct insert (no ip_hash). Better than no audit.
  try {
    await supabase.from('auth_events').insert({
      user_id: payload.user_id,
      action: payload.action,
      severity: payload.severity,
      user_agent: truncatedUA(),
      detail: payload.detail,
    })
  } catch {
    // Silently fail — l'audit log ne doit jamais casser un flow d'auth.
  }
}
