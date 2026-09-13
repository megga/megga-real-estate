/**
 * Client Supabase singleton (typé via src/types/database.ts) partagé par tout le
 * frontend. Gère aussi le cycle de vie des tokens auth : stockage « Se souvenir
 * de moi » (local vs sessionStorage), purge des JWT expirés au boot et
 * récupération runtime sur 401 PGRST301. Anon key publique par design (sécurité
 * via RLS), codée en dur en fallback pour éviter qu'un service_role fuite dans
 * le bundle public.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { classifyPublicKey, publicKeyRefusalMessage } from '@/lib/publicKeyGuard'
import { createAuthStorage, scrubStoredProviderTokens } from '@/lib/authStorage'
import { comptePage } from '@/lib/stockageParCompte'

// Typed client — schema in src/types/database.ts is regenerated via:
//   npx supabase gen types typescript --project-id eayczugyrvmtqnnmvjod > src/types/database.ts
// NOT `--local`: this repo runs no local Supabase stack (no Docker), so `--local`
// points at a database that does not exist — the remote project is the only source
// of truth. The file also carries a hand-written `/** */` header the generator does
// not emit: put it back. `npm run lint:types-freshness` is what catches the drift.

// Real anon key for the MEGGA Supabase project (eayczugyrvmtqnnmvjod).
// anon keys are PUBLIC BY DESIGN — their security relies on Row Level Security (RLS).
// Hardcoded because Cloudflare Pages env vars were previously misconfigured
// (service_role was set where anon was expected → key leaked in the public bundle).
// Having the true anon key in git ensures the frontend can't accidentally ship
// a service_role key even if the env var is misconfigured again.
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheWN6dWd5cnZtdHFubm12am9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTM4ODgsImV4cCI6MjA4OTE4OTg4OH0.T257g0ws-PmTTBSDBcUQF6WFvVRLmTFHUwIYMgmCrMw'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://eayczugyrvmtqnnmvjod.supabase.co'

// SAFETY CHECK — prevent a non-public key from ever being used as the public
// client key. service_role bypasses RLS and must NEVER reach the browser.
//
// La classification vit dans `publicKeyGuard.ts` : elle est pure, donc testée
// (tests/unit/public-key-guard.spec.ts). Ce contrôle ne décodait qu'un JWT
// jusqu'au 04.08.2026 et laissait donc passer le format `sb_secret_…`, que ce
// projet utilise déjà — voir l'en-tête de ce module pour le détail.
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
let supabaseAnonKey = envKey || DEFAULT_ANON_KEY

const verdict = classifyPublicKey(supabaseAnonKey)
if (!verdict.safe) {
  // Repli sur l'anon key codée en dur — c'est la vraie clé du projet, donc
  // l'application continue de fonctionner pendant qu'on corrige la variable.

  console.error(publicKeyRefusalMessage(verdict))
  supabaseAnonKey = DEFAULT_ANON_KEY
}

// Exposés pour les appels fetch directs (SSE du copilote MEGGA AI) —
// supabase.functions.invoke ne sait pas lire une réponse streamée. Valeurs
// publiques (l'anon key est publique par design, la sécurité vient de RLS).
export const SUPABASE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1`
export const SUPABASE_PUBLIC_ANON_KEY = supabaseAnonKey

/**
 * La région où s'EXÉCUTENT les Edge Functions : celle de la base (Irlande).
 *
 * ⛔ SANS ÉPINGLE, UNE FONCTION S'EXÉCUTE PRÈS DE L'APPELANT. Mesuré le 13.09.2026 dans les
 * journaux (`x_sb_edge_region`) : un navigateur suisse tombe à Zurich, un agent en voyage
 * tomberait à New York, et les 142 appels du webhook de Meta en 24 h — messages et accusés
 * WhatsApp, chacun porteur d'un numéro de téléphone — se sont tous exécutés aux États-Unis.
 * L'Irlande est déjà l'hôte de la base : y épingler ne crée aucun transfert, et raccourcit
 * chaque aller-retour fonction ↔ base.
 *
 * ⚠ PAR LE PARAMÈTRE D'URL SEUL, jamais par l'option `region` de supabase-js : elle pose
 * AUSSI l'en-tête `x-region`, que le préflight CORS de nos fonctions ne déclare pas — tout
 * appel du navigateur tomberait. Garde : tests/unit/region-fonctions.spec.ts.
 */
export const REGION_FONCTIONS = 'eu-west-1'

/** Ajoute l'épingle de région à une URL de fonction (idempotent) ; les autres URL passent telles quelles. */
export function epinglerRegion(url: string): string {
  if (!url.startsWith(`${SUPABASE_FUNCTIONS_URL}/`) || /[?&]forceFunctionRegion=/.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}forceFunctionRegion=${REGION_FONCTIONS}`
}

/**
 * L'URL d'une fonction pour un `fetch` DIRECT (flux du copilote, pages publiques, pièces
 * jointes) — ceux qui ne passent pas par le client, donc pas par `authAwareFetch`.
 */
export function urlFonction(nom: string, query?: Record<string, string> | URLSearchParams): string {
  const params = new URLSearchParams(query)
  params.set('forceFunctionRegion', REGION_FONCTIONS)
  return `${SUPABASE_FUNCTIONS_URL}/${nom}?${params}`
}

// ─── Stockage de session ────────────────────────────────────────────────
// « Se souvenir de moi » (localStorage.megga_remember === 'false' ⇒ la session
// meurt avec l'onglet) ET retrait des jetons de fournisseur Google/Microsoft
// avant toute écriture : voir l'en-tête de `@/lib/authStorage`.
const authStorage = createAuthStorage({
  local: () => (typeof window === 'undefined' ? null : window.localStorage),
  session: () => (typeof window === 'undefined' ? null : window.sessionStorage),
  location: () => (typeof window === 'undefined' ? null : window.location),
})

/**
 * Clé de la session d'auth-js dans le stockage — même dérivation que supabase-js
 * (`sb-<premier label de l'hôte>-auth-token`), épinglée par supabase-cle-session.spec.ts.
 */
export const CLE_SESSION_AUTH = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

/** `sub` d'un JWT, sans vérifier sa signature ; null si illisible. */
export function sujetDuJeton(jwt: string | null | undefined): string | null {
  const charge = jwt?.split('.')[1]
  if (!charge) return null
  try {
    const json = atob(charge.replace(/-/g, '+').replace(/_/g, '/'))
    const sub = (JSON.parse(json) as { sub?: unknown }).sub
    return typeof sub === 'string' && sub !== '' ? sub : null
  } catch {
    return null
  }
}

/**
 * Le compte dont CET onglet porte la session, lu dans son propre stockage, de
 * façon synchrone (aucun verrou d'auth) ; null sans session lisible.
 *
 * POURQUOI : le stockage de l'onglet dit la vérité sur son compte. Un événement
 * SIGNED_IN relayé par BroadcastChannel peut venir d'un autre onglet dont la
 * session vit à part (« Se souvenir de moi » décoché) — le suivre ferait
 * recharger les deux onglets l'un après l'autre, sans fin.
 */
export function lireUidSessionStockee(): string | null {
  try {
    const brut = authStorage.getItem(CLE_SESSION_AUTH)
    if (!brut) return null
    const s = JSON.parse(brut) as { user?: { id?: unknown }; access_token?: string } | null
    const id = s?.user?.id
    if (typeof id === 'string' && id !== '') return id
    return sujetDuJeton(s?.access_token)
  } catch {
    return null
  }
}

/**
 * Supprime les clés de session d'auth-js (local + session) : `sb-*-auth-token`,
 * et le vérificateur PKCE `sb-*-auth-token-code-verifier` qu'une connexion
 * abandonnée laisse derrière elle. `reason` sert au log.
 */
export function purgeAuthTokens(reason: string) {
  if (typeof window === 'undefined') return
  for (const store of [window.localStorage, window.sessionStorage]) {
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i)
      if (!key || !key.startsWith('sb-') || !/-auth-token(-code-verifier)?$/.test(key)) continue
      try { store.removeItem(key) } catch { /* ignore */ }
    }
  }
   
  console.info(`[supabase] purged auth tokens (${reason})`)
}

// ─── Runtime JWT-failure recovery ──────────────────────────────────────
// purgeExpiredAuthTokens above handles the case where the token was dead
// at module load. But access_tokens can also be revoked mid-session
// (server-side rotation, refresh_token expiry while the tab is open).
// Once that happens, every subsequent REST call returns 401 PGRST301
// "JWT cryptographic operation failed" and the marketplace falls dark.
//
// We wrap the global fetch passed to supabase-js: when we see that
// specific failure mode, purge the stale tokens so the next React Query
// retry goes anonymous. We only act once per page load to avoid loops
// when a request genuinely fails 401 for unrelated reasons.
let jwtRecoveryAttempted = false

/**
 * Garde d'IDENTITÉ : aucune requête de données ne part avec le jeton d'un autre
 * compte que celui auquel la page est liée (audit S11).
 *
 * POURQUOI : supabase-js relit le jeton dans le stockage PARTAGÉ à chaque appel.
 * Entre l'instant où un autre onglet range la session de B et celui où cet onglet
 * l'apprend (événement `storage`, BroadcastChannel), toute requête de la page de A
 * — sauvegarde différée, mutation en vol, rafraîchissement au focus — partirait
 * sous l'identité de B, avec les données de A. On la refuse ici (401 synthétique
 * `compte_change`) ; le rechargement suit.
 *
 * `/auth/v1/` est exempté : c'est par là que la session change, et une
 * déconnexion doit pouvoir partir. Hors périmètre : les `fetch` DIRECTS (flux du
 * copilote, détection d'appareil), qui ne passent pas par ce client.
 */
function refuseCompteEtranger(input: RequestInfo | URL, init?: RequestInit): Response | null {
  const lie = comptePage()
  if (!lie) return null
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/auth/v1/')) return null
  const entetes = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  const jeton = entetes.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const sub = sujetDuJeton(jeton)
  if (!sub || sub === lie) return null
  return new Response(JSON.stringify({ code: 'compte_change', message: 'La session a changé de compte : la page va se recharger.' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function authAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const refus = refuseCompteEtranger(input, init)
  if (refus) return refus
  // Toute URL de fonction (dont `functions.invoke`) s'exécute dans la région de la base.
  const cible = typeof input === 'string' ? epinglerRegion(input)
    : input instanceof URL ? new URL(epinglerRegion(input.href))
      : input.url.startsWith(`${SUPABASE_FUNCTIONS_URL}/`) ? new Request(epinglerRegion(input.url), input) : input
  const response = await fetch(cible, init)
  if (response.status === 401 && !jwtRecoveryAttempted) {
    try {
      // Clone before reading body — the original is consumed by supabase-js.
      const peek = await response.clone().text()
      if (peek.includes('PGRST301') || peek.includes('JWT')) {
        jwtRecoveryAttempted = true
        purgeAuthTokens('runtime 401 PGRST301')
        // Don't reload — let React Query's retry machinery (configured
        // with retry: 1 + retryDelay) re-run the query without the now-
        // missing Authorization header. If the user was actually signed
        // in, they'll see the empty-state until they re-auth, which is
        // strictly better than a permanently blank page.
      }
    } catch { /* ignore — never throw from here */ }
  }
  return response
}

/** Purge au boot les tokens auth déjà expirés (grâce 60s) ou corrompus, pour partir d'une session propre avant d'instancier le client. */
function purgeExpiredAuthTokens() {
  if (typeof window === 'undefined') return
  try {
    const stores = [window.localStorage, window.sessionStorage]
    const now = Math.floor(Date.now() / 1000)
    for (const store of stores) {
      for (let i = store.length - 1; i >= 0; i--) {
        const key = store.key(i)
        if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
        const raw = store.getItem(key)
        if (!raw) continue
        try {
          const parsed = JSON.parse(raw) as { access_token?: string; expires_at?: number } | null
          const exp =
            typeof parsed?.expires_at === 'number'
              ? parsed.expires_at
              : (() => {
                  const t = parsed?.access_token
                  if (!t) return 0
                  try {
                    const payload = t.split('.')[1]
                    if (!payload) return 0
                    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
                    return Number((JSON.parse(json) as { exp?: number }).exp ?? 0)
                  } catch { return 0 }
                })()
          // 60s grace window so we don't churn keys that supabase-js is
          // about to refresh on its own.
          if (exp && exp + 60 < now) {
            store.removeItem(key)
             
            console.info(`[supabase] purged expired auth token: ${key}`)
          }
        } catch {
          // Malformed JSON in the auth slot — also nuke it, supabase-js
          // can't recover from it either.
          store.removeItem(key)
           
          console.info(`[supabase] purged malformed auth token: ${key}`)
        }
      }
    }
    // Une version antérieure du CRM rangeait les jetons de fournisseur avec la
    // session : on les retire de ce qui survit à la purge (cf. authStorage).
    for (const store of stores) scrubStoredProviderTokens(store)
  } catch { /* defensive — never block app boot on storage probing */ }
}

// Run the boot-time purge BEFORE we instantiate the client so the client
// reads a clean slate.
purgeExpiredAuthTokens()

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: authAwareFetch,
  },
})
