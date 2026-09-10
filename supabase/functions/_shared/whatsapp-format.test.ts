import { describe, it, expect } from 'vitest'
import { toWhatsAppText, formatOutboundText, firstListingPhotoUrl } from './whatsapp-format'
import { meggaProse } from './megga-prose'

describe('toWhatsAppText', () => {
  it('convertit le gras Markdown **x** en gras WhatsApp *x*', () => {
    expect(toWhatsAppText('Voici **Phil Dubois**, lead chaud')).toBe('Voici *Phil Dubois*, lead chaud')
    expect(toWhatsAppText('**A** et **B**')).toBe('*A* et *B*')
  })
  it('convertit les titres Markdown en gras', () => {
    expect(toWhatsAppText('## Résumé')).toBe('*Résumé*')
    expect(toWhatsAppText('### Bien : Carouge')).toBe('*Bien : Carouge*')
  })
  it('nettoie les étoiles doubles résiduelles', () => {
    expect(toWhatsAppText('texte ** cassé')).toBe('texte * cassé')
  })
  it('laisse intact un texte déjà propre', () => {
    expect(toWhatsAppText('Visite planifiée pour *Sarah* mardi.')).toBe('Visite planifiée pour *Sarah* mardi.')
    expect(toWhatsAppText('Liste:\n- un\n- deux')).toBe('Liste:\n- un\n- deux')
  })
  it('gère le vide', () => {
    expect(toWhatsAppText('')).toBe('')
    expect(toWhatsAppText(null)).toBe('')
    expect(toWhatsAppText(undefined)).toBe('')
  })
})

describe('formatOutboundText', () => {
  it('compose meggaProse PUIS toWhatsAppText, dans cet ordre', () => {
    // meggaProse tourne d'abord le tiret cadratin-puce en « - » ; toWhatsAppText convertit
    // ENSUITE le gras Markdown résiduel en gras WhatsApp. L'ordre inverse laisserait le tiret
    // cadratin intact (toWhatsAppText ne le connaît pas).
    expect(formatOutboundText('— **x**')).toBe('- *x*')
  })
  it('égale toujours toWhatsAppText(meggaProse(s)) — l’invariant partagé par la garde et le découpage', () => {
    const s = 'Le bien fait 80—120 m² · vue lac — à visiter vite. **Prix négociable**.'
    expect(formatOutboundText(s)).toBe(toWhatsAppText(meggaProse(s)))
  })
  it('gère le vide comme toWhatsAppText', () => {
    expect(formatOutboundText('')).toBe('')
    expect(formatOutboundText(null)).toBe('')
    expect(formatOutboundText(undefined)).toBe('')
  })
})

describe('firstListingPhotoUrl', () => {
  it('préfère la variante R2 detail (market_listings.photos_cf)', () => {
    expect(firstListingPhotoUrl({
      photos_cf: [{ detail: 'https://img.getmegga.com/a/detail.jpg', hero: 'https://img.getmegga.com/a/hero.jpg' }],
      photos: ['https://cdn.flatfox.ch/a.jpg'],
    })).toBe('https://img.getmegga.com/a/detail.jpg')
  })
  it('replie sur hero puis thumb si detail manque', () => {
    expect(firstListingPhotoUrl({ photos_cf: [{ hero: 'https://img.getmegga.com/a/hero.jpg' }] }))
      .toBe('https://img.getmegga.com/a/hero.jpg')
    expect(firstListingPhotoUrl({ photos_cf: [{ thumb: 'https://img.getmegga.com/a/thumb.jpg' }] }))
      .toBe('https://img.getmegga.com/a/thumb.jpg')
  })
  it('replie sur photos[0] sans miroir R2 (properties.photos, Flatfox non traité)', () => {
    expect(firstListingPhotoUrl({ photos: ['https://cdn.flatfox.ch/a.jpg', 'https://cdn.flatfox.ch/b.jpg'] }))
      .toBe('https://cdn.flatfox.ch/a.jpg')
    expect(firstListingPhotoUrl({ photos_cf: null, photos: ['https://cdn.flatfox.ch/a.jpg'] }))
      .toBe('https://cdn.flatfox.ch/a.jpg')
  })
  it('rejette le non-https et le vide', () => {
    expect(firstListingPhotoUrl({ photos: ['http://insecure.example/a.jpg'] })).toBeNull()
    expect(firstListingPhotoUrl({ photos: [] })).toBeNull()
    expect(firstListingPhotoUrl({})).toBeNull()
  })
  it('requireHost : ne relaie QUE notre hôte R2 (repli source tiers écarté)', () => {
    // photos_cf hébergé chez nous → passe
    expect(firstListingPhotoUrl(
      { photos_cf: [{ detail: 'https://img.getmegga.com/a/detail.jpg' }] },
      { requireHost: 'img.getmegga.com' },
    )).toBe('https://img.getmegga.com/a/detail.jpg')
    // uploads agents (properties.photos sur notre R2) → passent aussi
    expect(firstListingPhotoUrl(
      { photos: ['https://img.getmegga.com/prop/0.jpg'] },
      { requireHost: 'img.getmegga.com' },
    )).toBe('https://img.getmegga.com/prop/0.jpg')
    // repli source tiers (Flatfox) → écarté (le bien partira en texte seul)
    expect(firstListingPhotoUrl(
      { photos: ['https://cdn.flatfox.ch/a.jpg'] },
      { requireHost: 'img.getmegga.com' },
    )).toBeNull()
    // hôte sosie (défense contre un suffixe trompeur)
    expect(firstListingPhotoUrl(
      { photos: ['https://img.getmegga.com.attacker.example/a.jpg'] },
      { requireHost: 'img.getmegga.com' },
    )).toBeNull()
  })
  it('requireHost tableau : R2 + Storage Supabase autorisés, tiers écarté', () => {
    const hosts = ['img.getmegga.com', 'eayczugyrvmtqnnmvjod.supabase.co']
    // upload agent miroir-échoué, resté sur le Storage Supabase (notre infra) → passe
    expect(firstListingPhotoUrl(
      { photos: ['https://eayczugyrvmtqnnmvjod.supabase.co/storage/v1/object/public/property-photos/x.jpg'] },
      { requireHost: hosts },
    )).toBe('https://eayczugyrvmtqnnmvjod.supabase.co/storage/v1/object/public/property-photos/x.jpg')
    // R2 → passe
    expect(firstListingPhotoUrl(
      { photos_cf: [{ detail: 'https://img.getmegga.com/p/0.jpg' }] },
      { requireHost: hosts },
    )).toBe('https://img.getmegga.com/p/0.jpg')
    // Flatfox tiers → écarté
    expect(firstListingPhotoUrl(
      { photos: ['https://cdn.flatfox.ch/a.jpg'] },
      { requireHost: hosts },
    )).toBeNull()
  })
  it('requireHost null/absent : comportement historique (https seul)', () => {
    expect(firstListingPhotoUrl(
      { photos: ['https://cdn.flatfox.ch/a.jpg'] },
      { requireHost: null },
    )).toBe('https://cdn.flatfox.ch/a.jpg')
  })
})
