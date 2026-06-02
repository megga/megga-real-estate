// Récupération des médias WhatsApp entrants (Meta Cloud API).
// Helpers PURS (testables Node) + fetchMetaMedia (fetch global, sans Deno).
// Le PUT R2 (aws4fetch) vit dans whatsapp-process (Deno) — validé en staging.

const MIME_EXT: Record<string, string> = {
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/amr': 'amr',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'application/pdf': 'pdf',
}

/** Extension de fichier depuis un mime (paramètres ignorés). 'bin' si inconnu. */
export function extFromMime(mime: string | null | undefined): string {
  if (!mime) return 'bin'
  const base = mime.split(';')[0].trim().toLowerCase()
  return MIME_EXT[base] ?? 'bin'
}

/** Clé R2 déterministe : rejouable sans doublon. */
export function buildMediaKey(agencyId: string, messageId: string, mime: string | null): string {
  return `wa/${agencyId}/${messageId}.${extFromMime(mime)}`
}

/** Réponse Graph étape 1 ({ url, mime_type }) → { url, mime } ou null. */
export function parseMetaMediaMeta(json: unknown): { url: string; mime: string | null } | null {
  const j = json as { url?: string; mime_type?: string }
  if (!j?.url) return null
  return { url: j.url, mime: j.mime_type ?? null }
}

export interface MetaMediaConfig { metaToken: string; apiVersion?: string }

/** 2 étapes Graph : media_id → URL signée (≈5 min) → bytes. fetch global (Node OK). */
// bytes typés Uint8Array<ArrayBuffer> (issus de arrayBuffer()) : satisfait le
// BodyInit d'aws4fetch côté R2 (un Uint8Array<ArrayBufferLike> ne l'est pas).
export async function fetchMetaMedia(
  mediaId: string, cfg: MetaMediaConfig,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string | null }> {
  const v = cfg.apiVersion ?? 'v22.0'
  const metaRes = await fetch(`https://graph.facebook.com/${v}/${mediaId}`, {
    headers: { Authorization: `Bearer ${cfg.metaToken}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!metaRes.ok) throw new Error(`meta media meta HTTP ${metaRes.status}`)
  const meta = parseMetaMediaMeta(await metaRes.json())
  if (!meta) throw new Error('meta media: pas d’URL (média expiré ?)')

  const binRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${cfg.metaToken}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!binRes.ok) throw new Error(`meta media bytes HTTP ${binRes.status}`)
  return { bytes: new Uint8Array(await binRes.arrayBuffer()), mime: meta.mime }
}
