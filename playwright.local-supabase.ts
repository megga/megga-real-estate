// La cible Supabase des suites Playwright sous VITE_DEV_BYPASS_AUTH — et la raison pour
// laquelle elle est écrite ici plutôt que laissée au hasard.
//
// ⛔ MESURÉ LE 13.09.2026 DANS LES JOURNAUX DE PRODUCTION. Les trois suites « bypass »
// (agent, admin, visuelle) démarraient `npm run dev` sans `VITE_SUPABASE_URL`. Le client
// (`src/lib/supabase.ts`) retombe alors sur le projet CLOUD codé en dur : chaque exécution de
// la CI frappait donc la base de production avec la clé anon et un utilisateur factice
// `dev-mock-user` — 6 212 réponses 401, ~4 000 réponses 400 et 749 connexions Realtime en
// 24 h, depuis les runners GitHub (IP Azure, référent `http://localhost:5173/`). Aucune
// écriture n'a abouti (la RLS a tenu), mais `seller_leads` accepte l'INSERT anonyme : un test
// qui remplit ce formulaire un jour écrirait chez le client réel. Et ce trafic noyait les
// journaux Postgres de « permission denied », au point de masquer les vrais signaux.
//
// Ces suites n'ont PAS besoin d'un backend : sous bypass, `useAuth()` rend un profil MOCK et
// les écrans tournent sur des fixtures. Elles ont besoin d'une cible qui ne soit JAMAIS la
// production. Par défaut : le Supabase LOCAL (`supabase start`, 127.0.0.1:54321). S'il ne
// tourne pas — c'est le cas du job `e2e` de la CI, qui ne démarre pas Docker par choix —
// Playwright lance à sa place un serveur de PAILLE (tests/e2e/helpers/supabase-stub.mjs) qui
// répond ce que la production répondait à un appelant anonyme : 401 sur les RPC, `[]` sur
// les tables, 406 sur un `.single()` vide. ⚠ Une URL simplement INJOIGNABLE ne convient pas,
// et c'est mesuré : un `connection refused` n'est pas un 401 — TanStack Query rejoue les
// échecs réseau (1 s, 2 s, 4 s), la pile d'onglets attend ~7 s avant d'activer l'écran, et
// la fiche KYC reste sur « Chargement du dossier… » au-delà des 10 s du test.
//
// ⚠ Le garde refuse tout hôte non local : poser `SUPABASE_TEST_URL` sur un hôte cloud
// pour « faire marcher un test » ne doit pas être possible sans le voir.
// Gardé par tests/unit/e2e-local-supabase.spec.ts.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

/** Ce que `supabase start` sert quand aucune clé n'est configurée. */
export const LOCAL_SUPABASE_URL_DEFAULT = 'http://127.0.0.1:54321'

/**
 * La clé anon de DÉMONSTRATION de la CLI Supabase — identique sur toute installation locale,
 * publique par construction (rôle `anon`, émetteur `supabase-demo`). Elle n'ouvre rien : sans
 * instance locale, il n'y a personne au bout ; avec, la RLS locale s'applique.
 */
export const LOCAL_SUPABASE_DEMO_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

/**
 * Charge `.env.test.local` dans `process.env` sans écraser ce que le shell a posé (CI).
 * Même mécanisme que vitest.backend.setup.ts, sans dépendance dotenv.
 */
export function loadEnvTestLocal(): void {
  const envPath = path.resolve(ROOT, '.env.test.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

/** Un hôte local, et rien d'autre : `localhost` ou `127.0.0.1`, en http, port libre. */
export function isLocalSupabaseUrl(url: string): boolean {
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?\/?$/.test(url.trim())
}

/** Le port de la cible locale (54321 par défaut, ou celui de SUPABASE_TEST_URL). */
function localSupabasePort(url: string): number {
  const m = /:(\d{1,5})\/?$/.exec(url.trim())
  return m ? Number(m[1]) : 80
}

/**
 * L'entrée `webServer` du serveur de paille, à placer AVANT celle du serveur de dev.
 * `reuseExistingServer: true` : si un Supabase local RÉEL écoute déjà sur ce port
 * (`supabase start`), Playwright le réutilise et la paille ne démarre pas — les tests
 * tournent alors contre une vraie base, sans rien changer d'autre. L'URL sondée répond
 * 200 chez la paille et 401 (sans clé) chez Kong : Playwright tient les deux pour « prêt ».
 */
export function localSupabaseStubServer(): {
  command: string; url: string; reuseExistingServer: boolean; timeout: number; stdout: 'pipe'; stderr: 'pipe'
} {
  const { VITE_SUPABASE_URL } = localSupabaseWebServerEnv()
  const port = localSupabasePort(VITE_SUPABASE_URL)
  return {
    command: `node tests/e2e/helpers/supabase-stub.mjs ${port}`,
    url: `http://127.0.0.1:${port}/rest/v1/`,
    reuseExistingServer: true,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  }
}

/**
 * Les deux variables à donner au serveur de dev d'une suite sous bypass. Lève si la cible
 * n'est pas locale — c'est le seul moyen de ne pas retomber sur le projet cloud en silence.
 */
export function localSupabaseWebServerEnv(): { VITE_SUPABASE_URL: string; VITE_SUPABASE_ANON_KEY: string } {
  loadEnvTestLocal()
  const url = process.env.SUPABASE_TEST_URL ?? LOCAL_SUPABASE_URL_DEFAULT
  if (!isLocalSupabaseUrl(url)) {
    throw new Error(
      `[playwright.local-supabase] SUPABASE_TEST_URL doit cibler une instance locale, reçu : ${url}. ` +
      'Les suites Playwright ne frappent jamais le projet cloud.',
    )
  }
  return {
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: process.env.SUPABASE_TEST_ANON_KEY || LOCAL_SUPABASE_DEMO_ANON_KEY,
  }
}
