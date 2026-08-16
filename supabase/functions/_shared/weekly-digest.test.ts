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
  const TABLEAU_DE_BORD = 'https://app.megga.ch/dashboard'

  it('échappe le HTML et met les retours à la ligne', () => {
    const h = digestHtml('Ligne 1\nLigne <2> & fin', 'Semaine test', TABLEAU_DE_BORD)
    expect(h).toContain('Ligne 1<br />Ligne &lt;2&gt; &amp; fin')
    expect(h).toContain('Semaine test')
    // La désinscription se dit toujours, désormais dans la mention de pied.
    expect(h).toContain('préférences dans MEGGA')
  })

  /**
   * ⛔ LA CLAUSE QUI MANQUAIT, ET QUI A COÛTÉ UN GABARIT ENTIER.
   *
   * Ce bilan a traversé la migration des treize e-mails sans être vu : il rendait un
   * `<div>` autonome, donc ni `<!DOCTYPE>` ni `<html>`, et `check-email-shell.mjs`
   * cherchait exactement ces deux marqueurs. La porte annonçait « Migration
   * terminée » pendant que les agents recevaient chaque vendredi le dernier design
   * d'avant MEGGA X.
   *
   * On mesure donc ici ce que la porte ne pouvait pas voir : le rendu est un
   * DOCUMENT COMPLET, et il ne porte plus la police système que la coquille bannit.
   */
  it('⛔ passe par la coquille commune, pas par un fragment', () => {
    const h = digestHtml('Bilan', 'Semaine test', TABLEAU_DE_BORD)
    expect(h).toMatch(/^<!DOCTYPE html/)
    expect(h).toContain('<html')
    expect(h).not.toContain('system-ui')
  })

  it('le lien du tableau de bord vient de l’appelant, jamais d’une adresse en dur', () => {
    const h = digestHtml('Bilan', 'Semaine test', 'https://exemple.test/dashboard')
    expect(h).toContain('https://exemple.test/dashboard')
    expect(h).not.toContain('https://app.megga.ch/dashboard')
  })
})
