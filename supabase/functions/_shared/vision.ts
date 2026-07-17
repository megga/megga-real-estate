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
  opts?: { model?: string; prompt?: string; json?: boolean },
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
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 4096,
            // json:true → sortie JSON stricte (extraction/classification structurée).
            ...(opts?.json ? { responseMimeType: 'application/json' } : {}),
          },
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

// ── Compréhension d'un média ENTRANT (image/PDF reçu d'un client) ─────────────
// Différent de `readDocument` (OCR brut, agent → KYC) : ici on CLASSE + résume une
// image/un doc reçu pour qu'il nourrisse la compréhension du fil, SANS exfiltrer de
// PII d'identité. Garde-fou résidence : une pièce d'identité n'est JAMAIS recopiée
// (kind=id_document → texte vide + libellé neutre, cf. threadTextFor).

export type MediaKind = 'property_photo' | 'listing' | 'document' | 'id_document' | 'other'
export interface MediaUnderstanding { kind: MediaKind; caption: string; text: string }

const MEDIA_KINDS: MediaKind[] = ['property_photo', 'listing', 'document', 'id_document', 'other']
const CAPTION_MAX = 200
const MEDIA_TEXT_MAX = 3000
/** Libellé neutre rangé dans le fil pour une pièce d'identité (0 PII, jamais l'OCR). */
export const ID_DOC_REDACTION_FR = "[Document d'identité reçu — à traiter via le dossier KYC]"

const DESCRIBE_PROMPT =
  "Tu analyses une image ou un document qu'un CLIENT a envoyé à un agent immobilier. " +
  'Réponds UNIQUEMENT en JSON : {"kind":"property_photo|listing|document|id_document|other",' +
  '"caption":"une phrase factuelle décrivant le contenu (en français)","text":"texte lisible (OCR), ou vide"}. ' +
  "RÈGLE STRICTE : si c'est une pièce d'identité, passeport, permis de conduire ou de séjour " +
  "(kind=id_document), mets caption=\"Document d'identité\" et text=\"\" — ne recopie JAMAIS " +
  'les données personnelles (nom, n°, date de naissance). N\'invente rien.'

/** Parse + valide la réponse JSON de Gemini. Repli sûr (null si inexploitable). */
export function parseMediaUnderstanding(raw: string): MediaUnderstanding | null {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { return null }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  const kRaw = typeof o.kind === 'string' ? o.kind.trim() : ''
  const kind: MediaKind = (MEDIA_KINDS as string[]).includes(kRaw) ? (kRaw as MediaKind) : 'other'
  const caption = (typeof o.caption === 'string' ? o.caption : '').trim().slice(0, CAPTION_MAX)
  const text = (typeof o.text === 'string' ? o.text : '').trim().slice(0, MEDIA_TEXT_MAX)
  if (!caption && !text) return null
  return { kind, caption, text }
}

/** Texte à ranger dans le fil (champ transcript). Redaction DURE des pièces d'identité. */
export function threadTextFor(u: MediaUnderstanding): string {
  if (u.kind === 'id_document') return ID_DOC_REDACTION_FR
  return [u.caption, u.text].filter(Boolean).join('\n').slice(0, MEDIA_TEXT_MAX)
}

/** Classe + résume un média entrant via Gemini (JSON). Ne lève jamais. */
export async function describeInboundMedia(
  bytes: Uint8Array,
  mime: string | null,
  apiKey: string,
  opts?: { model?: string },
): Promise<{ ok: boolean; data?: MediaUnderstanding; error?: string }> {
  if (!apiKey) return { ok: false, error: 'no_api_key' }
  if (!isReadableDocMime(mime)) return { ok: false, error: `unsupported_mime:${mime ?? 'none'}` }
  const model = opts?.model || DEFAULT_MODEL
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inlineData: { mimeType: mime, data: toBase64(bytes) } },
            { text: DESCRIBE_PROMPT },
          ] }],
          generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(30000),
      },
    )
    if (!res.ok) return { ok: false, error: `gemini HTTP ${res.status}` } // jamais de corps loggé (PII)
    const data = parseMediaUnderstanding(parseGemini(await res.json()))
    return data ? { ok: true, data } : { ok: false, error: 'unparseable' }
  } catch (e) {
    return { ok: false, error: (e as Error)?.name ?? 'fetch_error' }
  }
}
