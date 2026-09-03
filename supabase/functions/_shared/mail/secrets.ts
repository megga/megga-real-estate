// supabase/functions/_shared/mail/secrets.ts
// Jetons de boîte : lecture/écriture Vault par les ponts mail_secret_* (service-role
// seul) et rafraîchissement OAuth avec tampon de 5 minutes.
//
// ⚠ Microsoft peut renvoyer un NOUVEAU refresh_token à chaque rafraîchissement :
// on réécrit toujours le secret complet. Google ne le fait pas ; on garde l'ancien.
// ⚠ Un `invalid_grant` est DÉFINITIF (jeton révoqué, mot de passe changé) : le
// compte passe en `reauth_required`, visible dans l'UI — jamais un échec muet
// (leçon de host-freebusy qui éteignait sync_enabled en silence).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { AccountSecret, MailAccountRow, OAuthSecret } from './types.ts'

export interface OAuthClientConfig {
  clientId: string
  clientSecret: string
}
export interface SecretsDeps {
  fetch?: typeof fetch
  now?: () => number
}

export class MailAuthError extends Error {
  code: 'reauth_required' | 'no_secret' | 'provider_error'
  constructor(code: MailAuthError['code'], message: string) {
    super(message)
    this.code = code
  }
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
export const MS_MAIL_SCOPE = 'offline_access User.Read Mail.ReadWrite Mail.Send'
export const GOOGLE_MAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify openid email'
const REFRESH_BUFFER_MS = 5 * 60_000

// ── Vault ─────────────────────────────────────────────────────────────────────
export async function storeAccountSecret(admin: SupabaseClient, name: string, payload: AccountSecret): Promise<string> {
  const { data, error } = await admin.rpc('mail_secret_store', { p_secret: JSON.stringify(payload), p_name: name })
  if (error || !data) throw new Error(`vault store failed: ${error?.message ?? 'no id'}`)
  return data as string
}
export async function readAccountSecret<T extends AccountSecret>(admin: SupabaseClient, id: string): Promise<T | null> {
  const { data, error } = await admin.rpc('mail_secret_read', { p_id: id })
  if (error) throw new Error(`vault read failed: ${error.message}`)
  if (!data) return null
  return JSON.parse(data as string) as T
}
export async function updateAccountSecret(admin: SupabaseClient, id: string, payload: AccountSecret): Promise<void> {
  const { error } = await admin.rpc('mail_secret_update', { p_id: id, p_secret: JSON.stringify(payload) })
  if (error) throw new Error(`vault update failed: ${error.message}`)
}
export async function deleteAccountSecret(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.rpc('mail_secret_delete', { p_id: id })
  if (error) throw new Error(`vault delete failed: ${error.message}`)
}

// ── OAuth ─────────────────────────────────────────────────────────────────────
export function needsRefresh(expiresAt: string, now = Date.now(), bufferMs = REFRESH_BUFFER_MS): boolean {
  const t = Date.parse(expiresAt)
  if (Number.isNaN(t)) return true
  return t - now < bufferMs
}

export async function refreshOAuthToken(
  provider: 'gmail' | 'outlook',
  refreshToken: string,
  cfg: OAuthClientConfig,
  deps: SecretsDeps = {},
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const f = deps.fetch ?? globalThis.fetch
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  })
  if (provider === 'outlook') body.set('scope', MS_MAIL_SCOPE)
  const res = await f(provider === 'gmail' ? GOOGLE_TOKEN_URL : MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    const err = json.error ?? `http_${res.status}`
    if (err === 'invalid_grant' || res.status === 401) {
      throw new MailAuthError('reauth_required', `${provider}: ${err} ${json.error_description ?? ''}`.trim())
    }
    throw new MailAuthError('provider_error', `${provider}: ${err} ${json.error_description ?? ''}`.trim())
  }
  return { access_token: json.access_token, expires_in: json.expires_in ?? 3600, refresh_token: json.refresh_token }
}

/**
 * Rend un access token valide pour le compte, en rafraîchissant et en réécrivant
 * Vault si nécessaire. Marque le compte `reauth_required` sur refus définitif.
 */
export async function getValidAccessToken(
  admin: SupabaseClient,
  account: MailAccountRow,
  cfg: OAuthClientConfig,
  deps: SecretsDeps = {},
): Promise<string> {
  const now = deps.now ?? Date.now
  if (!account.vault_secret_id) throw new MailAuthError('no_secret', `account ${account.id} has no vault secret`)
  const secret = await readAccountSecret<OAuthSecret>(admin, account.vault_secret_id)
  if (!secret) throw new MailAuthError('no_secret', `account ${account.id}: vault secret missing`)
  if (!needsRefresh(secret.expires_at, now())) return secret.access_token

  if (account.provider !== 'gmail' && account.provider !== 'outlook') {
    throw new MailAuthError('provider_error', `account ${account.id}: ${account.provider} has no OAuth token`)
  }
  try {
    const r = await refreshOAuthToken(account.provider, secret.refresh_token, cfg, deps)
    const next: OAuthSecret = {
      refresh_token: r.refresh_token ?? secret.refresh_token,
      access_token: r.access_token,
      expires_at: new Date(now() + r.expires_in * 1000).toISOString(),
    }
    await updateAccountSecret(admin, account.vault_secret_id, next)
    return next.access_token
  } catch (e) {
    if (e instanceof MailAuthError && e.code === 'reauth_required') {
      await admin.from('mail_accounts')
        .update({ status: 'reauth_required', last_error: e.message })
        .eq('id', account.id)
    }
    throw e
  }
}
