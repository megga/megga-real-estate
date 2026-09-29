/**
 * Le vocabulaire des rôles, confronté entre ses QUATRE déclarations : la contrainte SQL, la
 * fonction d'ordre, le module TypeScript, et les quatre langues. Un rôle ajouté d'un seul côté
 * doit rougir ici — sinon il se traduit « roles.trustee » à l'écran, ou la base refuse ce que
 * l'écran propose.
 *
 * ⚠ La garde Deno d'`automation-engine` recopie EN DUR les rôles de TRANSACTION (elle ne peut
 * pas importer `src/lib/`) : elle est confrontée ici aussi, c'est la seule chose qui la tienne
 * en phase — et elle porte CINQ rôles, pas les douze, ce que ce fichier vérifie littéralement.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROLES_CONTACT, ROLES_TRANSACTION } from '@/lib/contactRoles'

const lire = (p: string): string => readFileSync(resolve(__dirname, '../..', p), 'utf8')
const LANGUES = ['fr', 'de', 'en', 'it'] as const
const MIGRATION = 'supabase/migrations/20260930180000_contacts_roles.sql'

describe('les douze rôles sont déclarés pareil partout', () => {
  it('la contrainte SQL porte exactement les rôles du module', () => {
    const sql = lire(MIGRATION)
    // ⚠ Ancré sur `add constraint`, et non sur le seul nom : `contacts_roles_valides` est cité
    // DEUX fois (le garde `pg_constraint` puis l'ALTER), et découper sur le nom nu rendait le
    // fragment VIDE entre les deux — un test qui mesure du vide.
    const bloc = sql.split('add constraint contacts_roles_valides')[1]?.split(';')[0] ?? ''
    for (const r of ROLES_CONTACT) expect(bloc, r).toContain(`'${r}'`)
    // Et rien de plus : chaque chaîne citée du CHECK est un rôle connu.
    const cites = [...bloc.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
    expect(new Set(cites)).toEqual(new Set(ROLES_CONTACT))
  })

  it('la fonction d’ordre porte les mêmes, dans l’ordre du module', () => {
    const sql = lire(MIGRATION)
    const bloc = sql.split('contacts_roles_ordonnes')[1]!.split('$$')[1] ?? ''
    const ordre = [...bloc.matchAll(/\('([a-z_]+)',\s*\d+\)/g)].map((m) => m[1]!)
    expect(ordre).toEqual([...ROLES_CONTACT])
  })

  it('la garde Deno d’automation-engine porte les rôles de TRANSACTION', () => {
    // ⚠ Elle recopie `ROLES_TRANSACTION`, pas les douze : R3 ne relance que qui TRANSACTE, et
    // un contact qui n'a que des rôles de réseau (avocat, private banker…) ne doit pas sortir
    // en « lead dormant ». La recopie est voulue — Deno ne peut pas importer `src/lib/`.
    // Ce cas est la SEULE chose qui la tienne en phase : un sixième rôle de transaction
    // ajouté au module passerait ici sans que l'edge function le connaisse.
    const deno = lire('supabase/functions/automation-engine/index.ts')
    const bloc = deno.split('roles.some((r) => [')[1]?.split(']')[0] ?? ''
    const cites = [...bloc.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
    expect(cites).toEqual([...ROLES_TRANSACTION])
  })

  it('les quatre langues nomment les douze rôles', () => {
    for (const langue of LANGUES) {
      const json = JSON.parse(lire(`src/i18n/locales/${langue}/contacts.json`)) as Record<string, unknown>
      const roles = (json.roles ?? {}) as Record<string, string>
      expect(Object.keys(roles).sort(), langue).toEqual([...ROLES_CONTACT].sort())
      for (const [cle, valeur] of Object.entries(roles)) {
        expect(valeur.trim(), `${langue}.${cle}`).not.toBe('')
      }
    }
  })

  it('le sélecteur de rôle est nommé dans les quatre langues', () => {
    for (const langue of LANGUES) {
      const json = JSON.parse(lire(`src/i18n/locales/${langue}/contacts.json`)) as Record<string, unknown>
      const segments = (json.segments ?? {}) as Record<string, string>
      for (const cle of ['role', 'roleAll', 'roleOverlap']) {
        expect(segments[cle]?.trim(), `${langue}.segments.${cle}`).toBeTruthy()
      }
    }
  })

  it('les clés mortes de l’ancien type sont parties', () => {
    for (const langue of LANGUES) {
      const json = JSON.parse(lire(`src/i18n/locales/${langue}/contacts.json`)) as Record<string, unknown>
      expect(json.type, langue).toBeUndefined()
      expect((json.detail as Record<string, unknown> | undefined)?.type, langue).toBeUndefined()
    }
  })
})
