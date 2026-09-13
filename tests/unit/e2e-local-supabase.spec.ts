/**
 * Les suites Playwright sous bypass ne frappent JAMAIS le projet cloud.
 *
 * ⛔ Mesuré le 13.09.2026 : sans `VITE_SUPABASE_URL`, `npm run dev` retombe sur le projet de
 * production, et les trois suites bypass de la CI y envoyaient ~10 000 requêtes par jour
 * (détail en tête de playwright.local-supabase.ts). Ce fichier tient deux choses :
 *   1. le garde lui-même refuse tout hôte non local ;
 *   2. les trois configs bypass PASSENT par lui — pas une copie, pas un oubli.
 * La suite KYB (playwright.kyb.config.ts) a son propre garde, plus strict (clés exigées).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'
import {
  isLocalSupabaseUrl,
  localSupabaseStubServer,
  localSupabaseWebServerEnv,
  LOCAL_SUPABASE_DEMO_ANON_KEY,
  LOCAL_SUPABASE_URL_DEFAULT,
} from '../../playwright.local-supabase'
// @ts-expect-error — module Node sans déclaration de types, volontairement (tests/e2e/helpers)
import { decide, mockIdInFilters } from '../e2e/helpers/supabase-stub.mjs'

const CONFIGS_BYPASS = ['playwright.config.ts', 'playwright.admin.config.ts', 'playwright.visual.config.ts']

describe('isLocalSupabaseUrl', () => {
  it.each([
    'http://127.0.0.1:54321', 'http://localhost:54321', 'http://localhost', 'http://127.0.0.1:54321/',
  ])('accepte %s', (u) => expect(isLocalSupabaseUrl(u)).toBe(true))

  it.each([
    'https://eayczugyrvmtqnnmvjod.supabase.co', 'https://api.getmegga.com', 'https://127.0.0.1:54321',
    'http://127.0.0.1.evil.ch', 'http://localhost.evil.ch:54321', '',
  ])('refuse %s', (u) => expect(isLocalSupabaseUrl(u)).toBe(false))
})

describe('localSupabaseWebServerEnv', () => {
  const sauvegarde = { url: process.env.SUPABASE_TEST_URL, key: process.env.SUPABASE_TEST_ANON_KEY }
  beforeEach(() => { delete process.env.SUPABASE_TEST_URL; delete process.env.SUPABASE_TEST_ANON_KEY })
  afterEach(() => {
    if (sauvegarde.url === undefined) delete process.env.SUPABASE_TEST_URL; else process.env.SUPABASE_TEST_URL = sauvegarde.url
    if (sauvegarde.key === undefined) delete process.env.SUPABASE_TEST_ANON_KEY; else process.env.SUPABASE_TEST_ANON_KEY = sauvegarde.key
  })

  it('retombe sur l’instance locale et la clé de démonstration', () => {
    // `.env.test.local` peut poser SUPABASE_TEST_URL sur une machine de dev : on ne teste
    // alors que la localité, jamais une valeur précise.
    const env = localSupabaseWebServerEnv()
    expect(isLocalSupabaseUrl(env.VITE_SUPABASE_URL)).toBe(true)
    if (env.VITE_SUPABASE_URL === LOCAL_SUPABASE_URL_DEFAULT && !process.env.SUPABASE_TEST_ANON_KEY) {
      expect(env.VITE_SUPABASE_ANON_KEY).toBe(LOCAL_SUPABASE_DEMO_ANON_KEY)
    }
  })

  it('lève si la cible n’est pas locale — le projet cloud n’est pas une option', () => {
    process.env.SUPABASE_TEST_URL = 'https://eayczugyrvmtqnnmvjod.supabase.co'
    expect(() => localSupabaseWebServerEnv()).toThrow(/instance locale/)
  })
})

describe('les trois configs bypass passent par le garde', () => {
  for (const cfg of CONFIGS_BYPASS) {
    it(`${cfg} étale localSupabaseWebServerEnv() dans webServer.env`, () => {
      const lu = readFileSafely(repoPath(cfg))
      const src = lu.status === 'ok' ? lu.value : ''
      expect(src.length, `${cfg} illisible`).toBeGreaterThan(200)
      expect(src).toMatch(/import \{[^}]*\blocalSupabaseWebServerEnv\b[^}]*\} from '\.\/playwright\.local-supabase'/)
      // Des lignes de commentaire peuvent précéder l'étalement, mais aucune autre clé :
      // la cible locale s'écrit AVANT les drapeaux de bypass, pour qu'on la voie.
      expect(src).toMatch(/env:\s*\{(?:\s*\/\/[^\n]*)*\s*\.\.\.localSupabaseWebServerEnv\(\)/)
      // La paille démarre AVANT le serveur de dev : premier élément du tableau webServer.
      expect(src).toMatch(/webServer:\s*\[localSupabaseStubServer\(\),/)
      // Et aucune référence au projet cloud, même en commentaire d'exemple.
      expect(src).not.toContain('eayczugyrvmtqnnmvjod')
    })
  }

  it('la paille écoute sur le port de la cible locale et se laisse remplacer par une instance réelle', () => {
    const entry = localSupabaseStubServer()
    expect(entry.command).toMatch(/^node tests\/e2e\/helpers\/supabase-stub\.mjs \d{2,5}$/)
    expect(entry.url).toMatch(/^http:\/\/127\.0\.0\.1:\d{2,5}\/rest\/v1\/$/)
    expect(entry.reuseExistingServer).toBe(true)
  })

  it('le garde lui-même ne connaît pas le projet cloud', () => {
    const lu = readFileSafely(repoPath('playwright.local-supabase.ts'))
    const src = lu.status === 'ok' ? lu.value : ''
    expect(src).not.toContain('eayczugyrvmtqnnmvjod')
    expect(src).not.toContain('supabase.co')
  })
})

describe('supabase-stub : la décision est celle de PostgREST devant un appelant anonyme', () => {
  it('rend [] à une lecture de table, et 406 PGRST116 quand un objet unique est demandé', () => {
    expect(decide('GET', '/rest/v1/kyc_cases', 'application/json')).toMatchObject({ status: 200, body: [] })
    expect(decide('GET', '/rest/v1/kyc_cases', 'application/vnd.pgrst.object+json')).toMatchObject({
      status: 406, body: { code: 'PGRST116' },
    })
  })
  it('refuse (401) les RPC, les écritures et l’auth', () => {
    expect(decide('POST', '/rest/v1/rpc/analytics_objectif', '').status).toBe(401)
    expect(decide('POST', '/rest/v1/seller_leads', '').status).toBe(401)
    expect(decide('PATCH', '/rest/v1/contacts', '').status).toBe(401)
    expect(decide('POST', '/auth/v1/token', '').status).toBe(401)
  })
  it('rend 400 22P02 à un filtre portant un identifiant du profil mock — comme PostgREST, et comme les références visuelles', () => {
    expect(mockIdInFilters('?select=id&agency_id=eq.dev-mock-agency')).toBe('dev-mock-agency')
    expect(mockIdInFilters('?select=tabs&user_id=eq.dev-mock-user')).toBe('dev-mock-user')
    expect(mockIdInFilters('?select=id&agency_id=in.(dev-mock-agency,abc)')).toBe('dev-mock-agency')
    expect(mockIdInFilters('?select=id&status=eq.active')).toBeNull()
    const r = decide('GET', '/rest/v1/transactions', 'application/json', '?select=*&agency_id=eq.dev-mock-agency')
    expect(r).toMatchObject({ status: 400, body: { code: '22P02' } })
    // Sans identifiant mock, la table répond vide comme avant.
    expect(decide('GET', '/rest/v1/transactions', 'application/json', '?select=*&status=eq.active').status).toBe(200)
  })

  it('répond au preflight et ignore le reste', () => {
    expect(decide('OPTIONS', '/rest/v1/contacts', '').status).toBe(204)
    expect(decide('GET', '/storage/v1/object/x', '').status).toBe(404)
    expect(decide('GET', '/functions/v1/send-email', '').status).toBe(404)
  })
})
