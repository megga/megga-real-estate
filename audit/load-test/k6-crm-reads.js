// audit/load-test/k6-crm-reads.js
// ─────────────────────────────────────────────────────────────────────────────
// Test de charge k6 — parcours de LECTURE du CRM agent (Supabase PostgREST + RPC).
//
// ⚠️ STAGING UNIQUEMENT. Ne PAS pointer sur la prod (eayczugyrvmtqnnmvjod).
// ⚠️ LECTURES SEULES. Aucune écriture, aucune edge function IA (coût LLM/Deepgram).
//
// But : valider la tenue « milliers d'utilisateurs simultanés » sur les requêtes
// les plus fréquentes de la journée d'un agent (pipeline, contacts, biens, analytics).
//
// Lancer :
//   BASE_URL="https://<staging-ref>.supabase.co" \
//   ANON_KEY="<staging anon key>" \
//   AGENT_JWT="<access_token d'un agent de test staging>" \
//   k6 run audit/load-test/k6-crm-reads.js
//
// Profils (via PROFILE=smoke|load|stress|soak) — défaut: smoke.
// ─────────────────────────────────────────────────────────────────────────────
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL
const ANON_KEY = __ENV.ANON_KEY
const AGENT_JWT = __ENV.AGENT_JWT
const PROFILE = __ENV.PROFILE || 'smoke'

if (!BASE_URL || !ANON_KEY || !AGENT_JWT) {
  throw new Error('BASE_URL, ANON_KEY et AGENT_JWT sont requis (voir en-tête du script).')
}
if (BASE_URL.includes('eayczugyrvmtqnnmvjod')) {
  throw new Error('Refus : BASE_URL pointe sur la PROD. Utilise un projet staging.')
}

const errorRate = new Rate('crm_errors')
const restLatency = new Trend('crm_rest_latency', true)

// Profils de charge. Monte progressivement — surveille le pooler Supabase.
const PROFILES = {
  smoke: { stages: [{ duration: '30s', target: 5 }] },
  load:  { stages: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 500 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 0 },
  ] },
  // « milliers » : monter par paliers ET vérifier les connexions du pooler à chaque palier.
  stress: { stages: [
    { duration: '2m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 2000 },
    { duration: '2m', target: 0 },
  ] },
  soak:  { stages: [{ duration: '30m', target: 300 }] },
}

export const options = {
  scenarios: { crm: { executor: 'ramping-vus', startVUs: 0, ...PROFILES[PROFILE] } },
  thresholds: {
    // SLO à ajuster : p95 < 800ms, moins de 1% d'erreurs.
    http_req_duration: ['p(95)<800'],
    crm_errors: ['rate<0.01'],
  },
}

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${AGENT_JWT}`,
  Accept: 'application/json',
  // count estimated : ne JAMAIS demander count=exact sous charge (seq scan / timeout).
  Prefer: 'count=estimated',
}

// Colonnes ciblées (pas de select=* : évite les colonnes lourdes description/photos).
const rest = (path) => {
  const res = http.get(`${BASE_URL}/rest/v1/${path}`, { headers, tags: { name: path.split('?')[0] } })
  restLatency.add(res.timings.duration)
  const ok = check(res, { 'status 200/206': (r) => r.status === 200 || r.status === 206 })
  errorRate.add(!ok)
  return res
}

export default function () {
  group('pipeline', () => {
    // Transactions de l'agence (RLS scope) — la vue pipeline.
    rest('transactions?select=id,stage,contact_id,property_id,status,updated_at&order=updated_at.desc&limit=200')
  })
  group('contacts', () => {
    rest('contacts?select=id,first_name,last_name,email,phone,status,created_at&order=created_at.desc&limit=200')
  })
  group('biens', () => {
    rest('properties?select=id,title,status,price,city,canton,created_at&order=created_at.desc&limit=200')
  })
  group('analytics-rpc', () => {
    // RPC read-only (SECURITY DEFINER, statement_timeout interne). Adapter les args.
    const res = http.post(
      `${BASE_URL}/rest/v1/rpc/analytics_cockpit`,
      JSON.stringify({}),
      { headers: { ...headers, 'Content-Type': 'application/json' }, tags: { name: 'rpc:analytics_cockpit' } },
    )
    errorRate.add(!check(res, { 'rpc ok': (r) => r.status === 200 }))
  })
  // Pense-utilisateur : pause entre deux actions.
  sleep(Math.random() * 2 + 1)
}
