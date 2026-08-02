// supabase/functions/magic-link-upload/index.ts
// POST /functions/v1/magic-link-upload   (jeton dans l'en-tête `x-magic-link-token`)
//
// Sprint 4.7.A — Endpoint PUBLIC (sans auth) qui reçoit un fichier client.
//
// Input :
//   - en-tête `x-magic-link-token` (hors URL : les journaux d'accès de la
//     plateforme enregistrent l'URL complète)
//   - multipart/form-data avec :
//     - `file` (File) : le fichier (max 10 MB, MIME pdf/jpeg/png/webp/heic)
//     - `type` (string) : 'identity' | 'address' | 'funds' | 'other'
//
// Output (200) :
//   { upload_id, filename, size_bytes, type, sha256_hash, uploaded_at, status }
//
// Logique :
//   1. Vérifie HMAC token
//   2. Charge le lien magique (DB) + valide qu'il est uploadable
//   3. Valide le fichier (taille, MIME, nom)
//   4. Calcule SHA-256 du contenu
//   5. Upload vers bucket `kyc-magic-link` path `{agency_id}/{magic_link_id}/{ts}_{safeName}`
//   6. INSERT row dans `kyc_magic_link_uploads`
//   7. Update status='uploading' + uploaded_at sur le magic_link

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'

// `x-magic-link-token` DOIT figurer ici : l'appel vient d'un navigateur en
// cross-origin, et un en-tête absent de cette liste fait échouer le preflight —
// chaque téléversement KYC deviendrait une erreur CORS opaque.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-magic-link-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
])
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['identity', 'address', 'funds', 'other'])

function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/]/g, '_')
    .replace(/\.\.+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 200)
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Jeton en en-tête : les journaux d'accès de la plateforme conservent l'URL
  // complète, un `?token=` y déposerait chaque jeton KYC en clair pour toute sa
  // durée de vie. Repli sur le query param par COMPATIBILITÉ — les liens déjà
  // envoyés et les appelants hors navigateur doivent continuer de fonctionner.
  // Pas de repli sur un champ du multipart : il faudrait bufferiser jusqu'à 10 MB
  // d'un appelant non authentifié AVANT de pouvoir vérifier la signature.
  const url = new URL(req.url)
  const token = req.headers.get('x-magic-link-token')?.trim() || url.searchParams.get('token')
  if (!token) {
    return new Response(JSON.stringify({ error: 'x-magic-link-token header required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1. Verify HMAC
  const verify = await verifyMagicLinkToken(token)
  if (!verify.valid || !verify.payload) {
    const statusCode = verify.reason === 'expired' ? 410 : 401
    return new Response(
      // Motif volontairement réduit à expired/invalid : cf. magic-link-get.
      JSON.stringify({ error: 'Invalid or expired link', reason: verify.reason === 'expired' ? 'expired' : 'invalid' }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
  const magicLinkId = verify.payload.id

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // 2. Charge le lien + valide qu'il est uploadable
  const { data: link, error: linkErr } = await supabase
    .from('kyc_magic_links')
    .select('id, token, agency_id, status, expires_at')
    .eq('id', magicLinkId)
    .single()

  if (linkErr || !link) {
    return new Response(JSON.stringify({ error: 'Link not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (link.token !== token) {
    return new Response(
      JSON.stringify({ error: 'Token superseded', reason: 'regenerated' }),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
  if (link.status === 'submitted' || link.status === 'expired') {
    return new Response(
      JSON.stringify({
        error: 'Link not uploadable in current status',
        status: link.status,
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
  if (new Date(link.expires_at) <= new Date()) {
    await supabase
      .from('kyc_magic_links')
      .update({ status: 'expired', expired_at: new Date().toISOString() })
      .eq('id', magicLinkId)
    return new Response(JSON.stringify({ error: 'Link expired' }), {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 3. Parse multipart
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return new Response(JSON.stringify({ error: 'multipart/form-data required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const file = form.get('file')
  const typeRaw = form.get('type')
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'file field required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const type = typeof typeRaw === 'string' && ALLOWED_TYPES.has(typeRaw) ? typeRaw : 'other'

  // 4. Validate file
  if (file.size <= 0 || file.size > MAX_SIZE) {
    return new Response(
      JSON.stringify({ error: `file size invalid (max ${MAX_SIZE / 1024 / 1024} MB)` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return new Response(
      JSON.stringify({
        error: `file MIME not allowed (got ${file.type}, allowed: ${[...ALLOWED_MIME].join(', ')})`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const safeName = sanitizeFilename(file.name || 'document')
  const buf = await file.arrayBuffer()
  const hash = await sha256Hex(buf)

  // 5. Upload vers Storage
  const path = `${link.agency_id}/${link.id}/${Date.now()}_${safeName}`
  const { error: storageErr } = await supabase.storage
    .from('kyc-magic-link')
    .upload(path, new Uint8Array(buf), {
      contentType: file.type,
      upsert: false,
    })

  if (storageErr) {
    return new Response(
      JSON.stringify({ error: 'storage upload failed', details: storageErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // 6. INSERT row uploads
  const { data: uploadRow, error: insertErr } = await supabase
    .from('kyc_magic_link_uploads')
    .insert({
      magic_link_id: link.id,
      agency_id: link.agency_id,
      type,
      filename: file.name?.slice(0, 255) || safeName,
      size_bytes: file.size,
      mime_type: file.type,
      storage_path: path,
      sha256_hash: hash,
    })
    .select('id, filename, size_bytes, type, sha256_hash, uploaded_at')
    .single()

  if (insertErr || !uploadRow) {
    // Best-effort cleanup du fichier uploadé
    await supabase.storage.from('kyc-magic-link').remove([path])
    return new Response(
      JSON.stringify({ error: 'upload row insert failed', details: insertErr?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // 7. Update status='uploading' (si pas déjà submitted)
  const updateData: Record<string, unknown> = {
    uploaded_at: new Date().toISOString(),
  }
  if (link.status !== 'uploading' && link.status !== 'verifying') {
    updateData.status = 'uploading'
  }
  await supabase.from('kyc_magic_links').update(updateData).eq('id', link.id)

  return new Response(
    JSON.stringify({
      upload_id: uploadRow.id,
      filename: uploadRow.filename,
      size_bytes: uploadRow.size_bytes,
      type: uploadRow.type,
      sha256_hash: uploadRow.sha256_hash,
      uploaded_at: uploadRow.uploaded_at,
      status: 'received',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
