/**
 * Le studio Labs, côté navigateur : constantes, estimations et lectures pures.
 *
 * ⚠ Les CONSTANTES de génération (voix, langues, durées, ratios) sont le miroir de
 * `supabase/functions/_shared/labs.ts` — c'est l'edge qui applique, l'écran ne fait
 * qu'annoncer ; `tests/unit/labs-studio.spec.ts` compare les deux.
 *
 * ⛔ PLUS AUCUN COÛT ICI DEPUIS LE 20.09.2026. Le prix d'une production se dit en
 * CRÉDITS (`src/lib/credits.ts`), et le coût fournisseur — dollars de fal.ai et de
 * Google, taux de change, marge — vit côté serveur seulement. Ce fichier portait les
 * formules de coût et le taux de change : ils rendaient à l'agent, dans le bundle
 * public, exactement ce que MEGGA paie. Retirés, et gardés par
 * `credits-confidentialite.spec.ts` — qui a d'abord pris CE commentaire sur le fait,
 * parce qu'il nommait les identifiants qu'elle interdit.
 */
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { creditsPourImage, creditsPourVideo } from '@/lib/credits'
import type {
  LabsAsset, LabsAssetKind, LabsFolder, LabsInvokeResult, LabsKindFilter, LabsMode, LabsRatio, LabsResolution, LabsView,
} from '@/types/labs'

// ─── Constantes (miroir de l'edge) ───────────────────────────────────────────

/**
 * Les plans qui OUVRENT le studio (miroir de `LABS_PLANS_OUVERTS`, edge). ⚠ Ce n'est
 * plus un quota : les 50 images / 10 vidéos par mois de Pro ont été remplacés par une
 * dotation de crédits (`credits_plan_allowances`), débitée production par production.
 */
export const LABS_PLANS_OUVERTS = ['pro', 'entreprise', 'agency'] as const

export function labsOuvertAuPlan(plan: string | null | undefined): boolean {
  return (LABS_PLANS_OUVERTS as readonly string[]).includes((plan ?? 'starter').toLowerCase())
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

export const LABS_STORAGE_BUCKET = 'labs'
export const LABS_UPLOAD_MAX_BYTES = 20 * 1024 * 1024
export const LABS_UPLOAD_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const

// ─── Lignes → objets ─────────────────────────────────────────────────────────

type FolderRow = Database['public']['Tables']['labs_folders']['Row']
type AssetRow = Database['public']['Tables']['labs_assets']['Row']

/**
 * Les colonnes de `labs_assets` que l'écran LIT. ⛔ Ni `cost_chf` ni `finalizing_until` :
 * la base les refuse à `authenticated` (migration 20260922100400) — le coût fournisseur
 * posé à côté du prix en crédits donnait la marge. Un `select('*')` y répondrait 42501.
 */
export const LABS_ASSET_COLONNES =
  'id, agency_id, folder_id, created_by, kind, status, prompt, voiceover_text, voiceover_voice, voiceover_lang, voiceover_url, source_asset_id, url, thumbnail_url, width, height, duration_s, aspect_ratio, model, error_code, credits, is_favorite, created_at, completed_at' as const

/** Une production telle que l'agent la reçoit : de la liste (`LABS_ASSET_COLONNES`) ou d'une edge. */
export type LabsAssetRow = Pick<AssetRow,
  | 'id' | 'agency_id' | 'folder_id' | 'created_by' | 'kind' | 'status' | 'prompt' | 'voiceover_text'
  | 'voiceover_voice' | 'voiceover_lang' | 'voiceover_url' | 'source_asset_id' | 'url' | 'thumbnail_url'
  | 'width' | 'height' | 'duration_s' | 'aspect_ratio' | 'model' | 'error_code' | 'credits' | 'is_favorite'
  | 'created_at' | 'completed_at'>

export function labsFolderFromRow(r: FolderRow): LabsFolder {
  return { id: r.id, name: r.name, sortOrder: r.sort_order, createdAt: r.created_at }
}

export function labsAssetFromRow(r: LabsAssetRow): LabsAsset {
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
    credits: r.credits ?? null,
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

/** Ce qu'une production va COÛTER en crédits, avant de générer — le tarif de `credits.ts`. */
export function labsEstimateCredits(p: { mode: LabsMode; resolution: LabsResolution; durationS: number; hasVoiceover: boolean; imageSize?: '1K' | '2K' }): number {
  if (p.mode === 'image') return creditsPourImage(p.imageSize ?? '2K')
  return creditsPourVideo(p.resolution, p.durationS, p.hasVoiceover)
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
  f: { folderId: string | null; view: LabsView; kind: LabsKindFilter; q?: string },
): LabsAsset[] {
  const q = labsNormaliser(f.q ?? '')
  return assets.filter((a) => {
    if (f.view === 'favorites' && !a.isFavorite) return false
    if (f.view !== 'favorites' && f.folderId && a.folderId !== f.folderId) return false
    if (f.kind === 'image' && a.kind === 'video') return false
    if (f.kind === 'video' && a.kind !== 'video') return false
    if (q && !labsCorrespond(a, q)) return false
    return true
  })
}

/**
 * Minuscules SANS accents : on cherche « decoree » et on trouve « décorée ».
 * Un agent tape sans accent quand il cherche vite, et la moitié de ses prompts en
 * portent — sans ce pliage la recherche rendrait vide sur un mot qui est à l'écran.
 */
export function labsNormaliser(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/**
 * Une production répond à la recherche si TOUS les mots tapés se trouvent dans son
 * texte — prompt et voix off réunis. L'ET (et non le OU) est ce qui fait qu'ajouter un
 * mot RESSERRE la liste : c'est ce que fait un agent qui n'a pas trouvé du premier coup.
 *
 * ⚠ Le texte est tout ce qu'on a : une photo importée n'a ni prompt ni narration, et
 * reste donc introuvable par mot. C'est le dossier qui la retrouve, pas la recherche.
 *
 * ⛔ ELLE PLIE SA PROPRE REQUÊTE, et ne fait pas confiance à l'appelant. Le pliage est
 * idempotent, donc le repasser coûte un parcours de chaîne ; l'oublier rend une liste
 * VIDE sur un mot tapé en majuscules — sans erreur, sans trace, et l'agent en conclut
 * que sa production a disparu. Une fonction dont la justesse dépend d'un geste du site
 * d'appel finit toujours par être appelée sans lui : c'est une garde qui l'a prise sur
 * le fait, le 20.09.2026, le jour même où elle a été écrite.
 */
export function labsCorrespond(a: LabsAsset, requete: string): boolean {
  const mots = labsNormaliser(requete).split(/\s+/).filter(Boolean)
  if (mots.length === 0) return true
  const foin = labsNormaliser(`${a.prompt ?? ''} ${a.voiceoverText ?? ''}`)
  return mots.every((m) => foin.includes(m))
}

// ─── Sélection multiple ─────────────────────────────────────────────

/**
 * La plage Maj+clic, prise dans l'ordre de la LISTE (chronologique) et non dans
 * l'ordre visuel des colonnes.
 *
 * ⚠ C'est un choix, pas un raccourci d'implémentation : `labsColonnes` répartit les
 * tuiles dans la colonne la plus courte, donc la voisine VISUELLE d'une tuile n'est
 * presque jamais sa voisine dans la liste. Une plage « visuelle » devrait donc suivre
 * un serpentin que rien n'affiche. La liste, elle, est l'ordre que la visionneuse
 * parcourt avec ← → — le seul ordre que l'agent ait déjà vu nommé quelque part.
 */
export function labsPlage(ordre: string[], deId: string, aId: string): string[] {
  const i = ordre.indexOf(deId)
  const j = ordre.indexOf(aId)
  if (i < 0 || j < 0) return j < 0 ? [] : [aId]
  return ordre.slice(Math.min(i, j), Math.max(i, j) + 1)
}

/** Ce que la barre de gestes peut proposer, lu sur la sélection elle-même. */
export function labsSelectionEtat(assets: LabsAsset[], ids: Set<string>): {
  total: number
  telechargeables: number
  /** Vrai quand TOUTES portent l'étoile : le geste devient « retirer ». */
  toutesFavorites: boolean
} {
  let total = 0
  let telechargeables = 0
  let favorites = 0
  for (const a of assets) {
    if (!ids.has(a.id)) continue
    total += 1
    if (a.url) telechargeables += 1
    if (a.isFavorite) favorites += 1
  }
  return { total, telechargeables, toutesFavorites: total > 0 && favorites === total }
}

export function labsCountByFolder(assets: LabsAsset[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of assets) if (a.folderId) out[a.folderId] = (out[a.folderId] ?? 0) + 1
  return out
}

// ─── Tuiles LOCALES (variations en vol) ────────────────────────────────

export const LABS_LOCAL_PREFIX = 'local:'

/**
 * Une tuile d'attente, posée dans la galerie AVANT que l'edge réponde.
 *
 * ⛔ CE QU'ELLE RÉPARE. `labs-image` est SYNCHRONE : l'edge rend l'image finie, dix à
 * quinze secondes plus tard. Jusqu'ici rien ne bougeait dans la galerie pendant ce
 * temps — seul le bouton tournait, en bas de l'écran, là où l'agent ne regarde plus
 * une fois qu'il a cliqué. Quinze secondes sans signe, c'est un clic de plus.
 *
 * ⚠ Elle vit dans l'ÉTAT DE L'ÉCRAN, jamais dans le cache React Query : le temps réel
 * invalide la liste à chaque vidéo qui aboutit, et un refetch balaierait une ligne que
 * le serveur ne connaît pas. Deux sources, deux durées de vie.
 *
 * ⚠ Son id porte un préfixe RECONNAISSABLE : la galerie s'en sert pour ne l'offrir ni
 * à la case à cocher ni à la visionneuse — on ne range pas ce qui n'existe pas encore.
 */
export function labsTuileLocale(p: { ratio: LabsRatio | null; prompt: string; folderId: string | null; n: number }): LabsAsset {
  return {
    id: `${LABS_LOCAL_PREFIX}${p.n}-${Date.now()}`,
    folderId: p.folderId,
    createdBy: null,
    kind: 'image',
    status: 'pending',
    prompt: p.prompt,
    voiceoverText: null, voiceoverVoice: null, voiceoverLang: null, voiceoverUrl: null,
    sourceAssetId: null, url: null, thumbnailUrl: null,
    width: null, height: null, durationS: null,
    aspectRatio: p.ratio,
    model: null, errorCode: null, credits: null,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  }
}

export function labsEstLocale(id: string): boolean {
  return id.startsWith(LABS_LOCAL_PREFIX)
}

// ─── Home staging — le vocabulaire du produit ───────────────────────────

/**
 * ⚠ CE VOCABULAIRE EST CELUI DE LA FICHE BIEN, PAS UN SECOND.
 * `useVirtualStaging` porte déjà les cinq styles et les pièces du panneau « MEGGA
 * Staging » de `ListingFormPage` — les redire autrement ici donnerait à l'agent deux
 * listes de styles pour un seul produit, avec des noms qui dérivent. `labs-staging.spec.ts`
 * confronte les deux jeux.
 *
 * ⛔ Une exception, écrite : `autre` existe dans la fiche (il faut bien un fourre-tout
 * quand on TRIE une photo) mais pas ici — un préréglage nommé « autre » ne compose
 * aucune phrase utile. Ici on ÉCRIT une consigne, on ne classe pas.
 */
export const LABS_STAGING_ROOMS = [
  'salon', 'chambre', 'cuisine', 'salle_a_manger', 'bureau', 'terrasse', 'jardin', 'balcon',
] as const
export type LabsStagingRoom = (typeof LABS_STAGING_ROOMS)[number]

export const LABS_STAGING_STYLES = ['modern', 'classic', 'luxury', 'scandinavian', 'minimal'] as const
export type LabsStagingStyle = (typeof LABS_STAGING_STYLES)[number]

export const LABS_STAGING_DEFAULT_ROOM: LabsStagingRoom = 'salon'
export const LABS_STAGING_DEFAULT_STYLE: LabsStagingStyle = 'modern'

/**
 * La consigne de staging, écrite EN CLAIR dans la barre de prompt.
 *
 * ⛔ Le préréglage n'est pas un prompt caché : il ÉCRIT dans la zone de texte, que
 * l'agent relit et retouche avant d'envoyer. Un préréglage invisible rendrait le
 * résultat inexplicable (« pourquoi cette lampe ? ») et non réparable — or c'est
 * exactement ce que l'agent doit pouvoir corriger d'un mot. C'est aussi ce qui lui
 * APPREND à écrire ses propres consignes : au bout de dix staging, il tape les siennes.
 *
 * ⚠ Deux phrases, pas huit : le préréglage exige TOUJOURS une pièce ET un style (les
 * deux ont un défaut), donc seule la présence d'une photo source change la phrase —
 * meubler une photo existante et composer une scène de rien ne se demandent pas pareil.
 * Huit variantes pour « style seul » / « pièce seule » seraient huit textes à tenir dans
 * quatre langues, pour un gain nul.
 *
 * `traduire` est injecté (le `t` de i18next) : la consigne part dans la langue de
 * l'agent, la seule qu'il puisse relire. Les modèles lisent les quatre.
 */
export function labsStagingPrompt(
  traduire: (cle: string, params?: Record<string, string>) => string,
  room: LabsStagingRoom,
  style: LabsStagingStyle,
  hasSource: boolean,
): string {
  return traduire(hasSource ? 'staging.promptSource' : 'staging.promptScratch', {
    room: traduire(`staging.rooms.${room}`),
    style: traduire(`staging.styles.${style}`),
    hint: traduire(`staging.hints.${style}`),
  }).trim()
}

// ─── Variations ──────────────────────────────────────────────────

/**
 * Le nombre d'images lancées d'un seul « Générer ».
 *
 * ⚠ Pourquoi pas de variations en VIDÉO : une image vaut 5 crédits — quatre d'un coup
 * en coûtent 20 et se jugent d'un regard. Une vidéo de 8 s en 720p en vaut 144 : quatre
 * d'un coup, c'est près de 40 % de la dotation mensuelle Pro en un clic. Le geste est
 * le même, l'enjeu ne l'est pas.
 *
 * ⚠ Le plafond à 4 n'est pas décoratif : au-delà la mosaïque déborde d'une rangée et
 * la dotation du mois part en deux clics distraits.
 */
export const LABS_VARIATIONS = [1, 2, 4] as const
export type LabsVariations = (typeof LABS_VARIATIONS)[number]

/**
 * Combien de variations le SOLDE laisse partir — bornée au nombre demandé.
 *
 * ⚠ L'écran ne fait qu'ANNONCER : c'est l'edge qui débite, une par une, et refuse ce
 * que le solde ne couvre pas. Ce calcul sert à ne pas lancer quatre appels quand il
 * n'y a de quoi en payer qu'un — trois refus coûtent trois allers-retours et trois
 * messages d'erreur pour rien. Un solde INCONNU (`null`, le solde n'est pas encore
 * lu) laisse tout partir : l'edge tranchera, et il le dit clairement.
 */
export function labsVariationsPossibles(demande: number, solde: number | null, coutUnitaire: number): number {
  if (solde == null || coutUnitaire <= 0) return demande
  return Math.max(0, Math.min(demande, Math.floor(solde / coutUnitaire)))
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
