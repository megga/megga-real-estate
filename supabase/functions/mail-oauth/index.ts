// supabase/functions/mail-oauth/index.ts
// Connexion d'une boîte par OAuth en pop-up (plan §3 D1, §4 « Ajouter une boîte »).
//   start      → { url, state }            (state + code_verifier gardés en base)
//   exchange   → { account }               (échange PKCE, identité, Vault, 1re synchro en fond)
//   disconnect → { ok }                    (révocation, Vault effacé, cascade)
//   update     → { account }               (display_name, visibility — propriétaire seul)
// Garde : requireAgentAuth AVANT toute lecture de configuration (règle 4 du lot).
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { buildAuthorizeUrl, exchangeCode, fetchIdentity, pkceChallenge, randomToken, revokeToken, type OAuthProvider } from '../_shared/mail/oauth.ts'
import { deleteAccountSecret, readAccountSecret, storeAccountSecret } from '../_shared/mail/secrets.ts'
import { loadVisibleAccount, providerConfigFromEnv, redirectUriFor } from '../_shared/mail/guard.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import type { MailAccountRow, OAuthSecret } from '../_shared/mail/types.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** Six libellés semés à la première boîte de l'agence (D12), dans la langue de l'agent. */
const SEED_LABELS: Record<'fr' | 'de' | 'en' | 'it', string[]> = {
  fr: ['À traiter', 'Banques', 'Notaires', 'Clients', 'Visites', 'Fournisseurs'],
  de: ['Zu erledigen', 'Banken', 'Notare', 'Kunden', 'Besichtigungen', 'Lieferanten'],
  en: ['To handle', 'Banks', 'Notaries', 'Clients', 'Viewings', 'Suppliers'],
  it: ['Da trattare', 'Banche', 'Notai', 'Clienti', 'Visite', 'Fornitori'],
}
const SEED_COLORS = ['#fe566b', '#8dc1ff', '#efc42c', '#adecbb', '#424bfb', '#686868'] // MXC_SYSTEM + accent + n500

const PUBLIC_COLS = 'id, agency_id, owner_id, provider, email, display_name, visibility, status, last_sync_at, last_error, created_at'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: admin } = auth
  const ctx = { userId: user.id, agencyId: profile.agency_id }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const action = String(body.action ?? '')
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))

  if (action === 'start') {
    const provider = body.provider as OAuthProvider
    if (provider !== 'gmail' && provider !== 'outlook') return json({ error: 'invalid_provider' }, 400)
    const redirectUri = redirectUriFor(String(body.origin ?? ''))
    if (!redirectUri) return json({ error: 'invalid_origin' }, 400)
    if (!cfg[provider].clientId) return json({ error: 'provider_not_configured', provider }, 503)
    const visibility = body.visibility === 'agency' ? 'agency' : 'owner'
    const loginHint = typeof body.login_hint === 'string' && body.login_hint.includes('@') ? body.login_hint.trim().toLowerCase() : null
    const state = randomToken(32)
    const codeVerifier = randomToken(48)
    const { error } = await admin.from('mail_oauth_states').insert({
      state, user_id: user.id, agency_id: profile.agency_id, provider, code_verifier: codeVerifier,
      login_hint: loginHint, visibility, redirect_uri: redirectUri,
    })
    if (error) return json({ error: 'state_store_failed' }, 500)
    const url = buildAuthorizeUrl(provider, { clientId: cfg[provider].clientId, redirectUri, state, codeChallenge: await pkceChallenge(codeVerifier), loginHint })
    return json({ url, state })
  }

  if (action === 'exchange') {
    const code = String(body.code ?? '')
    const state = String(body.state ?? '')
    if (!code || !/^[0-9a-f]{64}$/.test(state)) return json({ error: 'invalid_state' }, 403)
    const { data: st } = await admin.from('mail_oauth_states').select('*').eq('state', state).eq('user_id', user.id).maybeSingle()
    if (!st || st.consumed_at || new Date(st.expires_at).getTime() < Date.now()) return json({ error: 'invalid_state' }, 403)
    await admin.from('mail_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('state', state)
    const provider = st.provider as OAuthProvider

    let tokens: { access_token: string; refresh_token: string; expires_in: number }
    let identity: { email: string; name: string | null }
    try {
      tokens = await exchangeCode(provider, { code, codeVerifier: st.code_verifier, clientId: cfg[provider].clientId, clientSecret: cfg[provider].clientSecret, redirectUri: st.redirect_uri })
      identity = await fetchIdentity(provider, tokens.access_token)
    } catch (e) {
      return json({ error: 'exchange_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
    }

    const secret: OAuthSecret = {
      refresh_token: tokens.refresh_token, access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }
    // Une boîte déjà connectée (même agence, même adresse) est RÉAUTORISÉE, pas dupliquée.
    const { data: existing } = await admin.from('mail_accounts').select('id, vault_secret_id')
      // ⚠ `.eq` et non `.ilike` : dans un motif LIKE, `_` et `%` sont des JOKERS —
      // `john_doe@x.ch` apparierait `johnXdoe@x.ch`, et `.maybeSingle()` lèverait sur
      // deux résultats. `identity.email` est déjà en minuscules (fetchIdentity) et
      // l'index unique est sur lower(email) : l'égalité est correcte ET indexée.
      .eq('agency_id', profile.agency_id).eq('provider', provider).eq('email', identity.email).maybeSingle()
    let accountId: string
    if (existing) {
      if (existing.vault_secret_id) await deleteAccountSecret(admin, existing.vault_secret_id).catch(() => undefined)
      const vaultId = await storeAccountSecret(admin, `mail:${provider}:${identity.email}`, secret)
      const { error } = await admin.from('mail_accounts').update({
        vault_secret_id: vaultId, status: 'active', last_error: null, owner_id: user.id,
        visibility: st.visibility, display_name: identity.name, next_sync_at: new Date().toISOString(),
      }).eq('id', existing.id)
      if (error) return json({ error: 'account_update_failed' }, 500)
      accountId = existing.id
    } else {
      const vaultId = await storeAccountSecret(admin, `mail:${provider}:${identity.email}`, secret)
      const { data: ins, error } = await admin.from('mail_accounts').insert({
        agency_id: profile.agency_id, owner_id: user.id, provider, email: identity.email, display_name: identity.name,
        visibility: st.visibility, status: 'active', vault_secret_id: vaultId,
      }).select('id').single()
      if (error) { await deleteAccountSecret(admin, vaultId).catch(() => undefined); return json({ error: 'account_insert_failed', detail: error.message }, 500) }
      accountId = ins.id
    }

    // Libellés par défaut si l'agence n'en a aucun (langue de correspondance de l'agent).
    const { count } = await admin.from('mail_labels').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id)
    if ((count ?? 0) === 0) {
      const { data: p } = await admin.from('profiles').select('language').eq('id', user.id).maybeSingle()
      const lang = (['fr', 'de', 'en', 'it'] as const).find((l) => l === p?.language) ?? 'fr'
      await admin.from('mail_labels').insert(SEED_LABELS[lang].map((name, i) => ({ agency_id: profile.agency_id, name, color: SEED_COLORS[i], position: i, is_default: true })))
    }

    // Première synchro en arrière-plan : l'assistant affiche « Boîte connectée » sans attendre.
    const { data: account } = await admin.from('mail_accounts').select('*').eq('id', accountId).single()
    // ⚠ Gardé comme le fait flatfox-sync/index.ts:768-771, et pour une raison
    // précise : à ce point la ligne mail_accounts EST écrite et le secret EST dans
    // Vault. Un `EdgeRuntime` absent lèverait un ReferenceError APRÈS le succès —
    // l'assistant verrait un 500 pour une boîte pourtant connectée.
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(syncAccount(admin, account as MailAccountRow, cfg, 45_000))
    }
    const { data: pub } = await admin.from('mail_accounts').select(PUBLIC_COLS).eq('id', accountId).single()
    return json({ account: pub })
  }

  if (action === 'disconnect') {
    const account = await loadVisibleAccount(admin, String(body.account_id ?? ''), ctx)
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.owner_id !== user.id && !['admin', 'manager'].includes(profile.role ?? '')) return json({ error: 'forbidden' }, 403)
    if (account.vault_secret_id) {
      const secret = await readAccountSecret<OAuthSecret>(admin, account.vault_secret_id).catch(() => null)
      if (secret && 'refresh_token' in secret && (account.provider === 'gmail' || account.provider === 'outlook')) await revokeToken(account.provider, secret.refresh_token)
      await deleteAccountSecret(admin, account.vault_secret_id).catch(() => undefined)
    }
    const { error } = await admin.from('mail_accounts').delete().eq('id', account.id)
    if (error) return json({ error: 'delete_failed' }, 500)
    return json({ ok: true })
  }

  if (action === 'update') {
    const account = await loadVisibleAccount(admin, String(body.account_id ?? ''), ctx)
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.owner_id !== user.id) return json({ error: 'forbidden' }, 403)
    const patch: Record<string, unknown> = {}
    if (typeof body.display_name === 'string') patch.display_name = body.display_name.slice(0, 80)
    if (body.visibility === 'owner' || body.visibility === 'agency') patch.visibility = body.visibility
    const { data: pub, error } = await admin.from('mail_accounts').update(patch).eq('id', account.id).select(PUBLIC_COLS).single()
    if (error) return json({ error: 'update_failed' }, 500)
    return json({ account: pub })
  }

  return json({ error: 'unknown_action' }, 400)
})
