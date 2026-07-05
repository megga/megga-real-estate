// MEGGA Sprint 1 — Helper client export PDF audit nLPD (hash-chain signed)
// Appelle l'Edge Function audit-pdf-export et déclenche le téléchargement.

import { supabase } from '@/lib/supabase'
import type { AuditCategory, AuditSeverity } from '@/types/kyc'

export interface AuditPdfFilters {
  from?: string
  to?: string
  category?: AuditCategory
  severity?: AuditSeverity
  search?: string
  /** Super-admin uniquement : scope une agence précise (absent = plateforme entière). */
  agency_id?: string
}

export interface AuditPdfResponse {
  pdf_base64: string
  chain_hash: string
  count: number
  generated_at: string
}

/**
 * Demande l'Edge Function de générer un PDF horodaté avec hash-chain SHA-256
 * et déclenche le téléchargement côté navigateur.
 *
 * Conformité : nLPD art. 12 + LBA art. 7 al. 3 (preuve juridique).
 */
export async function downloadAuditPdf(filters: AuditPdfFilters = {}): Promise<void> {
  const { data, error } = await supabase.functions.invoke<AuditPdfResponse>(
    'audit-pdf-export',
    { body: filters },
  )

  if (error || !data?.pdf_base64) {
    throw new Error(error?.message ?? 'Edge Function audit-pdf-export a échoué')
  }

  // base64 → Blob → download
  const binary = atob(data.pdf_base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/pdf' })

  const stamp = data.generated_at.replace(/[:.]/g, '-').slice(0, 19)
  const filename = `megga-audit-nlpd-${stamp}-${data.chain_hash.slice(0, 8)}.pdf`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
