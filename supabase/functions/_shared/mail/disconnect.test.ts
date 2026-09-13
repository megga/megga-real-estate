// supabase/functions/_shared/mail/disconnect.test.ts
// Déconnecter une boîte — le chemin partagé par `mail-oauth disconnect` et `delete-account`.
// Faux client : on enregistre les GESTES (lecture Vault, révocation, effacement, suppression)
// dans leur ordre, parce que l'ordre EST le contrat : la ligne est le seul pointeur vers le
// secret, elle ne part qu'une fois le secret révoqué et effacé.
import { describe, it, expect, vi } from 'vitest'
import { disconnectMailAccount } from './disconnect.ts'

type Reponse = { data: unknown; error: { message: string } | null }

function faux(opts: { lecture?: Reponse; effacement?: Reponse; suppression?: Reponse; google?: () => Response } = {}) {
  const gestes: string[] = []
  const mises: Record<string, unknown>[] = []
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    gestes.push(`${fn}:${String(args.p_id)}`)
    if (fn === 'mail_secret_read') return opts.lecture ?? { data: JSON.stringify({ refresh_token: 'rt-1', access_token: 'at', expires_at: '2026-09-13T10:00:00Z' }), error: null }
    if (fn === 'mail_secret_delete') return opts.effacement ?? { data: null, error: null }
    throw new Error(`rpc inattendue ${fn}`)
  }
  const from = (table: string) => {
    let op = ''
    let charge: Record<string, unknown> | undefined
    const b = {
      update: (row: Record<string, unknown>) => { op = 'update'; charge = row; return b },
      delete: () => { op = 'delete'; return b },
      eq: (col: string, val: unknown) => {
        gestes.push(`${table}:${op}:${col}=${String(val)}`)
        if (op === 'update') mises.push(charge!)
        return Promise.resolve(op === 'delete' ? (opts.suppression ?? { data: null, error: null }) : { data: null, error: null })
      },
    }
    return b
  }
  const fetch = vi.fn(async (url: string) => {
    gestes.push(`fetch:${url}`)
    return opts.google ? opts.google() : new Response(null, { status: 200 })
  })
  return { admin: { rpc, from } as never, gestes, mises, deps: { fetch: fetch as unknown as typeof globalThis.fetch }, fetch }
}

const gmail = { id: 'acc-1', provider: 'gmail' as const, vault_secret_id: 'v-1' }

describe('disconnectMailAccount — révoquer, effacer, supprimer, dans cet ordre', () => {
  it('Gmail : lecture, révocation du jeton de rafraîchissement, effacement du secret, puis la ligne', async () => {
    const f = faux()
    expect(await disconnectMailAccount(f.admin, gmail, f.deps)).toEqual({ ok: true })
    expect(f.gestes).toEqual([
      'mail_secret_read:v-1',
      'fetch:https://oauth2.googleapis.com/revoke?token=rt-1',
      'mail_secret_delete:v-1',
      'mail_accounts:delete:id=acc-1',
    ])
  })

  it('jeton déjà révoqué chez Google (400 invalid_token) : ce n est pas un échec, la boîte part', async () => {
    const f = faux({ google: () => new Response('{"error":"invalid_token"}', { status: 400 }) })
    expect(await disconnectMailAccount(f.admin, gmail, f.deps)).toEqual({ ok: true })
    expect(f.gestes.slice(-2)).toEqual(['mail_secret_delete:v-1', 'mail_accounts:delete:id=acc-1'])
  })

  it('Google refuse (503) : la boîte RESTE, désactivée, et le secret n est pas effacé', async () => {
    const f = faux({ google: () => new Response('{"error":"backend_error"}', { status: 503 }) })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await disconnectMailAccount(f.admin, gmail, f.deps)
    err.mockRestore()
    expect(r).toMatchObject({ ok: false, reason: 'provider_refused' })
    expect(f.gestes).not.toContain('mail_secret_delete:v-1')
    expect(f.gestes).not.toContain('mail_accounts:delete:id=acc-1')
    expect(f.mises).toEqual([{ status: 'disabled', last_error: 'disconnect: révocation refusée par le fournisseur' }])
  })

  it('Vault ne répond pas à la lecture : on ne sait pas si le jeton existe — refus, rien d autre', async () => {
    const f = faux({ lecture: { data: null, error: { message: 'timeout' } } })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await disconnectMailAccount(f.admin, gmail, f.deps)
    err.mockRestore()
    expect(r).toMatchObject({ ok: false, reason: 'secret_unreadable' })
    expect(f.fetch).not.toHaveBeenCalled()
    expect(f.gestes).toEqual(['mail_secret_read:v-1', 'mail_accounts:update:id=acc-1'])
    expect(f.mises[0]).toEqual({ status: 'disabled', last_error: 'disconnect: secret illisible, révocation impossible' })
  })

  it('secret déjà absent (null) : rien à révoquer ni à effacer, la boîte part quand même', async () => {
    const f = faux({ lecture: { data: null, error: null } })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await disconnectMailAccount(f.admin, gmail, f.deps)).toEqual({ ok: true })
    err.mockRestore()
    expect(f.fetch).not.toHaveBeenCalled()
    expect(f.gestes).toEqual(['mail_secret_read:v-1', 'mail_accounts:delete:id=acc-1'])
  })

  it('effacement Vault refusé : le jeton est révoqué, mais la ligne RESTE — seul pointeur vers lui', async () => {
    const f = faux({ effacement: { data: null, error: { message: 'permission denied' } } })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await disconnectMailAccount(f.admin, gmail, f.deps)
    err.mockRestore()
    expect(r).toMatchObject({ ok: false, reason: 'vault_delete_failed' })
    expect(f.gestes).not.toContain('mail_accounts:delete:id=acc-1')
    expect(String(f.mises[0]?.last_error)).toMatch(/^disconnect: secret non effacé \(vault delete failed: permission denied\)$/)
  })

  it('Outlook : Microsoft n a rien à révoquer — aucun appel réseau, le secret est effacé', async () => {
    const f = faux()
    expect(await disconnectMailAccount(f.admin, { ...gmail, provider: 'outlook' }, f.deps)).toEqual({ ok: true })
    expect(f.fetch).not.toHaveBeenCalled()
    expect(f.gestes).toEqual(['mail_secret_read:v-1', 'mail_secret_delete:v-1', 'mail_accounts:delete:id=acc-1'])
  })

  it('secret IMAP (un mot de passe, pas de jeton) : effacé sans révocation', async () => {
    const f = faux({ lecture: { data: JSON.stringify({ host: 'imap.ex.ch', username: 'g', password: 'p' }), error: null } })
    expect(await disconnectMailAccount(f.admin, { ...gmail, provider: 'imap' }, f.deps)).toEqual({ ok: true })
    expect(f.fetch).not.toHaveBeenCalled()
    expect(f.gestes).toContain('mail_secret_delete:v-1')
  })

  it('aucun secret déclaré : la ligne part, sans passer par Vault', async () => {
    const f = faux()
    expect(await disconnectMailAccount(f.admin, { ...gmail, vault_secret_id: null }, f.deps)).toEqual({ ok: true })
    expect(f.gestes).toEqual(['mail_accounts:delete:id=acc-1'])
  })

  it('suppression de la ligne refusée : rendue, jamais un ok', async () => {
    const f = faux({ suppression: { data: null, error: { message: 'deadlock' } } })
    expect(await disconnectMailAccount(f.admin, gmail, f.deps)).toEqual({ ok: false, reason: 'delete_failed', detail: 'deadlock' })
  })
})
