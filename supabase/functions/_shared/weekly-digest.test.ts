import { describe, it, expect } from 'vitest'
import {
  weekActivityTotal, isQuietWeek, formatCHF, buildDigestSnapshot,
  fallbackDigest, digestPrompt, digestHtml, type WeeklyCounts,
} from './weekly-digest'

const counts = (over: Partial<WeeklyCounts> = {}): WeeklyCounts => ({
  dealsMoved: 3, newContacts: 5, visitsDone: 2, kycEvents: 1,
  radarSignals: 4, activeDeals: 12, activePipelineValue: 4500000, ...over,
})

describe('seuil de silence', () => {
  it('semaine avec activité → pas silencieuse', () => {
    expect(isQuietWeek(counts())).toBe(false)
  })
  it('zéro activité ET zéro signal → silencieuse', () => {
    expect(isQuietWeek(counts({ dealsMoved: 0, newContacts: 0, visitsDone: 0, kycEvents: 0, radarSignals: 0 }))).toBe(true)
  })
  it('zéro activité mais signaux ouverts → PAS silencieuse (il y a à dire)', () => {
    expect(isQuietWeek(counts({ dealsMoved: 0, newContacts: 0, visitsDone: 0, kycEvents: 0, radarSignals: 2 }))).toBe(false)
  })
  it('weekActivityTotal exclut les instantanés (dossiers actifs, valeur)', () => {
    expect(weekActivityTotal(counts())).toBe(3 + 5 + 2 + 1)
  })
})

describe('formatCHF (apostrophe suisse)', () => {
  it('formate avec apostrophes', () => {
    expect(formatCHF(4500000)).toBe("CHF 4'500'000")
    expect(formatCHF(720000)).toBe("CHF 720'000")
  })
})

describe('snapshot & prompt — aucune PII (chiffres uniquement)', () => {
  it('buildDigestSnapshot ne contient que des chiffres/labels agrégés', () => {
    const s = buildDigestSnapshot(counts())
    expect(s).toContain('Dossiers qui ont bougé dans le pipeline : 3')
    expect(s).toContain('Signaux à traiter')
    expect(s).toContain("CHF 4'500'000")
    // pas de champ nominatif
    expect(s.toLowerCase()).not.toContain('nom')
  })
  it('digestPrompt interdit d\'inventer et impose 4-6 phrases', () => {
    const p = digestPrompt(buildDigestSnapshot(counts()))
    expect(p).toMatch(/n'invente aucun chiffre, aucun nom/i)
    expect(p).toMatch(/4 à 6 phrases/)
  })
})

describe('fallback déterministe', () => {
  it('mentionne l\'activité, les signaux et la valeur pipeline', () => {
    const f = fallbackDigest(counts())
    expect(f).toContain('3 dossier(s) ont avancé')
    expect(f).toContain('4 signal(aux)')
    expect(f).toContain("CHF 4'500'000")
  })
  it('sans signal, pas de phrase « attention »', () => {
    const f = fallbackDigest(counts({ radarSignals: 0 }))
    expect(f).not.toContain('attendent ton attention')
  })
})

describe('digestHtml', () => {
  it('échappe le HTML et met les retours à la ligne', () => {
    const h = digestHtml('Ligne 1\nLigne <2> & fin', 'Semaine test')
    expect(h).toContain('Ligne 1<br>Ligne &lt;2&gt; &amp; fin')
    expect(h).toContain('MEGGA AI')
    expect(h).toContain('Semaine test')
    expect(h).toContain('désabonner')
  })
})
