// supabase/functions/_shared/r2.ts
// Écriture d'un objet sur le bucket R2 public (`img.getmegga.com`), partagée.
//
// Le PUT signé (aws4fetch, SigV4 sur l'endpoint S3 de R2) vivait recopié dans
// `photo-processor` et `whatsapp-process`, chacun avec sa lecture de l'environnement.
// Les Labs écrivent trois genres d'objets (image, vidéo, piste de voix off) depuis deux
// fonctions : une troisième copie aurait été la copie de trop. Les deux premières ne
// sont pas reprises ici — elles redimensionnent avant d'écrire, ce module ne fait
// qu'écrire.
//
// ⚠ Les clés R2 ne quittent jamais l'edge : ce module n'est appelé que sous le rôle de
// service, jamais depuis le navigateur.

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.17'

export interface R2Config {
  client: AwsClient
  endpoint: string
  bucket: string
  publicBase: string
}

/** La configuration lue au moment de l'appel, ou `null` si un des quatre réglages manque. */
export function r2Config(): R2Config | null {
  const accountId = (Deno.env.get('CF_ACCOUNT_ID') ?? '').trim()
  const accessKeyId = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim()
  const secretAccessKey = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim()
  const publicBase = (Deno.env.get('R2_PUBLIC_BASE') ?? '').replace(/\/$/, '')
  const bucket = Deno.env.get('R2_BUCKET') ?? 'megga-market'
  if (!accountId || !accessKeyId || !secretAccessKey || !publicBase) return null
  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }),
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    bucket,
    publicBase,
  }
}

export type R2PutResult = { ok: true; url: string } | { ok: false; err: string }

/**
 * Écrit `body` sous `key` et rend l'URL publique servie par R2.
 *
 * `Cache-Control` immuable : une clé ne se réécrit jamais avec un autre contenu
 * (les Labs nomment leurs objets par l'uuid de la production).
 */
export async function r2Put(cfg: R2Config, key: string, body: Uint8Array, contentType: string): Promise<R2PutResult> {
  const url = `${cfg.endpoint}/${cfg.bucket}/${key}`
  try {
    const res = await cfg.client.fetch(url, {
      method: 'PUT',
      body: body as unknown as BodyInit,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { ok: false, err: `${res.status} ${txt.slice(0, 120)}` }
    }
    return { ok: true, url: `${cfg.publicBase}/${key}` }
  } catch (e) {
    return { ok: false, err: (e as Error).message?.slice(0, 120) ?? 'r2 put failed' }
  }
}
