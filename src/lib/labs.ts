/**
 * Le studio Labs, côté navigateur : constantes, estimations et lectures pures.
 *
 * ⚠ Les QUOTAS et les FORMULES DE COÛT sont le miroir de
 * `supabase/functions/_shared/labs.ts` — c'est l'edge qui applique, l'écran ne fait
 * qu'annoncer. Un écart entre les deux ferait promettre une génération que le
 * serveur refuse (ou l'inverse) ; `tests/unit/labs-studio.spec.ts` compare les deux.
 */
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type {
  LabsAsset, LabsAssetKind, LabsFolder, LabsInvokeResult, LabsKindFilter, LabsMode, LabsRatio, LabsResolution, LabsView,
} from '@/types/labs'

// ─── Constantes (miroir de l'edge) ───────────────────────────────────────────

export const LABS_QUOTAS: Record<'image' | 'video', Record<string, number>> = {
  image: { starter: 0, pro: 50, entreprise: 200, agency: 200 },
  video: { starter: 0, pro: 10, entreprise: 40, agency: 40 },
}

export function labsQuotaFor(plan: string | null | undefined, kind: 'image' | 'video'): number {
  return LABS_QUOTAS[kind][(plan ?? 'starter').toLowerCase()] ?? 0
}

export const LABS_VOICES = ['Kore', 'Charon', 'Aoede', 'Puck', 'Zephyr', 'Leda'] as const
export type LabsVoice = (typeof LABS_VOICES)[number]
export const LABS_DEFAULT_VOICE: LabsVoice = 'Kore'

/** Les quatre langues du produit — la voix off se lit dans celle qu'on choisit. */
export const LABS_VOICE_LANGS = ['fr', 'de', 'en', 'it'] as const
export type LabsVoiceLang = (typeof LABS_VOICE_LANGS)[number]
export const LABS_DEFAULT_VOICE_LANG: LabsVoiceLang = 'fr'
export const LABS_PREVIEW_MAX_CHARS = 240
export const LABS_VOICEOVER_MAX_CHARS = 600
export const LABS_PROMPT_MAX_CHARS = 1000
export const LABS_VIDEO_MIN_S = 4
export const LABS_VIDEO_MAX_S = 30
export const LABS_VIDEO_DURATIONS = [5, 8, 10, 15, 20, 30] as const
export const LABS_IMAGE_RATIOS: LabsRatio[] = ['1:1', '3:4', '4:3', '16:9', '9:16']
export const LABS_VIDEO_RESOLUTIONS: LabsResolution[] = ['720p', '1080p']
export const USD_TO_CHF = 0.9

export const LABS_STORAGE_BUCKET = 'labs'
export const LABS_UPLOAD_MAX_BYTES = 20 * 1024 * 1024
export const LABS_UPLOAD_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const

// ─── Lignes → objets ─────────────────────────────────────────────────────────

type FolderRow = Database['public']['Tables']['labs_folders']['Row']
type AssetRow = Database['public']['Tables']['labs_assets']['Row']

export function labsFolderFromRow(r: FolderRow): LabsFolder {
  return { id: r.id, name: r.name, sortOrder: r.sort_order, createdAt: r.created_at }
}

export function labsAssetFromRow(r: AssetRow): LabsAsset {
  return {
    id: r.id,
    folderId: r.folder_id,
    createdBy: r.created_by,
    kind: r.kind as LabsAssetKind,
    status: r.status as LabsAsset['status'],
    prompt: r.prompt,
    voiceoverText: r.voiceover_text,
    voiceoverVoice: r.voiceover_voice,
    voiceoverLang: r.voiceover_lang,
    voiceoverUrl: r.voiceover_url,
    sourceAssetId: r.source_asset_id,
    url: r.url,
    thumbnailUrl: r.thumbnail_url,
    width: r.width,
    height: r.height,
    durationS: r.duration_s == null ? null : Number(r.duration_s),
    aspectRatio: r.aspect_ratio,
    model: r.model,
    errorCode: r.error_code,
    costChf: r.cost_chf == null ? null : Number(r.cost_chf),
    isFavorite: r.is_favorite,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  }
}

// ─── Estimations ─────────────────────────────────────────────────────────────

/** ~155 mots par minute en français lu posément. */
export function labsVoiceoverSeconds(text: string): number {
  const mots = text.trim().split(/\s+/).filter(Boolean).length
  return mots === 0 ? 0 : mots / 2.6
}

/** La durée que l'edge demandera : la narration + 1 s, sinon la durée choisie — bornée 4–30. */
export function labsVideoDurationS(voiceoverSeconds: number | null, chosenS: number): number {
  const clamp = (s: number) => Math.min(LABS_VIDEO_MAX_S, Math.max(LABS_VIDEO_MIN_S, Math.round(s)))
  if (voiceoverSeconds != null && voiceoverSeconds > 0) return clamp(Math.ceil(voiceoverSeconds) + 1)
  return clamp(chosenS)
}

export function labsVideoCostUsd(resolution: LabsResolution, seconds: number): number {
  const dims = resolution === '1080p' ? [1920, 1080] : [1280, 720]
  const tokens = (dims[0] * dims[1] * seconds * 24) / 1024
  return (tokens / 1000) * 0.0214
}

export function labsEstimateChf(p: { mode: LabsMode; resolution: LabsResolution; durationS: number; hasVoiceover: boolean }): number {
  if (p.mode === 'image') return Math.round(0.101 * USD_TO_CHF * 1000) / 1000
  const usd = labsVideoCostUsd(p.resolution, p.durationS) + (p.hasVoiceover ? 0.02 : 0)
  return Math.round(usd * USD_TO_CHF * 100) / 100
}

/** Format d'affichage suisse d'un petit montant : `0.09`, `4.20`. */
export function labsChf(n: number): string {
  return n < 1 ? n.toFixed(2) : n.toFixed(2)
}

// ─── Géométrie de la galerie ─────────────────────────────────────────────────

export function labsRatioPercent(ratio: string | null | undefined): number {
  if (!ratio || !ratio.includes(':')) return 100
  const [w, h] = ratio.split(':').map(Number)
  if (!w || !h) return 100
  return Math.round((h / w) * 100)
}

/** Hauteur relative d'une vignette (padding-bottom en %), d'après ce qu'on sait de l'image. */
export function labsAssetRatioPercent(a: LabsAsset): number {
  if (a.width && a.height) return Math.round((a.height / a.width) * 100)
  if (a.aspectRatio) return labsRatioPercent(a.aspectRatio)
  return a.kind === 'video' ? 56 : 100
}

/**
 * Répartit les productions en `cols` colonnes de hauteurs ÉQUILIBRÉES.
 *
 * ⛔ POURQUOI PAS `column-count`. Le CSS multi-colonnes remplit en FLUX : il coupe la
 * suite d'éléments en tranches et sert la dernière colonne avec ce qui reste. Mesuré
 * le 20.09.2026 à 1440 × 900 sur huit productions — colonnes à 527, 532, 493 et
 * **282 px** : la quatrième à moitié vide, 250 px d'écart. Ici chaque tuile part dans
 * la colonne la plus COURTE, ce qui est l'idiome masonry et remplit le cadre.
 *
 * ⚠ La hauteur se compte en RATIO (hauteur ÷ largeur), pas en pixels : la largeur
 * d'une colonne n'est pas connue ici, et elle est la même pour toutes — la comparaison
 * est donc exacte sans elle.
 *
 * ⚠ Déterministe : à liste égale et `cols` égal, le placement ne bouge pas. Sans quoi
 * la grille sauterait à chaque rendu.
 */
export function labsColonnes(assets: LabsAsset[], cols: number): LabsAsset[][] {
  const n = Math.max(1, Math.floor(cols))
  const colonnes: LabsAsset[][] = Array.from({ length: n }, () => [])
  const hauteurs = new Array<number>(n).fill(0)
  for (const a of assets) {
    // `indexOf(min)` rend la PREMIÈRE colonne la plus courte : à égalité, on remplit
    // de gauche à droite, ce qui est l'ordre de lecture.
    let i = 0
    for (let k = 1; k < n; k++) if (hauteurs[k] < hauteurs[i]) i = k
    colonnes[i].push(a)
    hauteurs[i] += labsAssetRatioPercent(a) / 100
  }
  return colonnes
}

// ─── Filtres et compteurs ────────────────────────────────────────────────────

export function labsFilter(
  assets: LabsAsset[],
  f: { folderId: string | null; view: LabsView; kind: LabsKindFilter },
): LabsAsset[] {
  return assets.filter((a) => {
    if (f.view === 'favorites' && !a.isFavorite) return false
    if (f.view !== 'favorites' && f.folderId && a.folderId !== f.folderId) return false
    if (f.kind === 'image' && a.kind === 'video') return false
    if (f.kind === 'video' && a.kind !== 'video') return false
    return true
  })
}

export function labsMonthUsage(assets: LabsAsset[], now: Date = new Date()): { image: number; video: number } {
  const debut = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const out = { image: 0, video: 0 }
  for (const a of assets) {
    if (a.status === 'failed' || a.kind === 'upload') continue
    if (new Date(a.createdAt).getTime() < debut) continue
    out[a.kind === 'video' ? 'video' : 'image'] += 1
  }
  return out
}

export function labsCountByFolder(assets: LabsAsset[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of assets) if (a.folderId) out[a.folderId] = (out[a.folderId] ?? 0) + 1
  return out
}

// ─── Imports ─────────────────────────────────────────────────────────────────

export function labsFileExt(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function labsUploadPath(agencyId: string, mime: string, id: string): string {
  return `${agencyId}/${id}.${labsFileExt(mime)}`
}

export function labsUploadProblem(file: { type: string; size: number }): 'upload_type' | 'upload_size' | null {
  if (!(LABS_UPLOAD_MIMES as readonly string[]).includes(file.type)) return 'upload_type'
  if (file.size > LABS_UPLOAD_MAX_BYTES) return 'upload_size'
  return null
}

/** Nom de fichier proposé au téléchargement. */
export function labsDownloadName(a: LabsAsset): string {
  const base = (a.prompt ?? a.kind).toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 48) || a.kind
  const ext = a.kind === 'video' ? 'mp4' : (a.url?.split('.').pop()?.split('?')[0] ?? 'jpg')
  return `megga-labs-${base}.${ext}`
}

// ─── Temps relatif ───────────────────────────────────────────────────────────

export function labsRelativeTime(iso: string, lang: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime()
  if (Number.isNaN(diffMs)) return ''
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  const min = Math.round(diffMs / 60_000)
  if (Math.abs(min) < 60) return rtf.format(min, 'minute')
  const h = Math.round(min / 60)
  if (Math.abs(h) < 24) return rtf.format(h, 'hour')
  const d = Math.round(h / 24)
  if (Math.abs(d) < 30) return rtf.format(d, 'day')
  return new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Appel des edges ─────────────────────────────────────────────────────────

export type LabsEdge = 'labs-image' | 'labs-video' | 'labs-video-status' | 'labs-voice-preview'

/** Appelle une edge du studio et rend le motif du serveur, jamais « non-2xx » (cf. `invokeMail`). */
export async function invokeLabs<T = Record<string, unknown>>(name: LabsEdge, body: Record<string, unknown>): Promise<LabsInvokeResult<T>> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (!error) return { data: data ?? null, error: null, status: 200, extra: {} }
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status ?? 500
    try {
      const j = (await error.context.json()) as { error?: string } & Record<string, unknown>
      const { error: code, ...extra } = j
      return { data: null, error: code ?? `http_${status}`, status, extra }
    } catch {
      return { data: null, error: `http_${status}`, status, extra: {} }
    }
  }
  return { data: null, error: 'network', status: 0, extra: {} }
}
