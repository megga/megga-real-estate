// Unit test (pur, Node/Vitest) — kyc-screening : logique métier extraite.
// Couvre le cœur jusqu'ici NON testé de l'edge function kyc-screening :
//   - partitionDilisenseHits : parsing réponse Dilisense → statut PEP/sanctions
//     match/clear + détails (slice 0,5, total réel).
//   - calculateRiskScore : barème LBA 5 axes (GAFI, PEP, montant, entité, docs).
// Fige tous les seuils compliance pour empêcher une dérive silencieuse au refacto.
//
// NE teste PAS (déjà couvert / I/O) : verrou screening_status (kyc-screening-lock),
// garde dossier_status='verified' (kyc-verified-guard), shell 401/CORS
// (edge-functions), appels Dilisense/Anthropic (I/O), persistance kyc_cases
// (plumbing DB trivial — le helper est pur, sans DB).

import { describe, it, expect } from 'vitest'
import { partitionDilisenseHits, calculateRiskScore } from './kyc-screening-core'

describe('kyc-screening — partition Dilisense (pur)', () => {
  it('hit SANCTION → sanctionsStatus=match, pepStatus=clear', () => {
    const r = partitionDilisenseHits([
      { source_type: 'SANCTION', name: 'Bad Actor', source_id: 'ofac-1' },
    ])
    expect(r.sanctionsStatus).toBe('match')
    expect(r.pepStatus).toBe('clear')
    expect(r.sanctionsDetails).toEqual({ total: 1, records: [{ source_type: 'SANCTION', name: 'Bad Actor', source_id: 'ofac-1' }] })
    expect(r.pepDetails).toBeNull()
  })

  it('hit PEP seul → pepStatus=match, sanctionsStatus=clear', () => {
    const r = partitionDilisenseHits([{ source_type: 'PEP', name: 'Minister X', source_id: 'pep-9' }])
    expect(r.pepStatus).toBe('match')
    expect(r.sanctionsStatus).toBe('clear')
    expect(r.pepDetails?.total).toBe(1)
  })

  it('aucun hit → clear/clear, détails null', () => {
    const r = partitionDilisenseHits([])
    expect(r.pepStatus).toBe('clear')
    expect(r.sanctionsStatus).toBe('clear')
    expect(r.pepDetails).toBeNull()
    expect(r.sanctionsDetails).toBeNull()
  })

  it('found_records null/undefined → ne throw pas, clear/clear', () => {
    expect(partitionDilisenseHits(null).pepStatus).toBe('clear')
    expect(partitionDilisenseHits(undefined).sanctionsStatus).toBe('clear')
  })

  it('détails plafonnés à 5 enregistrements (slice 0,5), total réel conservé', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ source_type: 'PEP', name: `P${i}`, source_id: `id-${i}` }))
    const r = partitionDilisenseHits(many)
    expect(r.pepDetails?.total).toBe(8)
    expect(r.pepDetails?.records).toHaveLength(5)
  })

  it('source_type inconnu ignoré (ni PEP ni SANCTION)', () => {
    const r = partitionDilisenseHits([{ source_type: 'OTHER', name: 'Z', source_id: 'x' }])
    expect(r.pepStatus).toBe('clear')
    expect(r.sanctionsStatus).toBe('clear')
  })
})

describe('kyc-screening — barème de risque (pur)', () => {
  const base = { contactNationality: 'CH', pepMatch: false, transactionAmount: 0, kycType: 'buyer_pp', completionPct: 100 }

  it('profil suisse propre dossier complet → score bas (level low)', () => {
    const r = calculateRiskScore(base)
    expect(r.score).toBe(0)
    expect(r.level).toBe('low')
  })

  it('match PEP ajoute 25 pts (axe pep high)', () => {
    const r = calculateRiskScore({ ...base, pepMatch: true })
    expect(r.score).toBe(25)
    expect(r.factors.find((f) => f.id === 'pep')?.level).toBe('high')
  })

  it('nationalité GAFI haut risque (RU) = 25 pts (casse insensible)', () => {
    const r = calculateRiskScore({ ...base, contactNationality: 'ru' })
    expect(r.factors.find((f) => f.id === 'nationality')?.points).toBe(25)
  })

  it('nationalité surveillance renforcée (NG) = 15 pts', () => {
    const r = calculateRiskScore({ ...base, contactNationality: 'NG' })
    expect(r.factors.find((f) => f.id === 'nationality')?.points).toBe(15)
  })

  it('montant > 5M = 20 pts ; type _pm = 15 pts ; docs < 50% = 15 pts', () => {
    const r = calculateRiskScore({ contactNationality: 'CH', pepMatch: false, transactionAmount: 6_000_000, kycType: 'buyer_pm', completionPct: 30 })
    expect(r.factors.find((f) => f.id === 'amount')?.points).toBe(20)
    expect(r.factors.find((f) => f.id === 'entity')?.points).toBe(15)
    expect(r.factors.find((f) => f.id === 'docs')?.points).toBe(15)
  })

  it('seuils de niveau : >=40 high, >=20 medium, <20 low', () => {
    // PEP(25)+montant>2M(10) = 35 → medium
    expect(calculateRiskScore({ ...base, pepMatch: true, transactionAmount: 3_000_000 }).level).toBe('medium')
    // PEP(25)+GAFI(25) = 50 → high
    expect(calculateRiskScore({ ...base, pepMatch: true, contactNationality: 'IR' }).level).toBe('high')
  })

  it('exactement 5 facteurs (nationality, pep, amount, entity, docs)', () => {
    const ids = calculateRiskScore(base).factors.map((f) => f.id).sort()
    expect(ids).toEqual(['amount', 'docs', 'entity', 'nationality', 'pep'])
  })
})
