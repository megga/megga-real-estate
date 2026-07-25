// MEGGA Auth — Audit log côté client
// Insère une ligne dans `auth_events` via l'edge function `log-auth-event`
// (qui hash l'IP côté serveur et lit le user-agent des en-têtes — voir
// supabase/functions/log-auth-event/).
//
// Chemin UNIQUE : l'edge function écrit en service_role. L'ancien fallback
// (INSERT direct dans la table) était silencieusement bloqué par la RLS
// (aucune policy INSERT) et le rouvrir exposerait une écriture anon sur une
// table d'audit — retiré, grants d'écriture client révoqués (migration
// 20260719150000). Best-effort : un échec d'audit ne casse jamais un flow d'auth.
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

export async function logAuthEvent(
  action: AuthAction,
  options: { userId?: string | null; detail?: string; severity?: Severity } = {},
): Promise<void> {
  const { userId, detail, severity } = options
  try {
    await supabase.functions.invoke('log-auth-event', {
      body: {
        action,
        user_id: userId ?? null,
        detail: detail?.slice(0, 512) ?? null,
        severity: severity ?? SEVERITY_DEFAULT[action],
      },
    })
  } catch {
    // Silently fail — l'audit log ne doit jamais casser un flow d'auth.
  }
}
