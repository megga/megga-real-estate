// Lecture de document/image (vision/OCR) via Gemini. Primitive `read_document`
// derrière une interface simple (provider swappable : la signature ne dépend pas
// de Gemini). Clé en PARAMÈTRE (pas de Deno.env) → importable et testable.
//
// DÉCISION (Gregory, 2 juin 2026) : TEXTE/compréhension = DeepSeek ; VISION/OCR = Gemini.
// DeepSeek n'a pas de vision sur son API hébergée. Modèle par défaut : gemini-2.5-flash-lite.

export interface DocReadResult { ok: boolean; text: string; error?: string }

const DEFAULT_MODEL = 'gemini-2.5-flash-lite'
// Gemini Vision lit images + PDF. Les autres types de documents sont ignorés.
const SUPPORTED_MIME = /^(image\/(png|jpe?g|webp|heic|heif|gif)|application\/pdf)$/i
const DEFAULT_PROMPT =
  "Tu es un OCR fidèle. Restitue TOUT le texte lisible de ce document ou de cette image, " +
  "en conservant la structure (titres, lignes, montants, dates). N'invente rien : si un " +
  "passage est illisible, écris [illisible]. Réponds uniquement par le contenu extrait, sans commentaire."

/** Vrai si Gemini Vision sait lire ce type de fichier (image ou PDF). */
export function isReadableDocMime(mime: string | null | undefined): boolean {
  return !!mime && SUPPORTED_MIME.test(mime)
}

/** Encode des octets en base64 sans exploser la pile (chunké, pour les gros fichiers). */
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Lit la réponse Gemini generateContent → texte concaténé des parts. Repli vide. */
export function parseGemini(json: unknown): string {
  const parts = (json as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((p) => p?.text ?? '').join('').trim()
}

/** Appel Gemini Vision sur les octets bruts d'une image/PDF. Clé en paramètre.
 *  Ne lève jamais : renvoie { ok:false, error } en cas de souci (mime non géré, HTTP, réseau). */
export async function readDocument(
  bytes: Uint8Array,
  mime: string | null,
  apiKey: string,
  opts?: { model?: string; prompt?: string },
): Promise<DocReadResult> {
  if (!apiKey) return { ok: false, text: '', error: 'no_api_key' }
  if (!isReadableDocMime(mime)) return { ok: false, text: '', error: `unsupported_mime:${mime ?? 'none'}` }
  const model = opts?.model || DEFAULT_MODEL
  const prompt = opts?.prompt || DEFAULT_PROMPT
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inlineData: { mimeType: mime, data: toBase64(bytes) } },
            { text: prompt },
          ] }],
          generationConfig: { temperature: 0, maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(30000), // vision = plus lent, mais jamais infini
      },
    )
    // On NE log pas le corps (PII des documents) — statut seulement.
    if (!res.ok) return { ok: false, text: '', error: `gemini HTTP ${res.status}` }
    const text = parseGemini(await res.json())
    return { ok: text.length > 0, text }
  } catch (e) {
    return { ok: false, text: '', error: (e as Error)?.name ?? 'fetch_error' }
  }
}
