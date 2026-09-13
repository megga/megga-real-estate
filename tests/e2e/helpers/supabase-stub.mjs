#!/usr/bin/env node
/**
 * Un Supabase de PAILLE pour les suites Playwright sous VITE_DEV_BYPASS_AUTH.
 *
 * POURQUOI. Jusqu'au 13.09.2026, ces suites frappaient la PRODUCTION (cf.
 * playwright.local-supabase.ts) : la clé anon y obtenait 401 sur les RPC, 200 `[]` sur les
 * tables lisibles, 406 sur un `.single()` sans ligne — et les écrans, sous bypass, rendaient
 * leurs états vides ou d'échec à partir de ces réponses. Pointer les suites vers une URL
 * locale INJOIGNABLE ne suffit pas : un `ERR_CONNECTION_REFUSED` n'est pas un 401. Mesuré :
 * TanStack Query rejoue les échecs réseau (retries à 1 s, 2 s, 4 s), la pile d'onglets
 * attend ~7 s avant de rendre l'écran actif, et la fiche KYC reste sur « Chargement du
 * dossier… » au-delà des 10 s d'attente du test — trois échecs déterministes.
 *
 * Ce serveur rend aux écrans EXACTEMENT ce que la production rendait à un appelant anonyme,
 * sans base, sans Docker, en quelques millisecondes :
 *   · GET/HEAD /rest/v1/<table>  → 200 `[]`, ou 406 PGRST116 si `Accept` demande un objet
 *     (`.single()` / `.maybeSingle()` sur zéro ligne, comme PostgREST) ;
 *   · POST /rest/v1/rpc/*, écritures sur les tables, /auth/v1/* → 401 « permission denied » ;
 *   · tout le reste (/storage, /functions, /realtime en HTTP) → 404.
 * Le socket Realtime n'est pas servi : le navigateur le voit refusé, et
 * tests/e2e/helpers/console.ts range ce bruit avec « Failed to load resource ».
 *
 * ⚠ CE N'EST PAS UN BACKEND. Aucune donnée n'existe ici, et aucun test ne doit en attendre :
 * ce qui exige de vraies lignes se prouve contre `supabase start` (playwright.kyb.config.ts,
 * tests/backend). Si une instance locale RÉELLE écoute déjà sur le port, Playwright la
 * réutilise et ce fichier ne démarre pas (`reuseExistingServer: true`).
 *
 * Usage : node tests/e2e/helpers/supabase-stub.mjs [port]   (défaut 54321, 127.0.0.1 seul)
 */
import http from 'node:http'
import { pathToFileURL } from 'node:url'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-expose-headers': '*',
}

const PERMISSION_DENIED = { code: '42501', details: null, hint: null, message: 'permission denied (supabase-stub)' }
const NO_ROW = {
  code: 'PGRST116', details: 'The result contains 0 rows', hint: null,
  message: 'JSON object requested, multiple (or no) rows returned',
}

/**
 * La décision, pure, pour qu'elle se teste à l'unité (tests/unit/e2e-local-supabase.spec.ts).
 * @param {string} method
 * @param {string} pathname
 * @param {string} accept  en-tête Accept de la requête ('' si absent)
 * @returns {{ status: number, body: unknown, headers?: Record<string, string> }}
 */
export function decide(method, pathname, accept = '') {
  if (method === 'OPTIONS') return { status: 204, body: null }
  if (pathname === '/rest/v1/' || pathname === '/rest/v1') return { status: 200, body: {} }
  if (pathname.startsWith('/rest/v1/rpc/')) return { status: 401, body: PERMISSION_DENIED }
  if (pathname.startsWith('/rest/v1/')) {
    if (method === 'GET' || method === 'HEAD') {
      if (accept.includes('vnd.pgrst.object')) return { status: 406, body: NO_ROW }
      return { status: 200, body: [], headers: { 'content-range': '*/0' } }
    }
    return { status: 401, body: PERMISSION_DENIED }
  }
  if (pathname.startsWith('/auth/v1/')) {
    return { status: 401, body: { error: 'unauthorized', error_description: 'supabase-stub: aucune session sous bypass' } }
  }
  return { status: 404, body: { error: 'supabase-stub: not found', path: pathname } }
}

export function createStubServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const d = decide(req.method ?? 'GET', url.pathname, req.headers.accept ?? '')
    const headers = { ...CORS, ...(d.headers ?? {}) }
    if (d.body === null) { res.writeHead(d.status, headers); res.end(); return }
    res.writeHead(d.status, { ...headers, 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(d.body))
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] ?? 54321)
  const server = createStubServer()
  // Une tentative d'ouverture de socket (Realtime) est refermée sans poignée de main :
  // pas de 'upgrade' servi, le navigateur journalise l'échec et l'app réessaie en fond.
  server.on('upgrade', (_req, socket) => socket.destroy())
  server.listen(port, '127.0.0.1', () => {
    console.log(`[supabase-stub] 127.0.0.1:${port} — 401/[]/406 à la manière de PostgREST, aucune donnée`)
  })
}
