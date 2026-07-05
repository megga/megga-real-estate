import { describe, it, expect } from 'vitest'
import { composeMorningBrief, zurichHour, zurichDayBoundsUtc, type MorningBriefData } from './morning-brief'

const FULL: MorningBriefData = {
  agentFullName: 'Gregory Lyonnet',
  visits: [
    { scheduledAt: '2026-07-05T08:00:00Z', who: 'Anne Dubois', propertyTitle: 'Les Vergers', city: 'Meyrin' },
    { scheduledAt: '2026-07-05T12:30:00Z', who: null, propertyTitle: null, city: 'Genève' },
  ],
  reminders: [
    { type: 'post_visit_feedback', who: 'Jean Martin' },
    { type: 'missing_document', who: null },
    { type: 'type_inconnu_futur', who: 'X' },
  ],
  offers: [{ amount: 1450000, byLabel: 'M. Keller', expiresAt: '2026-07-07T10:00:00Z' }],
  sellerLeads: [{ contactName: 'Marie Curie', city: 'Carouge', estimationMedian: 1250000 }],
}

describe('composeMorningBrief', () => {
  it('compose le brief complet FR (prénom, sections, CHF apostrophe, heure Zurich)', () => {
    const text = composeMorningBrief(FULL, 'fr')!
    expect(text).toContain('Bonjour Gregory, ta journée :')
    expect(text).toContain('**Visites (2)**')
    // 08:00 UTC en juillet = 10:00 à Zurich (CEST)
    expect(text).toContain('- 10:00 · Anne Dubois · Les Vergers, Meyrin')
    // visite sans nom ni titre : l'heure et la ville seulement
    expect(text).toContain('- 14:30 · Genève')
    expect(text).toContain('**À relancer (3)**')
    expect(text).toContain('- Retour de visite : Jean Martin')
    expect(text).toContain('- Document manquant')
    // type inconnu → repli sur le label générique
    expect(text).toContain('- Rappel : X')
    expect(text).toContain("- CHF 1'450'000 (M. Keller) · expire le 07.07")
    expect(text).toContain("- Marie Curie · Carouge · est. CHF 1'250'000")
    expect(text).toContain('Réponds « brief »')
  })

  it('compose en EN quand lang=en', () => {
    const text = composeMorningBrief(FULL, 'en')!
    expect(text).toContain('Good morning Gregory, your day:')
    expect(text).toContain('**Visits (2)**')
    expect(text).toContain('- Visit feedback: Jean Martin')
    expect(text).toContain('expires 07.07')
    expect(text).toContain('Reply "brief"')
  })

  it('retourne null quand la journée est vide (pas de brief creux)', () => {
    expect(composeMorningBrief({
      agentFullName: 'Gregory Lyonnet', visits: [], reminders: [], offers: [], sellerLeads: [],
    })).toBeNull()
  })

  it('omet les sections vides', () => {
    const text = composeMorningBrief({ ...FULL, reminders: [], offers: [], sellerLeads: [] })!
    expect(text).toContain('**Visites (2)**')
    expect(text).not.toContain('À relancer')
    expect(text).not.toContain('Offres')
    expect(text).not.toContain('leads vendeurs')
  })

  it('plafonne l\'affichage et résume le reste en « …et N autres »', () => {
    const reminders = Array.from({ length: 7 }, (_, i) => ({ type: 'custom', who: `Contact ${i}` }))
    const text = composeMorningBrief({ ...FULL, reminders })!
    expect(text).toContain('**À relancer (7)**')
    expect(text).toContain('- Rappel : Contact 4')
    expect(text).not.toContain('Contact 5')
    expect(text).toContain('…et 2 autres')
    // singulier quand il ne reste qu'un élément
    const six = composeMorningBrief({ ...FULL, reminders: reminders.slice(0, 6) })!
    expect(six).toContain('…et 1 autre')
    expect(six).not.toContain('1 autres')
  })

  it('affiche « N+ » et « …et d\'autres » quand le fetch a atteint sa limite SQL (total réel inconnu)', () => {
    // 20 = SQL_LIMITS.reminders : le total réel peut dépasser, le compte exact serait un mensonge.
    const reminders = Array.from({ length: 20 }, (_, i) => ({ type: 'custom', who: `Contact ${i}` }))
    const text = composeMorningBrief({ ...FULL, reminders })!
    expect(text).toContain('**À relancer (20+)**')
    expect(text).toContain('…et d\'autres')
    expect(text).not.toContain('…et 15 autres')
    const en = composeMorningBrief({ ...FULL, reminders }, 'en')!
    expect(en).toContain('**To follow up (20+)**')
    expect(en).toContain('…and more')
  })

  it('salue sans prénom quand full_name est absent', () => {
    const text = composeMorningBrief({ ...FULL, agentFullName: null })!
    expect(text).toContain('Bonjour, ta journée :')
  })
})

describe('zurichHour', () => {
  it('convertit UTC → heure locale Zurich, DST inclus', () => {
    expect(zurichHour(new Date('2026-07-05T05:30:00Z'))).toBe(7)  // été : UTC+2
    expect(zurichHour(new Date('2026-07-05T06:30:00Z'))).toBe(8)  // tick jumeau été
    expect(zurichHour(new Date('2026-01-10T06:30:00Z'))).toBe(7)  // hiver : UTC+1
    expect(zurichHour(new Date('2026-01-10T05:30:00Z'))).toBe(6)  // tick jumeau hiver
  })
})

describe('zurichDayBoundsUtc', () => {
  it('borne la journée locale Zurich en UTC (été)', () => {
    const b = zurichDayBoundsUtc(new Date('2026-07-05T05:30:00Z'))
    expect(b.startIso).toBe('2026-07-04T22:00:00.000Z')
    expect(b.endIso).toBe('2026-07-05T22:00:00.000Z')
    expect(b.dateKey).toBe('2026-07-05')
  })

  it('borne la journée locale Zurich en UTC (hiver)', () => {
    const b = zurichDayBoundsUtc(new Date('2026-01-10T06:30:00Z'))
    expect(b.startIso).toBe('2026-01-09T23:00:00.000Z')
    expect(b.endIso).toBe('2026-01-10T23:00:00.000Z')
    expect(b.dateKey).toBe('2026-01-10')
  })

  it('rattache un début de soirée UTC au lendemain local (23:30 Zurich = même jour, 23:30 UTC = lendemain)', () => {
    const b = zurichDayBoundsUtc(new Date('2026-07-04T23:30:00Z')) // 01:30 le 5 juillet à Zurich
    expect(b.dateKey).toBe('2026-07-05')
  })
})
