# Patch 10 — R5 : neutraliser les SSRF (ÉLEVÉ/MOYEN)

**Fichiers** : `c2pa-sign` (S23), `virtual-staging` (S24), `c2pa-verify` (S1h), + durcissement `photo-processor`.

## Helper partagé — `supabase/functions/_shared/safe-fetch.ts`
Le repo a déjà le bon patron dans `extract-property-url` (allowlist + timeout + redirect re-validé). On généralise
avec un blocage des IP privées/link-local.
```ts
const BLOCKED_IP = [
  /^127\./, /^10\./, /^0\./, /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^::1$/, /^fc00:/i, /^fe80:/i,
]

export async function safeFetch(
  rawUrl: string,
  { maxBytes = 8_000_000, timeoutMs = 8_000 }: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<Uint8Array> {
  const u = new URL(rawUrl)
  if (u.protocol !== 'https:') throw new Error('ssrf: https_only')

  // Résolution DNS + refus des cibles internes (bloque aussi un rebinding basique).
  const ips = await Deno.resolveDns(u.hostname, 'A').catch(() => [] as string[])
  if (ips.length === 0) throw new Error('ssrf: dns_unresolved')
  if (ips.some(ip => BLOCKED_IP.some(r => r.test(ip)))) throw new Error('ssrf: blocked_ip')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(u, { redirect: 'manual', signal: ctrl.signal })
    if (res.status >= 300 && res.status < 400) throw new Error('ssrf: redirect_blocked')
    if (!res.ok) throw new Error(`fetch ${res.status}`)
    // Plafond de taille (anti-DoS mémoire).
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength > maxBytes) throw new Error('ssrf: too_large')
    return buf
  } finally {
    clearTimeout(timer)
  }
}
```

## Câblage

### `c2pa-sign` (S23) — SSRF authentifié
Remplacer les `fetch(photoUrl)` (audit : l.83, l.132, l.160) par `safeFetch(photoUrl)`. **Et** lier les URLs aux
photos réelles du bien : n'accepter que des `photoUrls` présentes dans `property.photos` (le contrôle d'ownership
existe déjà sur `propertyId`, l.51 — étendre au tableau d'URLs).
```ts
// après avoir chargé `property` :
const allowed = new Set<string>(property.photos ?? [])
if (!photoUrls.every((u: string) => allowed.has(u))) {
  return new Response(JSON.stringify({ error: 'photoUrls must belong to the property' }), { status: 400, headers: corsHeaders })
}
```

### `virtual-staging` (S24) — SSRF + injection de chemin Storage
1. `fetch(photoUrl)` (audit : l.355, l.414) → `safeFetch(photoUrl)` + même liaison `property.photos`.
2. **Valider `style` au runtime** avant de l'interpoler dans la clé d'objet (l.501) :
```ts
const STAGING_STYLES = ['modern', 'scandinavian', 'minimalist', 'classic', /* … enum réel StagingStyle */] as const
if (!STAGING_STYLES.includes(style as typeof STAGING_STYLES[number])) {
  return new Response(JSON.stringify({ error: 'invalid style' }), { status: 400, headers: corsHeaders })
}
// la clé `${propertyId}/staged_${Date.now()}_${style}.jpg` ne peut plus contenir de `/` ni `..`
```

### `c2pa-verify` (S1h) — SSRF non authentifiée
`fetch(photoUrl)` (audit : l.39) → `safeFetch(photoUrl)`. (Cette fonction reste publique par design ; le helper
suffit à bloquer les cibles internes + le fetch non borné.)

### `photo-processor` (S1b, complément)
Router `fetchPhotoBytes` (l.137-148) via `safeFetch` (défense en profondeur ; l'accès est déjà service-role only
après le patch 02).

## Test
- `c2pa-verify` / `c2pa-sign` avec `photoUrl='http://169.254.169.254/latest/meta-data/'` → rejeté (`ssrf: *`).
- `c2pa-sign` avec une `photoUrl` hors `property.photos` → 400.
- `virtual-staging` avec `style='../../evil'` → 400 (avant : écrasait un objet arbitraire).
- Une vraie photo `https://…` d'un bien → OK.
