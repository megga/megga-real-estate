/**
 * Purges du stockage par compte (src/lib/stockageParCompte.ts) — pures, sur des
 * stockages en mémoire.
 *
 * Contrôle positif systématique : la liste des clés RETIRÉES est comparée à la
 * liste attendue, clé par clé. Une purge qui ne ferait rien passerait sinon
 * toutes les assertions « ceci survit ».
 */
import { describe, it, expect } from 'vitest'
import { purgerStockageDesComptes, cleDuCompte, type Stockages } from '@/lib/stockageParCompte'

class Memoire implements Storage {
  m = new Map<string, string>()
  get length() { return this.m.size }
  clear() { this.m.clear() }
  getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  removeItem(k: string) { this.m.delete(k) }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
}

/** Les deux classes de clés — appareil et compte — plus un leurre de préfixe. */
function seme(): Stockages & { local: Memoire; session: Memoire } {
  const local = new Memoire()
  const session = new Memoire()
  for (const k of ['megga-theme', 'megga.crm.dark', 'megga_remember', 'megga-language', 'megga-cookie-consent', 'sb-api-auth-token']) local.setItem(k, 'appareil')
  local.setItem('megga-impersonate', 'ancien')
  local.setItem('megga-impersonate:A', 'imp-A')
  local.setItem('megga-impersonate:B', 'imp-B')
  local.setItem('megga_external_listing_actions:A', 'notes-A')
  local.setItem('megga-avatar-url', 'photo-ancienne')
  local.setItem('megga-avatar-url:A', 'photo-A')
  local.setItem('megga-avatar-url:B', 'photo-B')
  local.setItem('megga-agent-notif-lastseen', '1700000000000')
  local.setItem('megga-agent-notif-lastseen:A', '1800000000000')
  local.setItem('megga_oauth_role', 'agent')
  session.setItem('megga.crm.tabs', 'pile-ancienne')
  session.setItem('megga.crm.tabs:A:AG1', 'pile-A')
  session.setItem('megga.crm.tabs:B:AG2', 'pile-B')
  session.setItem('megga.crm.tabsX', 'leurre')
  session.setItem('megga.import-lead.state.v1', 'brouillon')
  session.setItem('megga.stockage.compte', 'A')
  return { local, session }
}

const APPAREIL = ['megga-theme', 'megga.crm.dark', 'megga_remember', 'megga-language', 'megga-cookie-consent', 'sb-api-auth-token']

describe('purgerStockageDesComptes', () => {
  it('déconnexion : tout le sensible et la clé de passage partent ; l’appareil, le non-sensible et le leurre restent', () => {
    const s = seme()
    const retirees = purgerStockageDesComptes(s, { mode: 'deconnexion' }).sort()
    expect(retirees).toEqual([
      'megga-avatar-url', 'megga-avatar-url:A', 'megga-avatar-url:B',
      'megga-impersonate', 'megga-impersonate:A', 'megga-impersonate:B',
      'megga.crm.tabs', 'megga.crm.tabs:A:AG1', 'megga.crm.tabs:B:AG2',
      'megga.import-lead.state.v1',
      'megga_external_listing_actions:A', 'megga_oauth_role',
    ].sort())
    for (const k of APPAREIL) expect(s.local.getItem(k), k).toBe('appareil')
    expect(s.local.getItem('megga-agent-notif-lastseen:A')).toBe('1800000000000')
    expect(s.session.getItem('megga.crm.tabsX')).toBe('leurre') // le `:` est exigé
  })

  it('changement vers B : garde les clés de B et la clé de passage, retire celles de A', () => {
    const s = seme()
    const retirees = purgerStockageDesComptes(s, { mode: 'changement', garder: 'B' })
    expect(retirees).toContain('megga.crm.tabs:A:AG1')
    expect(retirees).toContain('megga-impersonate:A')
    expect(retirees).toContain('megga.import-lead.state.v1')
    expect(s.session.getItem('megga.crm.tabs:B:AG2')).toBe('pile-B')
    expect(s.local.getItem('megga-impersonate:B')).toBe('imp-B')
    expect(s.local.getItem('megga-avatar-url:B')).toBe('photo-B')
    expect(s.local.getItem('megga_oauth_role')).toBe('agent') // AuthCallbackPage la relit
  })

  it('démarrage de A, onglet déjà à A : le brouillon de A survit au rechargement ; B et l’ancien partent', () => {
    const s = seme()
    const retirees = purgerStockageDesComptes(s, { mode: 'demarrage', garder: 'A', compteOnglet: 'A' })
    expect(s.session.getItem('megga.import-lead.state.v1')).toBe('brouillon')
    expect(s.session.getItem('megga.crm.tabs:A:AG1')).toBe('pile-A')
    expect(retirees).toContain('megga.crm.tabs:B:AG2')
    expect(retirees).toContain('megga-avatar-url:B')
    expect(retirees).toContain('megga.crm.tabs') // ancienne clé : propriétaire inconnu
    expect(retirees).not.toContain('megga_oauth_role')
  })

  it('démarrage de B dans un onglet qui servait A : le brouillon de A part', () => {
    const s = seme()
    const retirees = purgerStockageDesComptes(s, { mode: 'demarrage', garder: 'B', compteOnglet: 'A' })
    expect(retirees).toContain('megga.import-lead.state.v1')
    expect(retirees).toContain('megga.crm.tabs:A:AG1')
  })

  it('démarrage : l’ancienne clé NON sensible est MIGRÉE vers le compte, pas perdue', () => {
    const s = seme()
    s.local.removeItem('megga-agent-notif-lastseen:A')
    const retirees = purgerStockageDesComptes(s, { mode: 'demarrage', garder: 'A', compteOnglet: null })
    expect(s.local.getItem(cleDuCompte('megga-agent-notif-lastseen', 'A'))).toBe('1700000000000')
    expect(s.local.getItem('megga-agent-notif-lastseen')).toBeNull()
    expect(retirees).not.toContain('megga-agent-notif-lastseen') // migrée, pas « retirée »
  })

  it('démarrage : une valeur déjà indexée n’est pas écrasée par l’ancienne', () => {
    const s = seme()
    purgerStockageDesComptes(s, { mode: 'demarrage', garder: 'A', compteOnglet: null })
    expect(s.local.getItem('megga-agent-notif-lastseen:A')).toBe('1800000000000')
  })

  it('un stockage qui jette (Safari privé) ne fait pas jeter la purge', () => {
    const hostile = {
      get length(): number { throw new DOMException('refusé', 'SecurityError') },
      key() { throw new DOMException('refusé', 'SecurityError') },
      getItem() { throw new DOMException('refusé', 'SecurityError') },
      setItem() { throw new DOMException('refusé', 'SecurityError') },
      removeItem() { throw new DOMException('refusé', 'SecurityError') },
      clear() { throw new DOMException('refusé', 'SecurityError') },
    } as Storage
    expect(purgerStockageDesComptes({ local: hostile, session: null }, { mode: 'deconnexion' })).toEqual([])
  })
})
