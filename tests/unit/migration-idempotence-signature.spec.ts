/**
 * Porte d'idempotence des migrations — la règle « DROP … IF EXISTS avant » lit la
 * SIGNATURE d'une fonction, pas son seul nom (audit S11).
 *
 * ⛔ LE TROU : `drop function if exists f(jsonb, integer, bigint)` suivi de
 * `create function f(…, uuid)` passait la porte — le nom concordait. Au second
 * rejeu du jour (deploy.yml réapplique toute migration datée d'aujourd'hui), le
 * DROP ne trouve plus l'ancienne signature et le CREATE lève 42723 : l'étape de
 * migration meurt, et avec elle le déploiement des edge functions de la journée.
 *
 * On lance le VRAI script sur des fichiers temporaires : chaque refus a son
 * contrôle positif (la forme légitime voisine passe).
 */
import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { repoPath } from './helpers/fs-scan'

const dossier = mkdtempSync(join(tmpdir(), 'idempotence-'))
let n = 0

/** Lance la porte sur une migration fictive ; rend son code de sortie et sa sortie. */
function porte(sql: string): { code: number; sortie: string } {
  const fichier = join(dossier, `2099010100${String(++n).padStart(4, '0')}_essai.sql`)
  writeFileSync(fichier, sql)
  try {
    const sortie = execFileSync('node', [repoPath('scripts/check-migration-idempotence.mjs'), fichier], { encoding: 'utf8', stdio: 'pipe' })
    return { code: 0, sortie }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? -1, sortie: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

const CORPS = `returns integer language sql as $$ select 1 $$;`

afterAll(() => rmSync(dossier, { recursive: true, force: true }))

describe('check-migration-idempotence — signature des fonctions', () => {
  it('REFUSE un create nu dont la signature diffère de celle supprimée', () => {
    const r = porte(`drop function if exists public.f(jsonb, integer, bigint);
create function public.f(p_tabs jsonb, p_active integer, p_revision bigint default null, p_owner uuid default null) ${CORPS}`)
    expect(r.code).toBe(1)
    expect(r.sortie).toContain('public.f(jsonb,integer,bigint,uuid)')
  })

  it('CONTRÔLE POSITIF — la même migration en `create or replace` passe', () => {
    const r = porte(`drop function if exists public.f(jsonb, integer, bigint);
create or replace function public.f(p_tabs jsonb, p_active integer, p_revision bigint default null, p_owner uuid default null) ${CORPS}`)
    expect(r.code).toBe(0)
  })

  it('accepte un DROP de MÊME signature, noms, défauts et alias de type compris', () => {
    const r = porte(`drop function if exists public.f(jsonb, int, int8);
create function public.f(p_tabs jsonb, p_active integer default 0, p_revision bigint = null) ${CORPS}`)
    expect(r.code).toBe(0)
  })

  it('accepte un DROP sans liste d’arguments (Postgres vise l’unique fonction du nom)', () => {
    expect(porte(`drop function if exists public.g;\ncreate function public.g(a text) ${CORPS}`).code).toBe(0)
  })

  it('ignore les paramètres OUT, comme DROP FUNCTION', () => {
    expect(porte(`drop function if exists public.h(text);\ncreate function public.h(p text, out r integer) as $$ select 1 $$ language sql;`).code).toBe(0)
  })

  it('reconnaît un type de plusieurs mots sans le prendre pour un nom', () => {
    const ok = porte(`drop function if exists public.k(timestamp with time zone);\ncreate function public.k(timestamptz) ${CORPS}`)
    expect(ok.code).toBe(0)
    const ko = porte(`drop function if exists public.k2(timestamp with time zone);\ncreate function public.k2(p_at date) ${CORPS}`)
    expect(ko.code).toBe(1)
  })

  it('le vrai arbre reste vert — la règle affinée n’accuse aucune migration existante', () => {
    const sortie = execFileSync('node', [repoPath('scripts/check-migration-idempotence.mjs')], { encoding: 'utf8', cwd: repoPath() })
    expect(sortie).toMatch(/Migrations rejouables \(\d+ vérifiées/)
  })
})
