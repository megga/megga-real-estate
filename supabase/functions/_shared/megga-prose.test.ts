import { describe, it, expect } from 'vitest'
import { meggaProse, MEGGA_STYLE_BLOCK } from './megga-prose'

describe('meggaProse', () => {
  it('remplace le tiret cadratin en milieu de phrase par une virgule', () => {
    expect(meggaProse('Concis et actionnable — pas de remplissage')).toBe('Concis et actionnable, pas de remplissage')
    expect(meggaProse('offre—visite')).toBe('offre, visite')
    expect(meggaProse('a — b — c')).toBe('a, b, c')
  })

  it('gère le demi-cadratin (–) comme le cadratin', () => {
    expect(meggaProse('point clé – à retenir')).toBe('point clé, à retenir')
  })

  it('convertit les puces · • ● en début de ligne en tirets', () => {
    expect(meggaProse('· Relancer M. Dupont')).toBe('- Relancer M. Dupont')
    expect(meggaProse('• Préparer le KYC')).toBe('- Préparer le KYC')
    expect(meggaProse('  ● Confirmer la visite')).toBe('  - Confirmer la visite')
  })

  it('convertit un tiret long utilisé comme puce en début de ligne', () => {
    expect(meggaProse('— Visite confirmée')).toBe('- Visite confirmée')
  })

  it('PRÉSERVE le séparateur · inline (convention UI)', () => {
    expect(meggaProse('80 m² · 3 pièces')).toBe('80 m² · 3 pièces')
    expect(meggaProse('Genève · CHF 720\'000 · 120 m²')).toBe('Genève · CHF 720\'000 · 120 m²')
  })

  it('distingue puce en début de ligne et séparateur inline sur plusieurs lignes', () => {
    expect(meggaProse('Genève · 120 m²\n· Visite mardi')).toBe('Genève · 120 m²\n- Visite mardi')
  })

  it('normalise les plages de chiffres en trait d\'union', () => {
    expect(meggaProse('délai habituel 24–48h')).toBe('délai habituel 24-48h')
    expect(meggaProse('12 — 15 jours')).toBe('12-15 jours')
  })

  it('préserve le format suisse (apostrophe, m²)', () => {
    expect(meggaProse('CHF 720\'000 — au-dessus du marché')).toBe('CHF 720\'000, au-dessus du marché')
    expect(meggaProse('120 m² — lumineux')).toBe('120 m², lumineux')
  })

  it('nettoie les espaces et virgules résiduels', () => {
    expect(meggaProse('mot  ,  suite')).toBe('mot, suite')
    expect(meggaProse('trop  d\'espaces')).toBe('trop d\'espaces')
  })

  it('est idempotent', () => {
    const raw = '· Point un — détail\n· Point deux\n80 m² · 3 p'
    const once = meggaProse(raw)
    expect(meggaProse(once)).toBe(once)
  })

  it('gère le vide', () => {
    expect(meggaProse('')).toBe('')
    expect(meggaProse(null)).toBe('')
    expect(meggaProse(undefined)).toBe('')
  })

  it('laisse intact un texte déjà conforme', () => {
    const clean = 'Voici le point du jour.\n\nTrois priorités :\n1. Relancer M. Dupont.\n2. Préparer le KYC de Mme Favre.'
    expect(meggaProse(clean)).toBe(clean)
  })

  it('expose un bloc de style sans tells typographiques', () => {
    expect(MEGGA_STYLE_BLOCK).toContain('STYLE D\'ÉCRITURE MEGGA')
    // Le bloc cite — et • entre guillemets comme exemples à bannir : on vérifie
    // juste qu'il n'utilise pas de puce · / • en DÉBUT de ligne.
    for (const line of MEGGA_STYLE_BLOCK.split('\n')) {
      expect(/^[ \t]*[·•●]/.test(line)).toBe(false)
    }
  })
})
