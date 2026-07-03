# Patch 09 — R4 : authentifier les fonctions coût/DoS (ÉLEVÉ/MOYEN)

**Fichiers** : `dashboard-ai-hint`, `translate-on-demand`, `speech-to-text` (front → `requireAgentAuth`) ·
`flatfox-sync`, `realadvisor-sync`, `market-scraper`, `market-scraper-batch`, `search-alert`,
`send-reminder-email`, `send-visit-email` (cron/interne → `requireServiceSecret` du patch 02).

## A) `dashboard-ai-hint/index.ts` (ÉLEVÉ) — auth agent + `agency_id` serveur

**AVANT** (l.166-197) :
```ts
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as { snapshot: SnapshotInput; agency_id?: string }
    const snapshot = body.snapshot
    ...
    // Log async (n'attend pas la fin)
    void logHint(body.agency_id ?? null, snapshot, hint, usedClaude)
```

**APRÈS** :
```ts
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'   // ⬅️ en tête du fichier

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth agent : coupe l'abus anonyme de Claude + l'injection cross-tenant dans activity_events (S1c).
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth

  try {
    const body = await req.json() as { snapshot: SnapshotInput }
    const snapshot = body.snapshot
    ...
    // agency_id vient du PROFIL authentifié, jamais du body (anti-injection cross-tenant).
    void logHint(auth.profile.agency_id, snapshot, hint, usedClaude)
```

## B) `translate-on-demand`, `speech-to-text` (MOYEN) — auth agent + borne de taille
Même schéma : `const auth = await requireAgentAuth(req, corsHeaders); if (auth instanceof Response) return auth;`
en tête du handler. + Borne d'entrée : `translate-on-demand` → rejeter `content.length > 5000` ;
`speech-to-text` → rejeter un upload audio > (p.ex.) 10 Mo. + rate-limit léger par `auth.profile.id`.

## C) Fonctions cron/internes → `requireServiceSecret` (patch 02)
En tête de handler, après le `createClient(service_role)` :
```ts
import { isServiceSecret } from '../_shared/require-service-secret.ts'
// ...
if (!(await isServiceSecret(admin, req))) {
  return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders })
}
```
À appliquer à : `flatfox-sync` (l.745-751), `realadvisor-sync` (l.1067-1077), `market-scraper` (l.56-73),
`market-scraper-batch` (l.35-102), `search-alert` (l.158), `send-reminder-email` (l.157-160),
`send-visit-email` (l.64+). Le déclencheur cron doit déjà envoyer `Authorization: Bearer <app_config.service_role_key>`
(cas de `market-scraper-batch` → sous-appels ; vérifier les autres schedules pg_cron et ajouter l'en-tête si absent).

## Test
- `dashboard-ai-hint` sans session agent → 401 (avant : brûlait des tokens Claude).
- `dashboard-ai-hint` avec `body.agency_id` d'une autre agence → ignoré (log sur l'agence du profil).
- Appel anonyme d'un scraper → 403 ; appel cron avec le vrai secret → 200.
