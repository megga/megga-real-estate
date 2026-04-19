// ─── Listing photo helpers ──────────────────────────────────────────────────
// Single source of truth for "which URL do I use to render this photo?".
//
// A listing can be in one of two states:
//   - photos_cf populated → Cloudflare R2 variants served from img.megga.ch
//   - photos_cf empty/null → fall back to `photos[]` (Flatfox CDN URLs)
//
// The backfill processes ~150 listings/hour so during the ramp-up period
// (~9 days from migration to 100 %), both states coexist. These helpers
// keep consumer code clean by handling the branch in one place.
//
// Column name kept as `photos_cf` (= "Cloudflare-hosted photos") to avoid a
// rename migration — the backend is R2, but the CF umbrella applies.

export interface CFVariant {
  id: string
  thumb?: string   // 400px JPEG q80 — listing cards
  detail?: string  // 1200px JPEG q85 — listing detail / modal hero
  hero?: string    // 1600px JPEG q90 — fullscreen preview / carousel
  og?: string      // reserved — not generated for R2 variant set
}

type Variant = keyof Omit<CFVariant, 'id'>

/**
 * Return the best URL for a given photo index + variant, with a graceful
 * fallback to the Flatfox URL if CF Images hasn't processed this listing yet.
 *
 * Usage:
 *   <img src={pickPhoto(listing, 0, 'thumb')} />
 */
export function pickPhoto(
  data: { photos_cf?: CFVariant[] | null; photos?: string[] | null },
  index: number,
  variant: Variant = 'detail',
): string | undefined {
  const cf = data.photos_cf?.[index]
  if (cf?.[variant]) return cf[variant]
  // Fallback chain: try a different variant (detail → hero → thumb) in case
  // the requested one is missing. Useful if account variants aren't all set.
  if (cf) {
    if (variant !== 'detail' && cf.detail) return cf.detail
    if (variant !== 'hero' && cf.hero) return cf.hero
    if (variant !== 'thumb' && cf.thumb) return cf.thumb
  }
  return data.photos?.[index] ?? undefined
}

/**
 * Return a responsive `srcset` string for a CF-processed photo, or undefined
 * if we don't have variants (let the browser use plain `src`).
 *
 * Usage:
 *   <img src={pickPhoto(l, 0)} srcSet={pickSrcSet(l, 0)} sizes="(min-width: 640px) 50vw, 100vw" />
 */
export function pickSrcSet(
  data: { photos_cf?: CFVariant[] | null },
  index: number,
): string | undefined {
  const cf = data.photos_cf?.[index]
  if (!cf) return undefined
  const parts: string[] = []
  if (cf.thumb) parts.push(`${cf.thumb} 400w`)
  if (cf.detail) parts.push(`${cf.detail} 1200w`)
  if (cf.hero) parts.push(`${cf.hero} 1600w`)
  return parts.length > 0 ? parts.join(', ') : undefined
}

/**
 * Does this listing have CF Images variants? Useful to branch between
 * `<img>` (CF URL served from edge) and a Flatfox fallback with hints like
 * `referrerPolicy="no-referrer"` to avoid hotlink blocks.
 */
export function hasCFPhotos(data: { photos_cf?: CFVariant[] | null }): boolean {
  return Array.isArray(data.photos_cf) && data.photos_cf.length > 0
}
