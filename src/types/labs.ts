/**
 * Types du studio Labs (`/dashboard/labs`) : dossiers et productions d'une agence.
 * Miroir camelCase des tables `labs_folders` / `labs_assets` (migration 20260920120000).
 */

export type LabsAssetKind = 'image' | 'video' | 'upload'
export type LabsAssetStatus = 'pending' | 'generating' | 'ready' | 'failed'
export type LabsMode = 'image' | 'video'
export type LabsRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16'
export type LabsResolution = '720p' | '1080p'
export type LabsView = 'all' | 'favorites'
export type LabsKindFilter = 'all' | 'image' | 'video'

export interface LabsFolder {
  id: string
  name: string
  sortOrder: number
  createdAt: string
}

export interface LabsAsset {
  id: string
  folderId: string | null
  createdBy: string | null
  kind: LabsAssetKind
  status: LabsAssetStatus
  prompt: string | null
  voiceoverText: string | null
  voiceoverVoice: string | null
  voiceoverLang: string | null
  /** La piste WAV déposée sur R2 — c'est elle que le bouton ▶ de la visionneuse joue. */
  voiceoverUrl: string | null
  sourceAssetId: string | null
  url: string | null
  thumbnailUrl: string | null
  width: number | null
  height: number | null
  durationS: number | null
  aspectRatio: string | null
  model: string | null
  errorCode: string | null
  /**
   * Ce que la production a coûté à l'agence, en CRÉDITS. ⛔ Le coût fournisseur
   * (`cost_chf` en base) n'est PAS porté ici : il ne sort pas vers l'agent.
   */
  credits: number | null
  isFavorite: boolean
  createdAt: string
  completedAt: string | null
}

export interface LabsImageInput {
  prompt: string
  folderId: string | null
  sourceAssetId: string | null
  aspectRatio?: LabsRatio
  imageSize?: '1K' | '2K'
}

export interface LabsVideoInput {
  prompt: string
  folderId: string | null
  sourceAssetId: string | null
  voiceoverText: string | null
  voiceName: string
  voiceLang: string
  durationS: number
  resolution: LabsResolution
}

/** Ce que rend un appel d'edge du studio : le motif du serveur, jamais « non-2xx ». */
export interface LabsInvokeResult<T> {
  data: T | null
  error: string | null
  status: number
  /** Les champs annexes du corps d'erreur (`usage`, `quota`…). */
  extra: Record<string, unknown>
}
