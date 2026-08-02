// Unitaire — composition du digest quotidien des dossiers KYB en attente de revue.
//
// CE QUI EST EN JEU. L'audit du 01.08.2026 : 100 % des dossiers exigent un passage humain
// (le véto id_document n'accepte que 'match' et aucun connecteur ne le produit), et rien
// n'allait chercher ce relecteur. Un client réel pouvait soumettre et attendre indéfiniment
// un examen que personne ne savait devoir faire.

import { describe, it, expect } from 'vitest'
import { buildReviewDigest, digestSubject, type PendingDossier } from '../../supabase/functions/_shared/kyb-review-digest'

const dossier = (over: Partial<PendingDossier> = {}): PendingDossier => ({
  agency_id: '11111111-1111-1111-1111-111111111111',
  agency_name: 'Agence Test SA',
  country: 'CH',
  score: null,
  submitted_at: '2026-08-01T10:00:00Z',
  age_days: 0,
  ...over,
})

describe('buildReviewDigest', () => {
  it('rien à signaler = aucun courriel — un digest quotidien vide se fait ignorer, puis filtrer', () => {
    expect(buildReviewDigest({ dossiers: [], appUrl: 'https://app.megga.ch' })).toBeNull()
  })

  it('nomme chaque dossier et son ancienneté', () => {
    const out = buildReviewDigest({
      dossiers: [dossier({ agency_name: 'Regie du Lac SA', age_days: 6 })],
      appUrl: 'https://app.megga.ch',
    })
    expect(out).not.toBeNull()
    expect(out!.html).toContain('Regie du Lac SA')
    expect(out!.html).toContain('6')
  })

  it('mene droit a la file, jamais a la racine de la console', () => {
    const out = buildReviewDigest({ dossiers: [dossier()], appUrl: 'https://app.megga.ch' })
    expect(out!.html).toContain('https://app.megga.ch/dashboard/admin/kyb-review')
  })

  it('echappe le nom d\'agence — texte libre saisi a l\'inscription, rendu dans du HTML', () => {
    const out = buildReviewDigest({
      dossiers: [dossier({ agency_name: '<script>alert(1)</script>' })],
      appUrl: 'https://app.megga.ch',
    })
    expect(out!.html).not.toContain('<script>')
    expect(out!.html).toContain('&lt;script&gt;')
  })

  it('un score absent se lit « non calcule », jamais « 0 » — la nuance decide de la priorite', () => {
    const out = buildReviewDigest({ dossiers: [dossier({ score: null })], appUrl: 'https://app.megga.ch' })
    expect(out!.html).not.toMatch(/>\s*0\s*</)
    expect(out!.html).toContain('non calcule')
  })
})

describe('digestSubject', () => {
  it('porte le nombre ET l\'anciennete du plus vieux : c\'est ce qui fait ouvrir ou non', () => {
    expect(digestSubject(1, 0)).toBe('Revue KYB : 1 dossier en attente')
    expect(digestSubject(3, 6)).toBe('Revue KYB : 3 dossiers en attente, le plus ancien depuis 6 jours')
  })

  it('un seul jour se dit au singulier', () => {
    expect(digestSubject(2, 1)).toBe('Revue KYB : 2 dossiers en attente, le plus ancien depuis 1 jour')
  })
})
