// supabase/functions/_shared/labs.ts
// Le studio Labs — ce que les trois edges (`labs-image`, `labs-video`,
// `labs-video-status`) partagent et qui se teste sans réseau : quotas par plan,
// modèles et endpoints, prompts de garde, enveloppe WAV de la voix off, durées et
// coûts estimés.
//
// ⚠ Module PUR : aucun `Deno.*` au niveau module, aucun import par URL — il est
// importé par `tests/backend/labs-helpers.spec.ts` sous Node.

// ─── Modèles ─────────────────────────────────────────────────────────────────

/** Nano Banana 2 (Gemini 3.1 Flash Image) — le même que `virtual-staging`. */
export const LABS_IMAGE_MODEL = 'gemini-3.1-flash-image-preview'

/** Gemini TTS : voix off d'une vidéo, PCM 16 bits 24 kHz mono en sortie. */
export const LABS_TTS_MODEL = 'gemini-2.5-flash-preview-tts'
export const LABS_TTS_SAMPLE_RATE = 24_000

/**
 * Seedance sur fal.ai. ⚠ « Seedance 4.5 » n'existe pas au 20.09.2026 : la version
 * publique la plus récente est la 2.5 (août 2026, 4–30 s, 480p–1080p, audio natif).
 * Un seul endroit à changer le jour où une version suivante sort.
 */
export const LABS_VIDEO_ENDPOINTS = {
  imageToVideo: 'bytedance/seedance-2.5/image-to-video',
  textToVideo: 'bytedance/seedance-2.5/text-to-video',
} as const

/** Le multiplexage vidéo + voix off, quand la narration remplace l'audio natif. */
export const LABS_MUX_ENDPOINT = 'fal-ai/ffmpeg-api/merge-audio-video'

export const LABS_VOICES = ['Kore', 'Charon', 'Aoede', 'Puck', 'Zephyr', 'Leda'] as const
export type LabsVoice = (typeof LABS_VOICES)[number]
export const LABS_DEFAULT_VOICE: LabsVoice = 'Kore'

/**
 * Les quatre langues du produit. ⛔ Gemini TTS N'A PAS de paramètre de langue — elle
 * se DÉDUIT du texte (relevé dans la doc le 20.09.2026 : « The TTS models detect the
 * input language automatically »). Sur une narration courte, cette déduction se
 * trompe : « Panorama » se lit en italien aussi bien qu'en français. La langue se
 * force donc par une CONSIGNE en tête, écrite DANS la langue cible — c'est le seul
 * levier que l'API expose, et le doubler (consigne + langue de la consigne) est ce
 * qui le rend fiable.
 */
export const LABS_VOICE_LANGS = ['fr', 'de', 'en', 'it'] as const
export type LabsVoiceLang = (typeof LABS_VOICE_LANGS)[number]
export const LABS_DEFAULT_VOICE_LANG: LabsVoiceLang = 'fr'

/** Plafond de l'APERÇU (`labs-voice-preview`) : de quoi entendre la voix, pas d'en faire un studio. */
export const LABS_PREVIEW_MAX_CHARS = 240

export const LABS_IMAGE_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16'] as const
export type LabsImageRatio = (typeof LABS_IMAGE_RATIOS)[number]

export const LABS_VIDEO_RESOLUTIONS = ['720p', '1080p'] as const
export type LabsVideoResolution = (typeof LABS_VIDEO_RESOLUTIONS)[number]

export const LABS_VIDEO_MIN_S = 4
export const LABS_VIDEO_MAX_S = 30
/** Une narration au-delà tient dans aucune vidéo Seedance : refusée AVANT de payer la vidéo. */
export const LABS_VOICEOVER_MAX_CHARS = 600
export const LABS_PROMPT_MAX_CHARS = 1000

// ─── La porte du plan ─────────────────────────────────────────────────────────
// ⚠ Les QUOTAS mensuels par genre (50 images / 10 vidéos sur Pro) ont été REMPLACÉS
// le 20.09.2026 par les CRÉDITS (`_shared/credits.ts`, migration 20260920180000) :
// une seule monnaie, débitée production par production. Ne reste au plan qu'une porte
// binaire — le studio est ouvert à partir de Pro, comme le poste `virtual_staging`
// du catalogue (`src/lib/plans.ts`) le dit depuis toujours.

export const LABS_PLANS_OUVERTS = ['pro', 'entreprise', 'agency'] as const

export function labsOuvertAuPlan(plan: string | null | undefined): boolean {
  return (LABS_PLANS_OUVERTS as readonly string[]).includes((plan ?? 'starter').toLowerCase())
}

/** Début du mois civil courant, en UTC — la dotation de crédits se remet à neuf ce jour-là. */
export function monthStartIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

// ─── Prompts de garde ────────────────────────────────────────────────────────
// Le studio est libre, mais il sert l'immobilier : sans ces règles, une pièce
// « réaménagée » perd un mur et une vidéo montre des visiteurs qui n'existent pas.

const IMAGE_RULES = `RÈGLES STRICTES :
- Architecture inchangée (murs, fenêtres, sol, plafond, perspective, lumière)
- Aucune personne, aucun animal
- Aucun objet flottant ni physiquement impossible
- Pas de texte, watermark, logo ni signature
Génère uniquement l'image résultante, photoréaliste, qualité professionnelle.`

export function labsImagePrompt(userPrompt: string, hasSource: boolean): string {
  const demande = userPrompt.trim()
  if (hasSource) {
    return `Tu es un expert en home staging virtuel pour l'immobilier suisse haut de gamme.
Voici la photo d'un bien. Applique EXACTEMENT cette demande sur le MÊME espace :
${demande}

${IMAGE_RULES}`
  }
  return `Image photoréaliste pour l'immobilier suisse haut de gamme.
${demande}

${IMAGE_RULES}`
}

export function labsVideoPrompt(userPrompt: string, hasVoiceover: boolean): string {
  const demande = userPrompt.trim()
  const audio = hasVoiceover
    ? 'Aucune parole ni musique : la piste sonore est ajoutée ensuite.'
    : 'Ambiance sonore discrète et réaliste, aucune parole.'
  return `${demande}
Mouvement de caméra lent et fluide, cadrage stable, lumière naturelle, rendu photoréaliste.
Aucune personne, aucun animal, aucun texte à l'écran. ${audio}`
}

// ─── Voix off : PCM → WAV ─────────────────────────────────────────────────────

/** Enveloppe RIFF/WAVE autour d'un flux PCM entier signé little-endian. */
export function pcmToWav(pcm: Uint8Array, sampleRate = LABS_TTS_SAMPLE_RATE, channels = 1, bitsPerSample = 16): Uint8Array {
  const blockAlign = (channels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const out = new Uint8Array(44 + pcm.length)
  const dv = new DataView(out.buffer)
  const ascii = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) out[offset + i] = s.charCodeAt(i) }
  ascii(0, 'RIFF')
  dv.setUint32(4, 36 + pcm.length, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true) // PCM
  dv.setUint16(22, channels, true)
  dv.setUint32(24, sampleRate, true)
  dv.setUint32(28, byteRate, true)
  dv.setUint16(32, blockAlign, true)
  dv.setUint16(34, bitsPerSample, true)
  ascii(36, 'data')
  dv.setUint32(40, pcm.length, true)
  out.set(pcm, 44)
  return out
}

export function pcmDurationSeconds(pcmBytes: number, sampleRate = LABS_TTS_SAMPLE_RATE, channels = 1, bitsPerSample = 16): number {
  const byteRate = sampleRate * ((channels * bitsPerSample) / 8)
  return byteRate > 0 ? pcmBytes / byteRate : 0
}

/** Lit le taux d'échantillonnage annoncé par Gemini (`audio/L16;codec=pcm;rate=24000`). */
export function sampleRateFromMime(mime: string | null | undefined): number {
  const m = /rate=(\d+)/.exec(mime ?? '')
  return m ? Number(m[1]) : LABS_TTS_SAMPLE_RATE
}

// ─── Durée et coût ───────────────────────────────────────────────────────────

/**
 * La durée demandée à Seedance, en secondes entières sous forme de chaîne (son
 * schéma : `"4"`…`"30"` ou `"auto"`). Avec une voix off, la vidéo dure la narration
 * plus une seconde de respiration ; sans, la durée choisie, ou 8 s par défaut.
 */
export function labsVideoDuration(voiceoverSeconds: number | null, requestedSeconds: number | null): string {
  const clamp = (s: number) => String(Math.min(LABS_VIDEO_MAX_S, Math.max(LABS_VIDEO_MIN_S, Math.round(s))))
  if (voiceoverSeconds != null && voiceoverSeconds > 0) return clamp(Math.ceil(voiceoverSeconds) + 1)
  if (requestedSeconds != null && Number.isFinite(requestedSeconds)) return clamp(requestedSeconds)
  return '8'
}

/** Taux indicatif ; le coût affiché est une ESTIMATION, jamais une facture. */
export const USD_TO_CHF = 0.9

/**
 * fal.ai facture Seedance 2.5 au jeton : (h × w × s × 24) / 1024 jetons, 0,0214 $ les
 * mille (relevé le 20.09.2026, 720p ≈ 0,46 $/s). L'audio natif est compris.
 */
export function labsVideoCostUsd(resolution: LabsVideoResolution, seconds: number): number {
  const dims = resolution === '1080p' ? [1920, 1080] : [1280, 720]
  const tokens = (dims[0] * dims[1] * seconds * 24) / 1024
  return (tokens / 1000) * 0.0214
}

export function labsVideoCostChf(resolution: LabsVideoResolution, seconds: number, hasVoiceover: boolean): number {
  // La voix off ajoute une synthèse (~0,01 $) et un multiplexage (~0,01 $).
  const usd = labsVideoCostUsd(resolution, seconds) + (hasVoiceover ? 0.02 : 0)
  return Math.round(usd * USD_TO_CHF * 1000) / 1000
}

/** Nano Banana 2 en 2K : 0,101 $ l'image (même relevé que `virtual-staging`). */
export function labsImageCostChf(imageSize: '1K' | '2K'): number {
  const usd = imageSize === '2K' ? 0.101 : 0.067
  return Math.round(usd * USD_TO_CHF * 1000) / 1000
}

// ─── Validation d'entrée ─────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

export function cleanPrompt(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const p = v.replace(/\s+/g, ' ').trim()
  if (p.length < 3 || p.length > LABS_PROMPT_MAX_CHARS) return null
  return p
}

export function cleanVoiceover(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/[ \t]+/g, ' ').trim()
  if (t.length === 0) return null
  if (t.length > LABS_VOICEOVER_MAX_CHARS) return null
  return t
}

export function cleanVoice(v: unknown): LabsVoice {
  return (LABS_VOICES as readonly string[]).includes(String(v)) ? (v as LabsVoice) : LABS_DEFAULT_VOICE
}

export function cleanVoiceLang(v: unknown): LabsVoiceLang {
  return (LABS_VOICE_LANGS as readonly string[]).includes(String(v)) ? (v as LabsVoiceLang) : LABS_DEFAULT_VOICE_LANG
}

/**
 * La consigne de lecture, DANS la langue cible — voir `LABS_VOICE_LANGS`.
 *
 * ⚠ Elle décrit aussi le TON : sans elle, la même voix lit une annonce immobilière
 * comme un bulletin. Le ton est le même dans les quatre langues, c'est la langue de
 * la phrase qui change.
 */
const CONSIGNE: Record<LabsVoiceLang, string> = {
  fr: "Lis ce texte à voix haute en français, d'un ton chaleureux et posé, au rythme d'une visite immobilière :",
  de: 'Lies diesen Text auf Deutsch vor, in einem warmen und ruhigen Ton, im Tempo einer Immobilienbesichtigung:',
  en: 'Read this text aloud in English, in a warm and measured tone, at the pace of a property viewing:',
  it: 'Leggi questo testo ad alta voce in italiano, con tono caldo e pacato, al ritmo di una visita immobiliare:',
}

export function labsVoiceoverPrompt(text: string, lang: LabsVoiceLang): string {
  return `${CONSIGNE[lang]}\n\n${text}`
}

/** Extension de fichier d'une image rendue par Gemini, d'après son type MIME. */
export function imageExtFor(mime: string | null | undefined): { ext: string; contentType: string } {
  const m = (mime ?? '').toLowerCase()
  if (m.includes('png')) return { ext: 'png', contentType: 'image/png' }
  if (m.includes('webp')) return { ext: 'webp', contentType: 'image/webp' }
  return { ext: 'jpg', contentType: 'image/jpeg' }
}

/** Décodage base64 par tranches : `atob` d'un seul bloc tient, `String.fromCharCode(...)` non. */
export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
