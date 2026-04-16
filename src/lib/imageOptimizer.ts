/**
 * Cloudflare Images optimizer + C2PA signing
 *
 * Transforme les URLs de photos Supabase Storage en URLs Cloudflare Images.
 * Cloudflare optimise (resize, format WebP/AVIF) ET signe automatiquement
 * avec C2PA Content Credentials (certificat DigiCert) quand le toggle
 * "Preserve Content Credentials" est activé sur la zone.
 *
 * L'URL originale en DB ne change pas — seul le frontend passe par Cloudflare.
 *
 * Prérequis :
 * 1. Activer Transformations dans Cloudflare Dashboard → Images → Transformations
 * 2. Activer "Preserve Content Credentials" dans la même section
 * 3. Domaine megga.ch (ou VITE_SITE_URL) doit pointer vers Cloudflare
 */

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://megga.ch'

// Cloudflare Image Transformations requires a paid plan (Pro+).
// Force-disabled to prevent broken image URLs on the Free plan.
const CF_IMAGES_ENABLED = false

interface ImageOptions {
  width?: number
  height?: number
  quality?: number       // 1-100, défaut 80
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
}

/**
 * Optimise une URL de photo via Cloudflare Images.
 * Si Cloudflare Images n'est pas activé ou si l'URL n'est pas une photo
 * Supabase, retourne l'URL originale.
 *
 * @example
 * optimizeImageUrl('https://eayczugyrvmtqnnmvjod.supabase.co/storage/v1/object/public/property-photos/xxx.jpg', { width: 800 })
 * // → 'https://megga.ch/cdn-cgi/image/width=800,quality=80,format=auto/https://eayczugyrvmtqnnmvjod.supabase.co/...'
 */
export function optimizeImageUrl(url: string, options: ImageOptions = {}): string {
  // Skip si désactivé ou URL vide
  if (!CF_IMAGES_ENABLED || !url) return url

  // Skip les URLs qui sont déjà optimisées
  if (url.includes('/cdn-cgi/image/')) return url

  // Skip les data URIs et les blobs
  if (url.startsWith('data:') || url.startsWith('blob:')) return url

  // Build les paramètres Cloudflare
  const params: string[] = []
  if (options.width) params.push(`width=${options.width}`)
  if (options.height) params.push(`height=${options.height}`)
  params.push(`quality=${options.quality || 80}`)
  params.push(`format=${options.format || 'auto'}`)
  if (options.fit) params.push(`fit=${options.fit}`)

  return `${SITE_URL}/cdn-cgi/image/${params.join(',')}/${url}`
}

/**
 * Presets d'optimisation pour les différents contextes d'affichage.
 */
export const IMAGE_PRESETS = {
  /** Carte listing dans la grille (petite) */
  card: { width: 400, quality: 75, format: 'auto' as const },
  /** Preview panel / galerie (moyenne) */
  preview: { width: 800, quality: 80, format: 'auto' as const },
  /** Fiche bien plein écran (grande) */
  full: { width: 1200, quality: 85, format: 'auto' as const },
  /** Lightbox (très grande) */
  lightbox: { width: 1920, quality: 90, format: 'auto' as const },
  /** Thumbnail (très petite) */
  thumb: { width: 200, quality: 70, format: 'auto' as const },
} as const
