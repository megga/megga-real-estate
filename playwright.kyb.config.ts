import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// `package.json` a "type": "module" -> ce fichier est chargé en ESM par le
// loader de config de Playwright (contrairement à celui de Vite/Vitest, qui
// shim __dirname pour ses propres fichiers de config — d'où sa présence, sans
// ce détour, dans vitest.backend.config.ts). __dirname n'existe pas ici.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Onboarding KYB — gate + wizard identité, avec authentification RÉELLE (pas de
// mock). Config à part, même motif que playwright.admin.config.ts (port distinct,
// même app, env de démarrage différent) : le seul test qui prouve l'absence de
// boucle du gate (tests/e2e/onboarding-identite.spec.ts) a besoin d'une VRAIE
// session Supabase (connexion, déconnexion, reconnexion), ce que
// VITE_DEV_BYPASS_AUTH interdit par construction — sous bypass, useAuth() renvoie
// toujours le même profil MOCK (agence 'dev-mock-agency') quel que soit l'état réel
// de la session (cf. useAuth.tsx), donc le gate ne verrait jamais le dirigeant
// réellement inscrit par le test. C'est aussi pourquoi ce fichier n'est PAS repris
// par playwright.config.ts (testIgnore y exclut explicitement ce spec).
//
// Second motif, propre à ce parcours : le formulaire de connexion interne a été
// retiré de cette app (le login vit sur la vitrine externe megga.ch/login, cf.
// VitrineLoginRedirect dans App.tsx) — il n'y a donc plus de champ à remplir dans
// le navigateur pour se connecter. Le test authentifie la session via le client
// Supabase RÉEL déjà bundlé par l'app (import dynamique du module Vite en dev,
// cf. onboarding-identite.spec.ts) plutôt que de fabriquer une session à la main :
// c'est le même signInWithPassword()/signOut() que l'app appelle en production,
// seul le clic sur un formulaire externe est remplacé.
//
// Cible OBLIGATOIREMENT le Supabase LOCAL (`supabase start`), jamais le projet
// cloud codé en repli dans src/lib/supabase.ts : ce test crée un vrai utilisateur
// via l'API admin, dépose un vrai fichier dans Storage, appelle une vraie RPC de
// soumission. Le garde ci-dessous refuse de démarrer si la cible n'est pas locale —
// même esprit que assertLocal() dans tests/backend/helpers/supabase.ts.
//
// Run : npm run test:e2e:kyb (nécessite `supabase start` au préalable).

// Charge .env.test.local dans process.env — même mécanisme que
// vitest.backend.setup.ts (pas de dépendance dotenv). Dupliqué plutôt qu'importé :
// c'est un fichier de config Playwright chargé avant tout test, pas un setupFile
// Vitest ; les deux outils n'ont pas de point d'extension commun pour ça.
const envPath = path.resolve(__dirname, '.env.test.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    // Ne jamais écraser une variable déjà posée par le shell (CI, etc.).
    if (!process.env[key]) process.env[key] = value
  }
}

const SUPABASE_TEST_URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY
const SUPABASE_TEST_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY

// Refuse de démarrer si la cible n'est pas locale ou si les clés manquent. Sans ce
// garde, un VITE_SUPABASE_URL vide retomberait sur le repli codé en dur de
// src/lib/supabase.ts — le projet CLOUD de production — et ce test créerait de
// vrais utilisateurs et de vraies agences chez le client réel.
if (!SUPABASE_TEST_URL.startsWith('http://127.0.0.1') && !SUPABASE_TEST_URL.startsWith('http://localhost')) {
  throw new Error(
    `[playwright.kyb.config] SUPABASE_TEST_URL doit cibler une instance locale, reçu: ${SUPABASE_TEST_URL}. ` +
    'Lancer `supabase start` puis vérifier .env.test.local.'
  )
}
if (!SUPABASE_TEST_ANON_KEY || !SUPABASE_TEST_SERVICE_ROLE_KEY) {
  throw new Error(
    '[playwright.kyb.config] SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY manquantes. ' +
    'Lancer `supabase start` puis `supabase status` pour les récupérer (.env.test.local).'
  )
}

export default defineConfig({
  testDir: './tests/e2e',
  // Un seul spec sous ce config — tous les autres supposent VITE_DEV_BYPASS_AUTH
  // (cf. en-tête) et échoueraient sous authentification réelle.
  testMatch: ['onboarding-identite.spec.ts'],
  // Chaque test crée son propre dirigeant/agence (isolation par ligne), mais tous
  // frappent la MÊME instance Supabase locale (auth + Postgres partagés) : le
  // parallélisme n'apporterait qu'un risque de rate-limit GoTrue local pour un
  // seul fichier de 2 tests — la fiabilité prime sur la vitesse ici.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['list'], ['html', { open: 'never' }]],
  // Plus généreux que le config principal (30s) : chaque test enchaîne plusieurs
  // vrais aller-retours réseau (auth, 5 étapes, 2 téléversements Storage, RPC de
  // soumission, déconnexion/reconnexion) contre une instance Supabase locale.
  timeout: 90_000,
  // 20s (config principal : 10s) : constaté à l'usage — la toute première
  // navigation d'un serveur `vite dev` fraîchement démarré (aucun cache
  // node_modules/.vite préexistant) peut dépasser 10s le temps que Vite
  // transforme à la volée toute la chaîne de modules du CRM, avant même que la
  // résolution du gate (session + agence + is_super_admin()) ne commence.
  expect: { timeout: 20_000 },

  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Port distinct de 5173 (suite principale) et 5174 (admin) — les trois peuvent
    // coexister, même motif que playwright.admin.config.ts.
    command: 'npm run dev -- --port 5175',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // PAS de VITE_DEV_BYPASS_AUTH ici : c'est tout le point de ce config (cf.
      // en-tête). L'app démarre donc en mode auth réel, contre le Supabase local.
      VITE_SUPABASE_URL: SUPABASE_TEST_URL,
      VITE_SUPABASE_ANON_KEY: SUPABASE_TEST_ANON_KEY,
      VITE_PASSWORD_GATE_BYPASS: 'true',
    },
  },
})
