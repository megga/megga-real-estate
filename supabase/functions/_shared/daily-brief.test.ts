import { describe, it, expect } from 'vitest'
import { buildBriefSnapshot, type BriefFocusRow } from './daily-brief'
import { createPseudonymizer } from './pseudonymize'

const focusRow = (over: Partial<BriefFocusRow>): BriefFocusRow => ({
  contact_id: 'c1', contact_name: 'Jean Dupont', score: 82, lead_score: 71,
  reason_keys: ['zone', 'budget'], property_title: '3.5p Carouge', property_price: 1250000,
  city: 'Carouge', kyc_risk_high: true, kyc_days_to_expiry: 5, ...over,
})

describe('buildBriefSnapshot — invariant PII', () => {
  it('aucun nom réel de la file Focus ne subsiste dans le snapshot', () => {
    const pseudo = createPseudonymizer()
    const { snapshot } = buildBriefSnapshot({
      focus: [focusRow({ contact_name: 'Jean Dupont' }), focusRow({ contact_id: 'c2', contact_name: 'Sarah Meyer' })],
      cockpit: {}, objectif: {}, reminderTypes: [], pseudo,
    })
    expect(snapshot).not.toContain('Jean Dupont')
    expect(snapshot).not.toContain('Sarah Meyer')
    expect(snapshot).toContain('{{C1}}')
    expect(pseudo.restore(snapshot)).toContain('Jean Dupont')
  })

  it('un TITRE de bien contenant un nom (texte libre agent) est tokenisé, jamais en clair', () => {
    const pseudo = createPseudonymizer()
    const { snapshot } = buildBriefSnapshot({
      focus: [focusRow({ contact_name: 'Anne Favre', property_title: 'Villa de M. et Mme Rochat' })],
      cockpit: {}, objectif: {}, reminderTypes: [], pseudo,
    })
    expect(snapshot).not.toContain('Rochat')     // nom du vendeur dans le titre
    expect(snapshot).not.toContain('Anne Favre') // nom du contact
    expect(snapshot).toContain('à Carouge')      // la commune (non-PII) reste
    // restauration : l'agent revoit le vrai titre
    expect(pseudo.restore(snapshot)).toContain('Villa de M. et Mme Rochat')
  })

  it('retire contributors (noms d’acheteurs) des agrégats cockpit', () => {
    const pseudo = createPseudonymizer()
    const { snapshot } = buildBriefSnapshot({
      focus: [],
      cockpit: {
        projected: 180000, target: 250000,
        contributors: [{ name: 'Marc Blanc', stage: 'offer', amount: 50000 }],
      },
      objectif: {}, reminderTypes: ['custom'], pseudo,
    })
    expect(snapshot).not.toContain('Marc Blanc')
    expect(snapshot).not.toContain('contributors')
    expect(snapshot).toContain('180000')
  })

  it('les rappels sont réduits à des libellés de TYPE (aucun nom, même hors Focus)', () => {
    const pseudo = createPseudonymizer()
    // Le contact du rappel (« Bernard Nofocus ») n'est PAS dans la file Focus.
    const { snapshot } = buildBriefSnapshot({
      focus: [focusRow({ contact_name: 'Jean Dupont' })],
      cockpit: {}, objectif: {},
      reminderTypes: ['follow_up_sent_property', 'post_visit_feedback'],
      pseudo,
    })
    expect(snapshot).toContain('RAPPELS DU JOUR')
    expect(snapshot).toContain('relance après un bien envoyé')
    expect(snapshot).toContain('feedback de visite à récupérer')
    expect(snapshot).not.toContain('Nofocus') // aucun nom libre ne peut fuiter
  })

  it('agrège les rappels par libellé', () => {
    const pseudo = createPseudonymizer()
    const { snapshot, reminderCount } = buildBriefSnapshot({
      focus: [], cockpit: {}, objectif: {},
      reminderTypes: ['dormant_lead', 'dormant_lead', 'custom'], pseudo,
    })
    expect(reminderCount).toBe(3)
    expect(snapshot).toContain('2 lead dormant à réveiller')
    expect(snapshot).toContain('1 suivi à faire')
  })

  it('compte les priorités', () => {
    const pseudo = createPseudonymizer()
    const r = buildBriefSnapshot({
      focus: [focusRow({}), focusRow({ contact_id: 'c2', contact_name: 'Sarah Meyer' })],
      cockpit: {}, objectif: {}, reminderTypes: [], pseudo,
    })
    expect(r.itemCount).toBe(2)
    expect(r.reminderCount).toBe(0)
  })

  it('snapshot sans priorités ni rappels reste cohérent (itemCount 0)', () => {
    const pseudo = createPseudonymizer()
    const r = buildBriefSnapshot({ focus: [], cockpit: {}, objectif: {}, reminderTypes: [], pseudo })
    expect(r.itemCount).toBe(0)
    expect(r.reminderCount).toBe(0)
  })

  it('inclut les chiffres et les scores marqués « estimation », titre tokenisé', () => {
    const pseudo = createPseudonymizer()
    const { snapshot } = buildBriefSnapshot({
      focus: [focusRow({ score: 82, lead_score: 71, property_price: 1250000 })],
      cockpit: {}, objectif: {}, reminderTypes: [], pseudo,
    })
    expect(snapshot).toContain('match 82')
    expect(snapshot).toContain('estimation')
    expect(snapshot).toContain('CHF 1250000')
    expect(snapshot).toContain('bien {{C2}}') // titre = 2e jeton après le contact
  })
})
