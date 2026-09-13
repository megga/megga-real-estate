/**
 * delete-account déconnecte les boîtes du compte — révocation chez Google, secret Vault
 * effacé — AVANT toute destruction, par le même chemin que « Déconnecter ».
 *
 * ⛔ Mesuré le 13.09.2026 : la seule chose qui touchait les boîtes était la cascade de
 * l'étape 11 (mail_accounts.owner_id → profiles ON DELETE CASCADE). Elle emporte fils et
 * messages, mais Vault n'est la cible d'aucune clé étrangère : le jeton de rafraîchissement
 * survivait au compte, non révoqué, et la seule ligne qui le désignait partait avec lui.
 * La preuve de bout en bout (secret réellement effacé) est backend :
 * tests/backend/delete-account-boites.spec.ts ; cette garde fige l'ORDRE, que le backend
 * ne voit pas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { repoPath } from './helpers/fs-scan'

const lire = (f: string) => readFileSync(repoPath(f), 'utf8').replace(/\r\n/g, '\n')
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')

const SUPPRESSION = sansCommentaires(lire('supabase/functions/delete-account/index.ts'))
const OAUTH = sansCommentaires(lire('supabase/functions/mail-oauth/index.ts'))

/** Position d'un motif, exigé présent — une garde qui ne trouve pas son repère ne mesure rien. */
function pos(source: string, motif: string | RegExp, quoi: string): number {
  const i = typeof motif === 'string' ? source.indexOf(motif) : source.search(motif)
  expect(i, `${quoi} introuvable — la garde ne mesure plus rien`).toBeGreaterThan(-1)
  return i
}

describe('delete-account — les boîtes connectées ne survivent pas au compte', () => {
  it('passe par disconnectMailAccount, le chemin de « Déconnecter »', () => {
    expect(SUPPRESSION).toMatch(/import\s*\{\s*disconnectMailAccount\s*\}\s*from\s*'\.\.\/_shared\/mail\/disconnect\.ts'/)
    expect(SUPPRESSION).toMatch(/from\('mail_accounts'\)\s*\.select\('id, provider, vault_secret_id'\)\s*\.eq\('owner_id', userId\)/)
  })

  it('après la trace, avant toute destruction et avant deleteUser', () => {
    const trace = pos(SUPPRESSION, "action: 'account_deleted'", 'la trace account_deleted')
    const boites = pos(SUPPRESSION, 'disconnectMailAccount(admin,', 'l’appel à disconnectMailAccount')
    const profil = pos(SUPPRESSION, /from\('profiles'\)\s*\.update\(/, 'l’anonymisation du profil')
    const auth = pos(SUPPRESSION, 'auth.admin.deleteUser(', 'deleteUser')
    expect(boites, 'la trace doit précéder toute destruction').toBeGreaterThan(trace)
    expect(boites, 'les boîtes avant l’étape 6 : un échec doit pouvoir tout arrêter').toBeLessThan(profil)
    // Après deleteUser, la cascade a emporté les lignes — donc les SEULS pointeurs vers Vault.
    expect(boites).toBeLessThan(auth)
  })

  it('un échec arrête la suppression, il ne se contente pas de journaliser', () => {
    const debut = pos(SUPPRESSION, 'disconnectMailAccount(admin,', 'l’appel à disconnectMailAccount')
    const branche = SUPPRESSION.slice(debut, SUPPRESSION.indexOf('from(\'profiles\')', debut))
    expect(branche).toMatch(/if\s*\(\s*!r\.ok\s*\)\s*\{\s*return json\(/)
    expect(branche).toContain("'MAILBOX_DISCONNECT_FAILED'")
  })
})

describe('mail-oauth — un seul chemin de déconnexion', () => {
  it('disconnect délègue à disconnectMailAccount, sans copie des trois gestes', () => {
    const debut = pos(OAUTH, "if (action === 'disconnect')", 'la branche disconnect')
    const fin = OAUTH.indexOf("if (action === 'update')", debut)
    const branche = OAUTH.slice(debut, fin)
    expect(branche).toContain('disconnectMailAccount(admin, account)')
    for (const copie of ['revokeToken(', 'readAccountSecret(', 'deleteAccountSecret(', ".from('mail_accounts').delete("]) {
      expect(branche, `copie de « ${copie} » dans mail-oauth : les deux chemins dériveraient`).not.toContain(copie)
    }
  })
})
