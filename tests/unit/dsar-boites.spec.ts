/**
 * L'export DSAR rend les boîtes connectées de la personne — la connexion, jamais les clés.
 *
 * ⛔ Mesuré le 13.09.2026 : `delete-account` effaçait les boîtes (étape 5c, #1314) mais
 * `admin-dsar-export` ne les rendait pas — l'écart était écrit dans personal-data-estate.ts,
 * « non tranché ». Il l'est : la connexion s'exporte, par une liste de colonnes FERMÉE.
 *
 * Trois gardes : (1) jamais une colonne de clé ou d'état technique (pointeur Vault, curseurs,
 * configuration IMAP, texte d'erreur) ; (2) chaque colonne demandée EXISTE — une faute de
 * frappe ferait répondre 500 à tout l'export, pas seulement à cette section ; (3) la section
 * atteint la payload et la trace. La preuve de bout en bout est backend :
 * tests/backend/dsar-boites.spec.ts.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PERSONAL_DATA_ESTATE } from '../../supabase/functions/_shared/personal-data-estate'
import { repoPath } from './helpers/fs-scan'

const lire = (f: string) => readFileSync(repoPath(f), 'utf8').replace(/\r\n/g, '\n')
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
const DSAR = sansCommentaires(lire('supabase/functions/admin-dsar-export/index.ts'))

/** Les colonnes que l'export demande, lues dans la constante — pas recopiées ici. */
function colonnesExportees(): string[] {
  const m = DSAR.match(/const COLONNES_BOITE = '([^']+)'/)
  expect(m, 'COLONNES_BOITE introuvable dans admin-dsar-export').not.toBeNull()
  return m![1]!.split(',').map((c) => c.trim())
}

/** Les colonnes réelles de `mail_accounts` : la création, plus chaque `add column` postérieur. */
function colonnesDeLaTable(): Set<string> {
  const creation = lire('supabase/migrations/20260904074500_mail_module.sql')
  const bloc = creation.slice(creation.indexOf('create table if not exists public.mail_accounts ('))
  const corps = bloc.slice(0, bloc.indexOf('\n);'))
  const cols = new Set([...corps.matchAll(/^\s{2}([a-z_]+)\s/gm)].map((m) => m[1]!))
  for (const m of lire('supabase/migrations/20260904074600_mail_sync_failures.sql').matchAll(/add column if not exists ([a-z_]+)/g)) cols.add(m[1]!)
  expect(cols.has('email') && cols.has('vault_secret_id'), 'lecture de la table ratée — la garde ne mesure rien').toBe(true)
  return cols
}

describe('export DSAR — les boîtes connectées', () => {
  it('interroge les boîtes du SUJET, par la liste fermée', () => {
    expect(DSAR).toMatch(/from\('mail_accounts'\)\s*\.select\(COLONNES_BOITE\)\s*\.eq\('owner_id', targetId\)/)
    expect(DSAR, 'jamais select(*) sur les boîtes : pointeur Vault et curseurs partiraient avec').not.toMatch(/from\('mail_accounts'\)\s*\.select\('\*'\)/)
  })

  it('ne demande aucune clé ni aucun état technique', () => {
    const cols = colonnesExportees()
    for (const interdite of ['vault_secret_id', 'sync_cursor', 'imap_config', 'last_error', 'next_sync_at', 'sync_failures', 'owner_id']) {
      expect(cols, `${interdite} n’a rien à faire dans un export d’accès`).not.toContain(interdite)
    }
    expect(cols).toEqual(expect.arrayContaining(['provider', 'email', 'visibility', 'status', 'created_at']))
  })

  it('chaque colonne demandée existe dans la table — sinon tout l’export répond 500', () => {
    const table = colonnesDeLaTable()
    for (const c of colonnesExportees()) expect(table, `mail_accounts.${c} n’existe pas`).toContain(c)
  })

  it('la section atteint la payload, la trace et la note de périmètre', () => {
    expect(DSAR).toMatch(/mail_accounts:\s*mailAccounts\.data \?\? \[\]/)
    expect(DSAR).toMatch(/mail_accounts:\s*mailAccounts\.data\?\.length \?\? 0/)
    expect(DSAR).toMatch(/mail_accounts:\s*\n?\s*'Pour chaque boîte connectée/)
    // Une erreur de lecture est levée comme les autres, jamais rendue comme « aucune boîte ».
    expect(DSAR).toMatch(/for \(const res of \[[^\]]*mailAccounts\]\)/)
  })

  it('la déclaration dit « exportée », et l’écart n’est plus « non tranché »', () => {
    const e = PERSONAL_DATA_ESTATE.find((x) => x.table === 'mail_accounts')
    expect(e).toMatchObject({ access: true, erasure: 'delete', subjectColumn: 'owner_id' })
    expect(e!.divergence).not.toMatch(/NON TRANCHÉ/)
  })
})
