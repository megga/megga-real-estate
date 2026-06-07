// Réconciliation d'une demande de signature avec le statut provider — source
// UNIQUE de vérité partagée par sign-document (action status, refresh manuel) et
// esign-webhook (callback provider). Impur (fetch + DB + Storage) → Deno only,
// jamais importé par un test Vitest. La logique pure de mapping vit dans
// _shared/esign-gateway.ts.

import type { EsignProvider, ProviderCredentials, StatusResult } from './esign-gateway.ts'

// SHA-256 hex (intégrité du PDF signé — cohérent avec documents.sha256_hash).
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Ligne signature_requests (sous-ensemble utile à la réconciliation).
export interface SigRequestRow {
  id: string
  agency_id: string
  provider: string
  provider_document_id: string | null
  document_id: string | null
  status: string
  signed_document_path: string | null
}

export interface ReconcileArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  provider: EsignProvider
  creds: ProviderCredentials
  token: string | undefined
  sr: SigRequestRow
  statusResult: StatusResult
  actor?: { id?: string | null; kind: 'agent' | 'system' | 'ai' }
}

const TERMINAL = new Set(['signed', 'declined', 'withdrawn', 'expired', 'error'])

// Télécharge le PDF signé chez le provider et le range dans le bucket privé
// signed-documents/<agency_id>/<sr_id>.pdf. Retourne chemin + sha256.
export async function downloadAndStoreSigned(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  provider: EsignProvider
  creds: ProviderCredentials
  token: string | undefined
  sr: SigRequestRow
}): Promise<{ ok: boolean; path?: string; sha256?: string; error?: string }> {
  const { supabase, provider, creds, token, sr } = args
  if (!sr.provider_document_id) return { ok: false, error: 'provider_document_id manquant' }

  const dl = provider.buildDownloadRequest(sr.provider_document_id, creds, token)
  const res = await fetch(dl.url, { method: dl.method, headers: dl.headers })
  if (!res.ok) return { ok: false, error: `download HTTP ${res.status}` }

  const buf = await res.arrayBuffer()
  const sha256 = await sha256Hex(buf)
  const path = `${sr.agency_id}/${sr.id}.pdf`

  const up = await supabase.storage
    .from('signed-documents')
    .upload(path, new Uint8Array(buf), { contentType: 'application/pdf', upsert: true })
  if (up.error) return { ok: false, error: up.error.message }

  return { ok: true, path, sha256 }
}

// Applique un StatusResult à la demande : MAJ signature_requests, télécharge le
// PDF si signé, MAJ documents, écrit l'audit. Idempotent (re-callbacks ok).
export async function reconcileSignatureRequest(args: ReconcileArgs): Promise<{ status: string; finalized: boolean }> {
  const { supabase, provider, creds, token, sr, statusResult, actor } = args
  const nowIso = new Date().toISOString()
  const newStatus = statusResult.status

  const update: Record<string, unknown> = {
    status: newStatus,
    signers: statusResult.signers,
    raw_status: statusResult as unknown,
  }
  if (statusResult.providerDocumentId) update.provider_document_id = statusResult.providerDocumentId
  if (TERMINAL.has(newStatus)) update.completed_at = nowIso

  let finalized = false

  // Signé et pas encore archivé → télécharge + range le PDF signé.
  if (newStatus === 'signed' && !sr.signed_document_path) {
    const stored = await downloadAndStoreSigned({
      supabase,
      provider,
      creds,
      token,
      sr: { ...sr, provider_document_id: statusResult.providerDocumentId ?? sr.provider_document_id },
    })
    if (stored.ok) {
      update.signed_document_path = stored.path
      update.signed_sha256 = stored.sha256
      finalized = true
    } else {
      update.last_error = stored.error
    }
  }

  await supabase.from('signature_requests').update(update).eq('id', sr.id)

  // Reflète sur le document source (filtrage rapide en liste).
  if (sr.document_id) {
    const docStatus =
      newStatus === 'signed' ? 'signed'
      : newStatus === 'declined' ? 'declined'
      : newStatus === 'withdrawn' ? 'withdrawn'
      : 'pending'
    const docUpdate: Record<string, unknown> = { signature_status: docStatus }
    if (newStatus === 'signed') docUpdate.signed_at = nowIso
    await supabase.from('documents').update(docUpdate).eq('id', sr.document_id)
  }

  // Audit (toute action, y compris callback système).
  await supabase.from('activity_events').insert({
    agency_id: sr.agency_id,
    actor_id: actor?.id ?? null,
    actor_kind: actor?.kind ?? 'system',
    action: `signature.${newStatus}`,
    entity_type: 'signature_request',
    entity_id: sr.id,
    category: 'signature',
    object_label: `Signature ${sr.provider}`,
    metadata: { provider: sr.provider, status: newStatus, finalized },
    created_at: nowIso,
  })

  return { status: newStatus, finalized }
}
