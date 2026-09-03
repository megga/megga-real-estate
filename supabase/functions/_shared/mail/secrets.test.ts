// supabase/functions/_shared/mail/secrets.test.ts
import { describe, it, expect, vi } from 'vitest'
import { needsRefresh, refreshOAuthToken, getValidAccessToken, MailAuthError } from './secrets.ts'
import type { MailAccountRow, OAuthSecret } from './types.ts'

const cfg = { clientId: 'cid', clientSecret: 'sec' }
const NOW = Date.parse('2026-09-03T10:00:00Z')

function account(over: Partial<MailAccountRow> = {}): MailAccountRow {
  return {
    id: 'acc-1', agency_id: 'ag', owner_id: 'u', provider: 'gmail', email: 'g@ex.ch',
    display_name: null, visibility: 'owner', status: 'active', vault_secret_id: 'vault-1',
    sync_cursor: {}, next_sync_at: '', last_sync_at: null, last_error: null, imap_config: null, ...over,
  }
}
/** Faux admin : rpc() rend le secret, update() mémorise les écritures sur mail_accounts. */
function fakeAdmin(secret: OAuthSecret | null) {
  const writes: Record<string, unknown>[] = []
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'mail_secret_read') return { data: secret ? JSON.stringify(secret) : null, error: null }
    if (name === 'mail_secret_update') { writes.push({ rpc: name, ...args }); return { data: null, error: null } }
    return { data: null, error: { message: `unexpected rpc ${name}` } }
  })
  const from = vi.fn(() => ({ update: (patch: Record<string, unknown>) => ({ eq: async () => { writes.push(patch); return { error: null } } }) }))
  return { admin: { rpc, from } as never, writes, rpc }
}

describe('needsRefresh', () => {
  it('rafraîchit à moins de 5 minutes de l échéance', () => {
    expect(needsRefresh(new Date(NOW + 10 * 60_000).toISOString(), NOW)).toBe(false)
    expect(needsRefresh(new Date(NOW + 4 * 60_000).toISOString(), NOW)).toBe(true)
    expect(needsRefresh('invalid', NOW)).toBe(true)
  })
})

describe('refreshOAuthToken', () => {
  it('poste le bon corps à Google et rend le jeton', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(String(init.body)).toContain('grant_type=refresh_token')
      expect(String(init.body)).toContain('client_id=cid')
      return new Response(JSON.stringify({ access_token: 'at2', expires_in: 3600 }), { status: 200 })
    })
    const r = await refreshOAuthToken('gmail', 'rt', cfg, { fetch: fetch as unknown as typeof globalThis.fetch })
    expect(fetch.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token')
    expect(r).toEqual({ access_token: 'at2', expires_in: 3600, refresh_token: undefined })
  })
  it('Microsoft envoie le scope et peut faire tourner le refresh token', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(String(init.body)).toContain('scope=offline_access')
      return new Response(JSON.stringify({ access_token: 'at3', expires_in: 3599, refresh_token: 'rt-new' }), { status: 200 })
    })
    const r = await refreshOAuthToken('outlook', 'rt', cfg, { fetch: fetch as unknown as typeof globalThis.fetch })
    expect(fetch.mock.calls[0][0]).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
    expect(r.refresh_token).toBe('rt-new')
  })
  it('invalid_grant lève MailAuthError reauth_required', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
    await expect(refreshOAuthToken('gmail', 'rt', cfg, { fetch: fetch as unknown as typeof globalThis.fetch }))
      .rejects.toMatchObject({ code: 'reauth_required' })
  })
})

describe('getValidAccessToken', () => {
  it('rend le jeton en cache s il est frais, sans réseau', async () => {
    const { admin, rpc } = fakeAdmin({ refresh_token: 'rt', access_token: 'at', expires_at: new Date(NOW + 30 * 60_000).toISOString() })
    const fetch = vi.fn()
    const t = await getValidAccessToken(admin, account(), cfg, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW })
    expect(t).toBe('at')
    expect(fetch).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('mail_secret_read', { p_id: 'vault-1' })
  })
  it('rafraîchit, réécrit Vault (rotation MS comprise)', async () => {
    const { admin, writes } = fakeAdmin({ refresh_token: 'rt', access_token: 'old', expires_at: new Date(NOW - 1000).toISOString() })
    const fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: 'fresh', expires_in: 3600, refresh_token: 'rt2' }), { status: 200 }))
    const t = await getValidAccessToken(admin, account({ provider: 'outlook' }), cfg, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW })
    expect(t).toBe('fresh')
    const upd = writes.find((w) => w.rpc === 'mail_secret_update') as { p_secret: string }
    const stored = JSON.parse(upd.p_secret) as OAuthSecret
    expect(stored.refresh_token).toBe('rt2')
    expect(stored.access_token).toBe('fresh')
    expect(Date.parse(stored.expires_at)).toBe(NOW + 3600_000)
  })
  it('un refus définitif passe le compte en reauth_required et lève', async () => {
    const { admin, writes } = fakeAdmin({ refresh_token: 'rt', access_token: 'old', expires_at: new Date(NOW - 1000).toISOString() })
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
    await expect(getValidAccessToken(admin, account(), cfg, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW }))
      .rejects.toBeInstanceOf(MailAuthError)
    expect(writes).toContainEqual(expect.objectContaining({ status: 'reauth_required' }))
  })
  it('sans secret Vault : no_secret, jamais un appel réseau', async () => {
    const { admin } = fakeAdmin(null)
    const fetch = vi.fn()
    await expect(getValidAccessToken(admin, account(), cfg, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW }))
      .rejects.toMatchObject({ code: 'no_secret' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
