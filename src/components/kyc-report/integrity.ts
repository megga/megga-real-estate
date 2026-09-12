// MEGGA — Empreinte d'intégrité du rapport KYC : un VRAI SHA-256.
//
// ⛔ La première version du rapport imprimait « SHA-256 » au-dessus d'un repli
// FNV de 48 caractères hex, sans aucune fonction de hachage — un document LBA qui
// annonce une empreinte cryptographique et n'en porte pas. Celle-ci est calculée
// par `crypto.subtle` sur une forme CANONIQUE du dossier : les mêmes champs, dans
// le même ordre, quel que soit l'ordre dans lequel la base les a rendus. Deux
// rendus du même dossier (aperçu agent, rendu headless pour WhatsApp) donnent donc
// la même empreinte, et toute modification d'une pièce, d'un contrôle ou d'un
// statut la change.
//
// Ce qui entre dans l'empreinte est ce que le rapport AFFIRME : identité du
// dossier, verdict, statuts de screening, état de chaque contrôle, et le SHA-256
// de chaque pièce jointe (calculé à l'upload, `useKyc.ts`). Ce qui n'y entre pas :
// les libellés traduits et la date d'émission — un rapport réémis en allemand
// demain doit porter la même empreinte qu'en français aujourd'hui.

import type { KycCaseWithChecklist, KycDocument } from '@/types/kyc'

/** Forme canonique (JSON stable) du dossier, entrée du hachage. Exportée pour la garde. */
export function kycIntegrityCanonical(dossier: KycCaseWithChecklist, documents: KycDocument[]): string {
  const checklist = (dossier.checklist ?? [])
    .map((c) => ({
      category: c.category,
      is_completed: c.is_completed,
      completed_at: c.completed_at,
      document_id: c.document_id,
    }))
    .sort((a, b) => a.category.localeCompare(b.category))
  const docs = documents
    .map((d) => ({
      id: d.id,
      name: d.name,
      size_bytes: d.size_bytes,
      sha256_hash: d.sha256_hash,
      created_at: d.created_at,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify({
    v: 1,
    id: dossier.id,
    agency_id: dossier.agency_id,
    created_at: dossier.created_at,
    validated_at: dossier.validated_at,
    validated_by: dossier.validated_by,
    dossier_status: dossier.dossier_status,
    vigilance: dossier.vigilance,
    risk_level: dossier.risk_level,
    risk_score: dossier.risk_score,
    pep_status: dossier.pep_status,
    sanctions_status: dossier.sanctions_status,
    last_screening_at: dossier.last_screening_at,
    source_of_funds_type: dossier.source_of_funds_type,
    source_of_funds_description: dossier.source_of_funds_description,
    checklist,
    documents: docs,
  })
}

/** SHA-256 hex (64 caractères) de la forme canonique du dossier. */
export async function computeKycIntegrityHash(
  dossier: KycCaseWithChecklist,
  documents: KycDocument[],
): Promise<string> {
  const bytes = new TextEncoder().encode(kycIntegrityCanonical(dossier, documents))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
