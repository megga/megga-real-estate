// supabase/functions/_shared/photo-vision.ts
// Gemini Vision wrapper qui classe une photo immobilière (type de pièce +
// scores qualité + flags). Partagé entre `photo-labeler` (bulk au moment de
// l'upload) et `virtual-staging` (gate pré-staging sur 1 photo).
//
// Returns: { room, confidence, quality{...}, flags }
// On garde le shape stable car `photo-labeler` est consommé par le frontend.
//
// VISION = Gemini (décision Gregory, 2 juin 2026 ; DeepSeek n'a pas de vision).

import { readDocument } from './vision.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || ''

export const ROOM_TYPES = [
  'salon', 'cuisine', 'chambre', 'salle_de_bain', 'bureau',
  'entree', 'terrasse', 'garage', 'exterieur', 'autre',
] as const

export type RoomType = typeof ROOM_TYPES[number]

export interface PhotoQuality {
  sharpness: number
  lighting: number
  composition: number
  overall: number
}

export interface PhotoAnalysis {
  room: RoomType
  confidence: number
  quality: PhotoQuality
  flags: string[]
  error?: string
}

const SYSTEM_PROMPT = `Tu es un expert immobilier suisse. Pour chaque photo immobilière, tu dois:

1. IDENTIFIER le type de pièce parmi: ${ROOM_TYPES.join(', ')}
2. ÉVALUER la qualité photographique (0-100) sur 4 critères:
   - sharpness: netteté de l'image (0-100)
   - lighting: qualité de l'éclairage (0-100)
   - composition: cadrage et composition (0-100)
   - overall: score global (0-100)
3. DÉTECTER les problèmes: "blur", "overexposed", "underexposed", "low_res", "dark", "tilted", "person_detected", "already_furnished"

Réponds UNIQUEMENT en JSON valide, sans markdown:
{
  "room": "salon",
  "confidence": 0.95,
  "quality": {
    "sharpness": 85,
    "lighting": 90,
    "composition": 80,
    "overall": 85
  },
  "flags": []
}`

function clampQuality(q: Partial<PhotoQuality> | undefined): PhotoQuality {
  const cl = (v: unknown) => Math.min(100, Math.max(0, Number(v) || 50))
  return {
    sharpness: cl(q?.sharpness),
    lighting: cl(q?.lighting),
    composition: cl(q?.composition),
    overall: cl(q?.overall),
  }
}

const FAILED_ANALYSIS: PhotoAnalysis = {
  room: 'autre',
  confidence: 0,
  quality: { sharpness: 0, lighting: 0, composition: 0, overall: 0 },
  flags: ['load_error'],
}

/**
 * Analyse une photo via Gemini Vision.
 * Ne throw jamais — toute erreur est encodée dans le retour (room=autre + flag).
 */
export async function analyzePhoto(photoUrl: string): Promise<PhotoAnalysis> {
  if (!GEMINI_API_KEY) {
    return { ...FAILED_ANALYSIS, flags: ['api_key_missing'], error: 'GEMINI_API_KEY missing' }
  }

  try {
    const imgResp = await fetch(photoUrl)
    if (!imgResp.ok) {
      return { ...FAILED_ANALYSIS, error: `fetch failed: HTTP ${imgResp.status}` }
    }

    const imgBytes = new Uint8Array(await imgResp.arrayBuffer())
    const contentType = imgResp.headers.get('content-type') || 'image/jpeg'

    // Gemini Vision en JSON strict — même prompt et même contrat de sortie que l'ancien Claude.
    const res = await readDocument(imgBytes, contentType, GEMINI_API_KEY, { prompt: SYSTEM_PROMPT, json: true })
    if (!res.ok) {
      return {
        ...FAILED_ANALYSIS,
        quality: clampQuality(undefined),
        flags: ['api_error'],
        error: res.error ?? 'gemini_error',
      }
    }

    const parsed = JSON.parse(res.text)

    return {
      room: (ROOM_TYPES as readonly string[]).includes(parsed.room) ? parsed.room : 'autre',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      quality: clampQuality(parsed.quality),
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
    }
  } catch (err) {
    return {
      ...FAILED_ANALYSIS,
      quality: clampQuality(undefined),
      flags: ['parse_error'],
      error: String(err),
    }
  }
}

/**
 * Verdict humain-lisible pour le gate virtual-staging.
 *
 *   - 'ok'                 : photo valide pour le staging
 *   - 'mismatch_room_type' : type détecté ≠ type demandé (confidence haute)
 *   - 'low_quality'        : overall < 50 ou flag critique
 *   - 'person_detected'    : présence humaine — LPD/refus
 *   - 'already_furnished'  : pas grand-chose à stager
 *   - 'load_error'         : Vision n'a pas pu analyser
 *
 * `mismatch_confidence_threshold` est volontairement haut (0.85) pour ne pas
 * bloquer sur des doutes — le frontend peut downgrader en warning si besoin.
 */
export type Verdict =
  | 'ok'
  | 'mismatch_room_type'
  | 'low_quality'
  | 'person_detected'
  | 'already_furnished'
  | 'load_error'

export interface VerdictResult {
  verdict: Verdict
  analysis: PhotoAnalysis
  reason?: string
}

const CRITICAL_FLAGS = ['blur', 'low_res', 'dark', 'overexposed']
const QUALITY_FLOOR = 50

export function judgePhotoForStaging(
  analysis: PhotoAnalysis,
  requestedRoomType: RoomType,
  { mismatchConfidenceThreshold = 0.85 } = {},
): VerdictResult {
  if (analysis.flags.includes('load_error') || analysis.flags.includes('parse_error')) {
    return { verdict: 'load_error', analysis, reason: analysis.error }
  }

  if (analysis.flags.includes('person_detected')) {
    return { verdict: 'person_detected', analysis, reason: 'Personne identifiée — refus LPD' }
  }

  if (analysis.flags.includes('already_furnished')) {
    return { verdict: 'already_furnished', analysis, reason: 'La pièce est déjà entièrement meublée' }
  }

  // Mismatch room type — only block when Vision is sufficiently confident.
  // `autre` is permissive both ways (catches "shrugs").
  if (
    requestedRoomType !== 'autre' &&
    analysis.room !== 'autre' &&
    analysis.room !== requestedRoomType &&
    analysis.confidence >= mismatchConfidenceThreshold
  ) {
    return {
      verdict: 'mismatch_room_type',
      analysis,
      reason: `Type détecté: ${analysis.room} (${Math.round(analysis.confidence * 100)}%) ≠ demandé: ${requestedRoomType}`,
    }
  }

  const overall = analysis.quality.overall
  const criticalFlag = analysis.flags.find((f) => CRITICAL_FLAGS.includes(f))
  if (overall < QUALITY_FLOOR || criticalFlag) {
    return {
      verdict: 'low_quality',
      analysis,
      reason: criticalFlag
        ? `Qualité insuffisante (flag: ${criticalFlag})`
        : `Score qualité ${overall}/100 trop bas (seuil ${QUALITY_FLOOR})`,
    }
  }

  return { verdict: 'ok', analysis }
}
