// Transcription d'un audio WhatsApp via Deepgram Nova-2.
// parseDeepgram = pur (testé). transcribe() = fetch global (clé en paramètre,
// pas de Deno.env) → importable et mockable sous Node.

export interface Transcript { transcript: string; confidence: number; lang: string | null }

/** Lit la forme de réponse Deepgram. Repli neutre si vide. */
export function parseDeepgram(json: unknown): Transcript {
  const ch = (json as { results?: { channels?: Array<Record<string, unknown>> } })
    ?.results?.channels?.[0]
  const alt = (ch?.alternatives as Array<{ transcript?: string; confidence?: number }> | undefined)?.[0]
  return {
    transcript: alt?.transcript ?? '',
    confidence: alt?.confidence ?? 0,
    lang: (ch?.detected_language as string) ?? null,
  }
}

/** Appel Deepgram (octets bruts). Lève si HTTP non-2xx. */
export async function transcribe(bytes: Uint8Array, mime: string | null, apiKey: string): Promise<Transcript> {
  const qs = new URLSearchParams({ model: 'nova-2', detect_language: 'true', smart_format: 'true', punctuate: 'true' })
  const res = await fetch(`https://api.deepgram.com/v1/listen?${qs}`, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': mime || 'audio/ogg' },
    body: bytes,
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`deepgram HTTP ${res.status}`)
  return parseDeepgram(await res.json())
}
