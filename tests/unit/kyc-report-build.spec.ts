/**
 * Rapport KYC — le view-model dit ce que la base dit, et l'empreinte est un vrai SHA-256.
 *
 * Trois choses que la maquette ne montre pas et que seul un test tient :
 *  · une ligne de screening par LISTE, mais un statut par SOURCE — PEP suit
 *    `pep_status`, les quatre listes de sanctions suivent `sanctions_status`, et
 *    « adverse media » (aucune colonne en base) porte le pire des deux ;
 *  · la page 3 est une feuille à hauteur fixe (`overflow: hidden`) : au-delà de
 *    `MAX_DOC_ROWS` pièces, le rapport le DIT au lieu de couper ;
 *  · l'empreinte « SHA-256 » est calculée par `crypto.subtle` sur une forme
 *    canonique — insensible à l'ordre des lignes, sensible à leur contenu.
 */
import { describe, it, expect, vi } from 'vitest'
import type { KycCaseWithChecklist, KycDocument } from '@/types/kyc'

// Le builder lit l'instance i18n singleton ; on la remplace par une identité
// (la clé revient telle quelle) pour asserter la STRUCTURE, pas la traduction.
vi.mock('@/i18n', () => ({
  default: {
    language: 'fr',
    t: (key: string, opts?: Record<string, unknown>) =>
      typeof opts?.defaultValue === 'string' ? key : key,
  },
}))

const { buildPdfReportData, MAX_DOC_ROWS } = await import('@/components/kyc-report/buildReportData')
const { computeKycIntegrityHash, kycIntegrityCanonical } = await import('@/components/kyc-report/integrity')

const T0 = '2026-05-18T12:38:00.000Z'

function dossier(over: Partial<KycCaseWithChecklist> = {}): KycCaseWithChecklist {
  return {
    id: '0a1b2c3d-0000-4000-8000-0000000000ab3f',
    agency_id: 'agency-a',
    transaction_id: 'tx-1',
    contact_id: 'c-1',
    type: 'buyer_pp',
    risk_level: 'low',
    status: 'validated',
    completion_pct: 100,
    validated_by: 'p-sophie',
    validated_at: T0,
    created_at: '2026-05-12T09:00:00.000Z',
    pep_status: 'clear',
    pep_details: null,
    sanctions_status: 'clear',
    sanctions_details: null,
    last_screening_at: '2026-05-18T07:11:00.000Z',
    contact_nationality: 'CH',
    transaction_amount: 850000,
    risk_score: 12,
    risk_factors: null,
    notes: null,
    vigilance: 'standard',
    expires_at: null,
    dossier_status: 'verified',
    source_of_funds_type: 'mixed',
    source_of_funds_description: 'Épargne + crédit hypothécaire.',
    source_of_funds_doc_id: 'd-2',
    ai_analysis: null,
    contact: { first_name: 'Marie', last_name: 'Dubois' },
    checklist: [
      { id: 'i1', kyc_case_id: 'k', label: '', category: 'id', is_required: true, is_completed: true, document_id: 'd-1', notes: null, completed_at: T0, completed_by: 'p-sophie' },
      { id: 'i2', kyc_case_id: 'k', label: '', category: 'address', is_required: true, is_completed: false, document_id: null, notes: null, completed_at: null, completed_by: null },
      { id: 'i3', kyc_case_id: 'k', label: '', category: 'pep', is_required: true, is_completed: true, document_id: null, notes: null, completed_at: T0, completed_by: null },
      { id: 'i4', kyc_case_id: 'k', label: '', category: 'sanctions', is_required: true, is_completed: true, document_id: null, notes: null, completed_at: T0, completed_by: null },
      { id: 'i5', kyc_case_id: 'k', label: '', category: 'funds', is_required: true, is_completed: true, document_id: null, notes: null, completed_at: T0, completed_by: 'p-sophie' },
    ],
    ...over,
  }
}

function doc(id: string, over: Partial<KycDocument> = {}): KycDocument {
  return {
    id, agency_id: 'agency-a', kyc_case_id: 'k', transaction_id: null, contact_id: null, property_id: null,
    name: `${id}.pdf`, type: 'kyc', storage_path: `k/${id}.pdf`, size_bytes: 1024, uploaded_by: null,
    status: 'validated', created_at: T0, issued_at: null, expires_at: null, document_category: 'identity',
    sha256_hash: id.padEnd(64, '0'), ...over,
  }
}

const base = (over: Partial<Parameters<typeof buildPdfReportData>[0]> = {}) => ({
  dossier: dossier(),
  documents: [doc('d-1'), doc('d-2', { name: 'attestation_ubs.pdf', document_category: 'financial' })],
  auditEvents: [],
  agentName: 'Agent Demandeur',
  agencyName: 'MEGGA',
  transactionAmount: null,
  transactionRef: null,
  propertyLabel: 'Villa Cologny',
  validatedByName: 'Sophie Marchand',
  screeningDecisions: [],
  integrityHash: 'ab'.repeat(32),
  ...over,
})

describe('Rapport KYC — view-model', () => {
  it('la référence vient de l’UUID et de l’année d’ouverture, comme le nom du fichier WhatsApp', () => {
    const d = buildPdfReportData(base())
    expect(d.reference).toBe('KYC-2026-AB3F')
    expect(d.transaction.reference).toBe('M-2026-AB3F')
  })

  it('une ligne par liste, un statut par source — et « adverse media » porte le pire des deux', () => {
    const clear = buildPdfReportData(base())
    expect(clear.screening_rows.map((r) => r.status)).toEqual(['clear', 'clear', 'clear', 'clear', 'clear', 'clear'])

    const hit = buildPdfReportData(base({ dossier: dossier({ pep_status: 'clear', sanctions_status: 'match' }) }))
    expect(hit.screening_rows.find((r) => r.key === 'pep')?.status).toBe('clear')
    for (const key of ['ofac', 'seco', 'eu', 'un'] as const) {
      expect(hit.screening_rows.find((r) => r.key === key)?.status, key).toBe('match')
    }
    expect(hit.screening_rows.find((r) => r.key === 'adverseMedia')?.status).toBe('match')

    const unknown = buildPdfReportData(base({ dossier: dossier({ pep_status: 'not_checked', sanctions_status: 'pending' }) }))
    expect(unknown.screening_rows.find((r) => r.key === 'adverseMedia')?.status).toBe('pending')
  })

  it('le nom qui signe est celui du validateur, jamais celui du demandeur — et rien tant que rien n’est validé', () => {
    const validated = buildPdfReportData(base())
    expect(validated.validated_by).toBe('Sophie Marchand')
    // Validateur inconnu (profil supprimé) : on retombe sur l'agent, pas sur un UUID.
    expect(buildPdfReportData(base({ validatedByName: null })).validated_by).toBe('Agent Demandeur')
    const pending = buildPdfReportData(base({ dossier: dossier({ validated_at: null, validated_by: null }), validatedByName: null }))
    expect(pending.validated_by).toBeNull()
    expect(pending.validated_at).toBeNull()
  })

  it('la pièce de la source des fonds est le document lié, la conservation court dix ans', () => {
    const d = buildPdfReportData(base())
    expect(d.source_of_funds.document_name).toBe('attestation_ubs.pdf')
    expect(d.retention_until).toBe('2036-05-18T12:38:00.000Z')
    expect(d.documents_total).toBe(2)
  })

  it('un contrôle non fait n’a ni date ni auteur ; le screening est l’œuvre du système', () => {
    const d = buildPdfReportData(base())
    const byKey = Object.fromEntries(d.lba_checks.map((c) => [c.key, c]))
    expect(byKey.address?.agent).toBe('—')
    expect(byKey.address?.date).toBeNull()
    expect(byKey.pep?.agent).toBe('kyc:report.agent.dilisense')
    expect(byKey.id?.justificatif).toBe('d-1.pdf') // le document lié, pas la nature attendue
  })

  it('l’analyse contextuelle est absente tant que le dossier n’en porte pas ; sinon la confiance est bornée', () => {
    expect(buildPdfReportData(base()).ai_analysis).toBeNull()
    const ai = buildPdfReportData(base({
      dossier: dossier({
        ai_analysis: {
          provider: 'x', analyzed_at: T0, qualitative_risk: 'low', vigilance_recommendation: 'standard',
          patterns_detected: ['a', 'b'], justification: 'RAS.', additional_checks_suggested: [], confidence: 1.4,
        },
      }),
    })).ai_analysis
    expect(ai?.confidence_pct).toBe(100)
    expect(ai?.patterns_count).toBe(2)
  })

  it('au-delà de MAX_DOC_ROWS pièces, la page 3 le dit au lieu de couper', () => {
    const many = Array.from({ length: MAX_DOC_ROWS + 5 }, (_, i) => doc(`d-${i}`))
    const d = buildPdfReportData(base({ documents: many }))
    expect(d.documents).toHaveLength(MAX_DOC_ROWS)
    expect(d.documents_total).toBe(MAX_DOC_ROWS + 5)
  })

  it('les décisions humaines deviennent l’examen complémentaire, avec un nom lisible', () => {
    const d = buildPdfReportData(base({
      screeningDecisions: [
        { target: 'sanctions', decision: 'false_positive', justification: 'Homonymie établie sur date de naissance.', decided_at: T0, decided_by_name: null },
      ],
    }))
    expect(d.complementary_reviews).toHaveLength(1)
    expect(d.complementary_reviews[0]?.verdict_label).toBe('kyc:report.decision.false_positive')
    expect(d.complementary_reviews[0]?.decided_by).toBe('kyc:report.agent.agent')
  })
})

describe('Rapport KYC — empreinte d’intégrité', () => {
  it('la forme canonique ne dépend pas de l’ordre des lignes rendues par la base', () => {
    const a = kycIntegrityCanonical(dossier(), [doc('d-1'), doc('d-2')])
    const b = kycIntegrityCanonical(
      dossier({ checklist: [...dossier().checklist].reverse() }),
      [doc('d-2'), doc('d-1')],
    )
    expect(a).toBe(b)
  })

  it('un vrai SHA-256 : 64 hex, stable, et changé par la moindre pièce', async () => {
    const h1 = await computeKycIntegrityHash(dossier(), [doc('d-1')])
    const h2 = await computeKycIntegrityHash(dossier(), [doc('d-1')])
    const h3 = await computeKycIntegrityHash(dossier(), [doc('d-1', { sha256_hash: 'f'.repeat(64) })])
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
    expect(h1).toBe(h2)
    expect(h3).not.toBe(h1)
    // Les libellés et la langue n'entrent pas dans l'empreinte — seule la matière.
    const h4 = await computeKycIntegrityHash(dossier({ notes: 'note interne modifiée' }), [doc('d-1')])
    expect(h4).toBe(h1)
  })
})
