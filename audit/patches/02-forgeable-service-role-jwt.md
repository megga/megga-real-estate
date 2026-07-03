# Patch 02 — JWT `service_role` forgeable (P0, S1b / S22)

**Fichiers** : `supabase/functions/photo-processor/index.ts` · `supabase/functions/backfill-cf-images/index.ts`

## Problème
Les deux fonctions authentifient via `decodeJwtRole()` qui décode le payload **sans vérifier la signature**, puis
acceptent `role === 'service_role'`. Sous `--no-verify-jwt`, un JWT forgé `{"role":"service_role"}` (signature
bidon) passe → accès service-role anonyme (SSRF, écrasement R2, corruption `market_listings`, pivot).

Le fallback `token === SERVICE_ROLE_KEY` existe car l'env `SUPABASE_SERVICE_ROLE_KEY` n'est pas toujours injecté
dans le runtime EF. **Solution alignée sur le repo** (`whatsapp-agent-async`, `whatsapp-process`, `learn-agent-style`) :
comparer en **temps constant** le token reçu au secret **stocké en base** `app_config.service_role_key`, et
**supprimer** la branche de décodage de rôle.

## Helper partagé proposé — `supabase/functions/_shared/require-service-secret.ts`
```ts
// Garde service-role pour fonctions cron/internes déployées --no-verify-jwt.
// Compare le Bearer reçu à app_config.service_role_key (même source que pg_cron),
// en temps constant. NE décode PAS le JWT (une signature n'est pas vérifiée ici).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function isServiceSecret(admin: SupabaseClient, req: Request): Promise<boolean> {
  const { data } = await admin.from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()
  const expected = (data?.value as string | undefined) ?? ''
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  // Filet supplémentaire : accepter aussi l'env si présent (parité avec l'existant).
  const envKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()
  return (!!expected && safeEqual(provided, expected)) || (!!envKey && safeEqual(provided, envKey))
}
```

## A) `photo-processor/index.ts`

### Supprimer le décodeur forgeable (l.57-70) et adapter l'auth (l.198-216)

**AVANT** (l.204-216) :
```ts
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const role = decodeJwtRole(token)
  const isServiceRole = role === 'service_role' || (SERVICE_ROLE_KEY !== '' && token === SERVICE_ROLE_KEY)
  if (!isServiceRole) {
    return new Response(
      JSON.stringify({ success: false, error: 'service_role required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
```
**APRÈS** :
```ts
  // Garde service-role SANS décodage de JWT (signature non vérifiée sous --no-verify-jwt).
  // Compare en temps constant au secret app_config.service_role_key. cf. S1b.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )
  if (!(await isServiceSecret(admin, req))) {
    return new Response(
      JSON.stringify({ success: false, error: 'service_role required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
```
+ Ajouter l'import `import { isServiceSecret } from '../_shared/require-service-secret.ts'` et
`import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'` (si absent).
+ **Supprimer** la fonction `decodeJwtRole` (l.57-70) devenue inutile.

### Corriger le path-traversal R2 (S1b) — valider `listingId` (et `keyPrefix`)

Dans le handler, après le parse du body `{ listingId, photoUrls, keyPrefix }`, avant tout traitement :
```ts
  const SAFE_ID = /^[A-Za-z0-9_-]+$/
  const SAFE_PREFIX = /^[A-Za-z0-9/_-]+$/
  if (!SAFE_ID.test(listingId ?? '')) {
    return new Response(JSON.stringify({ success: false, error: 'invalid listingId' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  if (keyPrefix !== undefined && (!SAFE_PREFIX.test(keyPrefix) || keyPrefix.includes('..'))) {
    return new Response(JSON.stringify({ success: false, error: 'invalid keyPrefix' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
```
> Empêche `listingId = "../../<clé cible>"` d'écraser des objets R2 arbitraires (`baseKey`, l.167).

### Résiduel (optionnel) — SSRF `photoUrls`
Maintenant que l'accès est service-role only, le risque SSRF chute fortement. Défense en profondeur possible :
router `fetchPhotoBytes` (l.137-148) via le helper `safeFetch` (blocage IP privées + limite de taille) — voir
patch SSRF de la salve 2.

## B) `backfill-cf-images/index.ts`

Même faille (l.34-43, 66-71). Garder la branche **super_admin** (l.73-86, correcte : `getUser` + `profiles.role`),
remplacer **uniquement** la branche service-role forgeable.

**AVANT** (l.66-71) :
```ts
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '')
  const role = decodeJwtRole(bearerToken)
  const isServiceRole =
    role === 'service_role' || (SERVICE_ROLE_KEY !== '' && bearerToken === SERVICE_ROLE_KEY)
```
**APRÈS** :
```ts
  // Plus de décodage de rôle : comparaison constant-time au secret app_config. cf. S22.
  const isServiceRole = await isServiceSecret(supabase, req)
```
+ Import `isServiceSecret`. + **Supprimer** `decodeJwtRole` (l.34-43). La suite (`isSuperAdmin`, l.72-87) est inchangée.

## Test
- POST avec `Authorization: Bearer <JWT forgé role=service_role, signature bidon>` → **401/403** (avant : accepté).
- POST cron avec le vrai `app_config.service_role_key` → 200 (parité maintenue).
- `photo-processor` avec `listingId:'../x'` → 400.
- Ajouter `tests/backend/edge-service-secret.spec.ts` (forgé rejeté / vrai accepté).
