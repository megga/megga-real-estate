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
  actor?: { id?: string | null; kind: 'user' | 'system' | 'ai' }
}

const TERMINAL = new Set(['signed', 'declined', 'withdrawn', 'expired', 'error'])

/**
 * La demande est-elle DÉFINITIVEMENT close — c'est-à-dire plus rien qu'un
 * callback puisse faire avancer ?
 *
 * ⚠ Plus étroit que `TERMINAL`, et c'est délibéré. `expired` et `error` sont
 * terminaux au sens du STATUT, mais un callback ultérieur doit encore pouvoir
 * réconcilier (le provider peut corriger, et un `signed` dont le téléchargement
 * a échoué relâche son verrou pour être re-tenté). Seuls trois états ne laissent
 * plus rien à faire : le PDF est archivé, ou la demande a été retirée, ou elle a
 * été refusée.
 *
 * Source unique de vérité, consommée par `esign-webhook` (court-circuit
 * idempotent) ET par l'effacement du `webhook_token` ci-dessous. Les deux DOIVENT
 * s'accorder : effacer le jeton d'une demande que le webhook croit encore active
 * ferait échouer en 401 un callback légitime, et le provider boucle sur les
 * non-2xx.
 */
export function isRequestSettled(
  sr: Pick<SigRequestRow, 'status' | 'signed_document_path'>,
): boolean {
  return !!sr.signed_document_path || sr.status === 'withdrawn' || sr.status === 'declined'
}

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

  let finalized = false

  if (newStatus === 'signed' && !sr.signed_document_path) {
    // Claim ATOMIQUE : Skribble envoie success + update quasi-simultanement, donc
    // deux callbacks concurrents arrivent. Le verrou porte sur completed_at — que
    // CE meme UPDATE ecrit — via WHERE completed_at IS NULL : un seul callback
    // gagne, le second voit la colonne deja ecrite → 0 ligne → il s'arrete (pas de
    // double download ni de double audit). NB : verrouiller sur signed_document_path
    // serait inefficace (le claim ne l'ecrit qu'APRES le download → la colonne reste
    // NULL, les deux callbacks matcheraient). En cas d'echec download, on relache
    // completed_at (plus bas) pour permettre un retry.
    const claim: Record<string, unknown> = {
      status: 'signed',
      completed_at: nowIso,
      signers: statusResult.signers,
      raw_status: statusResult as unknown,
    }
    if (statusResult.providerDocumentId) claim.provider_document_id = statusResult.providerDocumentId
    const { data: claimed } = await supabase
      .from('signature_requests')
      .update(claim)
      .eq('id', sr.id)
      .is('completed_at', null)
      .select('id')
    if (!claimed || claimed.length === 0) {
      // Un autre callback finalise deja → idempotent, on s'arrete (pas de re-audit).
      return { status: 'signed', finalized: false }
    }
    const stored = await downloadAndStoreSigned({
      supabase,
      provider,
      creds,
      token,
      sr: { ...sr, provider_document_id: statusResult.providerDocumentId ?? sr.provider_document_id },
    })
    if (stored.ok) {
      await supabase
        .from('signature_requests')
        .update({
          signed_document_path: stored.path,
          signed_sha256: stored.sha256,
          // Le jeton d'URL a fini son office : le PDF est archivé, plus aucun
          // callback ne peut faire avancer cette demande. On l'efface plutôt que
          // de le laisser vivre indéfiniment dans la base ET dans les journaux
          // d'accès qui ont vu passer l'URL (audit du 03.08.2026 §4.3).
          // Effacé ICI et pas plus haut dans le claim : tant que le
          // téléchargement peut échouer, la demande reste re-tentable et le
          // jeton doit survivre.
          webhook_token: null,
        })
        .eq('id', sr.id)
      finalized = true
    } else {
      // Echec download → on RELACHE le verrou (completed_at=null) et on laisse
      // signed_document_path NULL, pour re-tenter au prochain callback / refresh.
      await supabase
        .from('signature_requests')
        .update({ last_error: stored.error, completed_at: null })
        .eq('id', sr.id)
    }
  } else {
    // Statuts non-signes (ou signe deja archive) : MAJ generique.
    const update: Record<string, unknown> = {
      status: newStatus,
      signers: statusResult.signers,
      raw_status: statusResult as unknown,
    }
    if (statusResult.providerDocumentId) update.provider_document_id = statusResult.providerDocumentId
    if (TERMINAL.has(newStatus)) update.completed_at = nowIso
    // Même raison qu'au-dessus : retirée ou refusée, la demande ne peut plus
    // rien recevoir d'utile — le jeton n'a plus de raison d'exister.
    // `isRequestSettled` est la MÊME condition que le court-circuit du webhook,
    // pour qu'ils ne puissent pas diverger.
    if (isRequestSettled({ status: newStatus, signed_document_path: sr.signed_document_path })) {
      update.webhook_token = null
    }
    await supabase.from('signature_requests').update(update).eq('id', sr.id)
  }

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

  // Audit (toute action, y compris callback systeme). category contraint a
  // {kyc,deal,contact,bien,doc,auth,settings,ai} → 'doc' ; actor_kind a
  // {user,ai,system} avec actor_id non-null seulement si 'user' (cf. CHECK).
  await supabase.from('activity_events').insert({
    agency_id: sr.agency_id,
    actor_id: actor?.id ?? null,
    actor_kind: actor?.kind ?? 'system',
    action: `signature.${newStatus}`,
    entity_type: 'signature_request',
    entity_id: sr.id,
    category: 'doc',
    object_label: `Signature ${sr.provider}`,
    metadata: { provider: sr.provider, status: newStatus, finalized },
    created_at: nowIso,
  })

  return { status: newStatus, finalized }
}
