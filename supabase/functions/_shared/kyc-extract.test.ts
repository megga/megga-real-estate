import { describe, it, expect } from 'vitest'
import {
  parseKycOcr, deriveKycType, kycTypeToEntityType, kycCategoryMaps, KYC_DOC_PROMPT,
  KYC_REPORT_PROMPT, normalizeKycReport,
} from './kyc-extract'

describe('deriveKycType', () => {
  it('seller/landlord → seller, sinon buyer', () => {
    expect(deriveKycType('seller', 'pp')).toBe('seller_pp')
    expect(deriveKycType('landlord', 'pm')).toBe('seller_pm')
    expect(deriveKycType('buyer', 'pp')).toBe('buyer_pp')
    expect(deriveKycType('tenant', 'pm')).toBe('buyer_pm')
    expect(deriveKycType('investor', null)).toBe('buyer_pp') // entity null → pp
    expect(deriveKycType(null, 'pm')).toBe('buyer_pm')
  })
})

describe('kycTypeToEntityType', () => {
  it('_pm → entity, sinon individual', () => {
    expect(kycTypeToEntityType('buyer_pm')).toBe('entity')
    expect(kycTypeToEntityType('seller_pm')).toBe('entity')
    expect(kycTypeToEntityType('buyer_pp')).toBe('individual')
    expect(kycTypeToEntityType('seller_pp')).toBe('individual')
  })
})

describe('kycCategoryMaps', () => {
  it('mappe identity/address/funds vers checklist/upload/document', () => {
    expect(kycCategoryMaps('identity')).toEqual({ checklist: 'id', upload: 'identity', document: 'identity' })
    expect(kycCategoryMaps('address')).toEqual({ checklist: 'address', upload: 'address', document: 'domicile' })
    expect(kycCategoryMaps('funds')).toEqual({ checklist: 'funds', upload: 'funds', document: 'financial' })
  })
  it('retourne null pour une catégorie hors documents (pep/sanctions/inconnu)', () => {
    expect(kycCategoryMaps('pep')).toBeNull()
    expect(kycCategoryMaps('zzz')).toBeNull()
  })
})

describe('parseKycOcr', () => {
  it('parse un bloc JSON propre', () => {
    const out = parseKycOcr('{"nom":"Vaucher","prenom":"Enora","numero":"X123","expiration":"2028-08"}')
    expect(out).toMatchObject({ nom: 'Vaucher', prenom: 'Enora', numero: 'X123' })
  })
  it('extrait le JSON même entouré de texte/markdown', () => {
    const out = parseKycOcr('Voici les champs:\n```json\n{"montant":"850000","devise":"CHF"}\n```\nmerci')
    expect(out).toEqual({ montant: '850000', devise: 'CHF' })
  })
  it('retourne {} (jamais throw) sur texte non-JSON', () => {
    expect(parseKycOcr('aucune donnée lisible')).toEqual({})
    expect(parseKycOcr('')).toEqual({})
    expect(parseKycOcr(null)).toEqual({})
  })
  it('ignore un JSON non-objet (array, scalaire)', () => {
    expect(parseKycOcr('[1,2,3]')).toEqual({})
    expect(parseKycOcr('"juste une string"')).toEqual({})
  })
})

describe('KYC_DOC_PROMPT', () => {
  it('demande une sortie JSON stricte', () => {
    expect(KYC_DOC_PROMPT).toMatch(/JSON/)
  })
})

describe('KYC_REPORT_PROMPT', () => {
  it('cible les 3 contrôles couverts par un rapport externe', () => {
    expect(KYC_REPORT_PROMPT).toMatch(/JSON/)
    expect(KYC_REPORT_PROMPT).toMatch(/identite/)
    expect(KYC_REPORT_PROMPT).toMatch(/pep/)
    expect(KYC_REPORT_PROMPT).toMatch(/sanctions/)
  })
})

describe('normalizeKycReport', () => {
  it('mappe un rapport complet clear vers 3 contrôles + 2 pièces restantes', () => {
    const out = normalizeKycReport({
      fournisseur: 'Persona',
      date: '2026-07-11',
      identite: 'verifie',
      pep: 'aucun',
      sanctions: 'aucun',
    })
    expect(out.provider).toBe('Persona')
    expect(out.reportDate).toBe('2026-07-11')
    expect(out.checks).toEqual([
      { key: "Pièce d'identité", result: 'Vérifiée' },
      { key: 'Screening PEP', result: '0 correspondance' },
      { key: 'Sanctions', result: '0 correspondance' },
    ])
    expect(out.missing).toEqual(['Justificatif de domicile', 'Source des fonds'])
  })

  it('signale une correspondance PEP/sanctions à examiner', () => {
    const out = normalizeKycReport({ identite: 'verifie', pep: 'correspondance', sanctions: 'aucun' })
    expect(out.checks).toContainEqual({ key: 'Screening PEP', result: 'Correspondance à examiner' })
  })

  it('omet les contrôles non couverts (absent) et n\'invente rien', () => {
    const out = normalizeKycReport({ identite: 'verifie', pep: 'absent', sanctions: 'absent' })
    expect(out.checks).toEqual([{ key: "Pièce d'identité", result: 'Vérifiée' }])
    expect(out.provider).toBeNull()
  })

  it('rapport vide → aucun contrôle', () => {
    expect(normalizeKycReport({}).checks).toEqual([])
  })
})
