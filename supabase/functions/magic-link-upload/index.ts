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
// Refus — chacun porte un `reason` que la page publique traduit, JAMAIS le texte d'une
// erreur de base ou de stockage (un appelant anonyme n'a rien à apprendre de nos internes) :
//   411 length_required · 413 too_large · 409 upload_limit · 409 not_uploadable
//   400 format / empty · 410 expired · 401 invalid
//
// Logique :
//   1. Vérifie HMAC token
//   2. Charge le lien magique (DB) + valide qu'il est uploadable
//   3. Borne le corps AVANT de le lire (Content-Length exigé) et compte les pièces du lien
//   4. Valide le fichier (taille, MIME, nom) et le volume cumulé du lien
//   5. Calcule SHA-256 du contenu
//   6. Upload vers bucket `kyc-magic-link` path `{agency_id}/{magic_link_id}/{ts}_{safeName}`
//   7. INSERT row dans `kyc_magic_link_uploads` — le trigger
//      `enforce_kyc_magic_link_upload_caps` y refait, sous verrou du lien, les contrôles
//      de statut et de plafonds (20 pièces, 100 Mo) : c'est LUI qui fait foi sous des
//      dépôts parallèles, l'edge ne fait que refuser tôt ce qu'elle voit déjà.
//   8. Update status='uploading' + uploaded_at sur le magic_link (statuts ouverts seuls)
//
// PAS DE LIMITEUR PAR IP (audit du 13.09.2026, point S10) : il ne protège pas un lien
// transféré, et le deviner est déjà impossible (HMAC 256 bits + jeton stocké). Le seul
// abus qui dure — remplir le bucket — est borné PAR LIEN, par construction.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'
import {
  ALLOWED_UPLOAD_MIME,
  MAGIC_LINK_OPEN_STATUSES,
  MAX_BYTES_PER_LINK,
  MAX_FILE_BYTES,
  MAX_FILES_PER_LINK,
  exceedsLinkCaps,
  screenUploadRequest,
} from '../_shared/magic-link-limits.ts'

// `x-magic-link-token` DOIT figurer ici : l'appel vient d'un navigateur en
// cross-origin, et un en-tête absent de cette liste fait échouer le preflight —
// chaque téléversement KYC deviendrait une erreur CORS opaque.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage, x-magic-link-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_MIME = new Set(ALLOWED_UPLOAD_MIME)
const ALLOWED_TYPES = new Set(['identity', 'address', 'funds', 'other'])

/** Libellé d'audit d'un dépôt refusé au plafond (une ligne par lien et par heure au plus). */
const AUDIT_PLAFOND = 'kyc_magic_link_upload_refused'

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
const reponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

/** Refus au plafond : le même corps, quel que soit le contrôle qui l'a constaté. */
const refusPlafond = () => reponse({ error: 'upload_limit', reason: 'upload_limit' }, 409)

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

/**
 * Trace un dépôt refusé au plafond — UNE ligne par lien et par heure.
 *
 * Pourquoi l'edge et non le trigger : le RAISE du trigger annule tout ce qu'il écrirait, et
 * la règle du projet veut une piste d'audit pour un lien transféré dont on abuse. Pourquoi
 * une par heure : chaque refus est une requête du porteur ; sans dédoublonnage, il ferait
 * écrire `activity_events` (append-only, retenu dix ans) à sa propre cadence. Meilleur
 * effort : un échec d'audit ne change pas la réponse au porteur.
 */
async function auditerPlafond(
  supabase: SupabaseClient,
  link: { id: string; agency_id: string },
): Promise<void> {
  try {
    const depuis = new Date(Date.now() - 3_600_000).toISOString()
    const { data: recent, error: lectureErr } = await supabase
      .from('activity_events')
      .select('id')
      .eq('entity_id', link.id)
      .eq('action', AUDIT_PLAFOND)
      .gte('created_at', depuis)
      .limit(1)
    if (lectureErr) throw lectureErr
    if (recent && recent.length > 0) return
    const { error } = await supabase.from('activity_events').insert({
      agency_id: link.agency_id,
      actor_id: null,
      actor_kind: 'system',
      action: AUDIT_PLAFOND,
      entity_type: 'kyc_magic_link',
      entity_id: link.id,
      category: 'kyc',
      severity: 'warn',
      object_label: `Lien ${link.id}`,
      metadata: { reason: 'upload_limit', max_files: MAX_FILES_PER_LINK, max_bytes: MAX_BYTES_PER_LINK },
    })
    if (error) throw error
  } catch (e) {
    console.error('magic-link-upload audit plafond', {
      link_id: link.id,
      message: e instanceof Error ? e.message : String(e),
    })
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return reponse({ error: 'Method not allowed' }, 405)
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
    return reponse({ error: 'x-magic-link-token header required' }, 400)
  }

  // 1. Verify HMAC
  const verify = await verifyMagicLinkToken(token)
  if (!verify.valid || !verify.payload) {
    const statusCode = verify.reason === 'expired' ? 410 : 401
    return reponse(
      // Motif volontairement réduit à expired/invalid : cf. magic-link-get.
      { error: 'Invalid or expired link', reason: verify.reason === 'expired' ? 'expired' : 'invalid' },
      statusCode,
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
    return reponse({ error: 'Link not found' }, 404)
  }
  if (link.token !== token) {
    return reponse({ error: 'Token superseded', reason: 'regenerated' }, 410)
  }
  if (link.status === 'submitted' || link.status === 'expired') {
    return reponse({
      error: 'Link not uploadable in current status',
      reason: 'not_uploadable',
      status: link.status,
    }, 409)
  }
  if (new Date(link.expires_at) <= new Date()) {
    // Filtré sur les statuts OUVERTS : une soumission concurrente, arrivée entre la lecture
    // et cette écriture, ne doit pas être réécrite en « expiré ».
    await supabase
      .from('kyc_magic_links')
      .update({ status: 'expired', expired_at: new Date().toISOString() })
      .eq('id', magicLinkId)
      .in('status', [...MAGIC_LINK_OPEN_STATUSES])
    return reponse({ error: 'Link expired', reason: 'expired' }, 410)
  }

  // 3. Le corps est borné AVANT d'être lu. `req.formData()` tamponne tout : sans
  //    Content-Length, un envoi chunked n'aurait aucune limite — exactement ce que le
  //    plafond devait empêcher. Un navigateur envoie toujours la longueur d'un FormData.
  const tri = screenUploadRequest(req.headers.get('content-length'))
  if (!tri.ok) {
    return reponse(
      { error: tri.status === 411 ? 'Content-Length required' : 'file too large', reason: tri.reason },
      tri.status,
    )
  }

  //    Plafond de pièces vérifié AVANT de lire le corps et d'écrire en stockage : un lien
  //    plein ne coûte plus ni tampon ni objet orphelin. Au plus 20 lignes, par l'index
  //    idx_kyc_magic_link_uploads_link — jamais de `count: 'exact'` ici.
  const { data: dejaDeposees, error: compteErr } = await supabase
    .from('kyc_magic_link_uploads')
    .select('size_bytes')
    .eq('magic_link_id', link.id)
  if (compteErr) {
    console.error('magic-link-upload compte', { link_id: link.id, message: compteErr.message })
    return reponse({ error: 'upload check failed' }, 500)
  }
  const deja = {
    files: dejaDeposees?.length ?? 0,
    bytes: (dejaDeposees ?? []).reduce((total, r) => total + (Number(r.size_bytes) || 0), 0),
  }
  if (deja.files >= MAX_FILES_PER_LINK) {
    await auditerPlafond(supabase, link)
    return refusPlafond()
  }

  // 4. Parse multipart
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return reponse({ error: 'multipart/form-data required' }, 400)
  }

  const file = form.get('file')
  const typeRaw = form.get('type')
  if (!(file instanceof File)) {
    return reponse({ error: 'file field required' }, 400)
  }
  const type = typeof typeRaw === 'string' && ALLOWED_TYPES.has(typeRaw) ? typeRaw : 'other'

  // Validate file
  if (file.size <= 0) {
    return reponse({ error: 'empty file', reason: 'empty' }, 400)
  }
  if (file.size > MAX_FILE_BYTES) {
    return reponse({ error: 'file too large', reason: 'too_large' }, 413)
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return reponse({ error: 'file MIME not allowed', reason: 'format' }, 400)
  }
  if (exceedsLinkCaps(deja, file.size)) {
    await auditerPlafond(supabase, link)
    return refusPlafond()
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
    // Le message du stockage reste dans nos journaux : il n'apprend rien d'utile au
    // porteur, et il décrit notre infrastructure.
    console.error('magic-link-upload stockage', { link_id: link.id, message: storageErr.message })
    return reponse({ error: 'storage upload failed' }, 500)
  }

  // 6. INSERT row uploads — le trigger de plafonds tranche ici, sous verrou du lien.
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
    const message = insertErr?.message ?? ''
    // Codes levés par `enforce_kyc_magic_link_upload_caps` : le plafond atteint entre le
    // comptage et l'écriture (dépôts parallèles), ou le lien soumis/expiré entre-temps.
    if (message.includes('magic_link_upload_limit')) {
      await auditerPlafond(supabase, link)
      return refusPlafond()
    }
    if (message.includes('magic_link_not_uploadable')) {
      return reponse({ error: 'Link not uploadable in current status', reason: 'not_uploadable' }, 409)
    }
    // Tout le reste — `magic_link_agency_mismatch` compris, impossible depuis cette edge qui
    // recopie l'agence du lien — est un incident : journalisé, jamais recopié au porteur.
    console.error('magic-link-upload insert', { link_id: link.id, message })
    return reponse({ error: 'upload row insert failed' }, 500)
  }

  // 7. Update status='uploading' (si pas déjà submitted). Filtré sur les statuts OUVERTS :
  //    une confirmation concurrente, arrivée entre le dépôt et cette écriture, a pu passer
  //    le lien en `submitted` — sans ce filtre on le ramènerait à `uploading`, ce qui
  //    rouvrirait la vue complète ET la capacité de dépôt à quiconque tient le lien.
  const updateData: Record<string, unknown> = {
    uploaded_at: new Date().toISOString(),
  }
  if (link.status !== 'uploading' && link.status !== 'verifying') {
    updateData.status = 'uploading'
  }
  await supabase
    .from('kyc_magic_links')
    .update(updateData)
    .eq('id', link.id)
    .in('status', [...MAGIC_LINK_OPEN_STATUSES])

  return reponse({
    upload_id: uploadRow.id,
    filename: uploadRow.filename,
    size_bytes: uploadRow.size_bytes,
    type: uploadRow.type,
    sha256_hash: uploadRow.sha256_hash,
    uploaded_at: uploadRow.uploaded_at,
    status: 'received',
  }, 200)
})
