import { describe, it, expect } from 'vitest'
import { nextActionLabel, sentimentTone, entityChips } from '@/components/crm-sugar-v3/contact-detail/conversationInsight.helpers'
import i18next from 'i18next'
import frContacts from '@/i18n/locales/fr/contacts.json'

// Ces helpers produisent leur texte via un traducteur INJECTÉ (cf
// docs/i18n-conventions.md §5). Instance i18next FR autonome (0 dépendance
// navigateur) : les assertions FR restent valides car le JSON FR
// (contacts:nextAction/sentiment/entity.*) reproduit les libellés d'origine.
const i18n = i18next.createInstance()
void i18n.init({ lng: 'fr', resources: { fr: { contacts: frContacts } }, ns: ['contacts'], defaultNS: 'contacts', initImmediate: false, interpolation: { escapeValue: false } })
const t = i18n.getFixedT('fr', 'contacts')

describe('nextActionLabel', () => {
  it('mappe les types connus en libellés FR', () => {
    expect(nextActionLabel('planifier_visite', t)).toBe('Planifier une visite')
    expect(nextActionLabel('envoyer_biens', t)).toBe('Envoyer des biens')
    expect(nextActionLabel('relancer', t)).toBe('Relancer')
    expect(nextActionLabel('qualifier_lead', t)).toBe('Qualifier le lead')
    expect(nextActionLabel('repondre', t)).toBe('Répondre')
    expect(nextActionLabel('rien', t)).toBe('Rien à faire')
  })
  it('renvoie le type brut capitalisé si inconnu', () => {
    expect(nextActionLabel('autre_chose', t)).toBe('Autre chose')
    expect(nextActionLabel('', t)).toBe('')
  })
})

describe('sentimentTone', () => {
  it('mappe le sentiment en libellé + ton', () => {
    expect(sentimentTone('positif', t)).toEqual({ label: 'Positif', tone: 'ok' })
    expect(sentimentTone('tendu', t)).toEqual({ label: 'Tendu', tone: 'err' })
    expect(sentimentTone('neutre', t)).toEqual({ label: 'Neutre', tone: 'neutral' })
    expect(sentimentTone(null, t)).toBeNull()
    expect(sentimentTone('xxx', t)).toEqual({ label: 'xxx', tone: 'neutral' })
  })
})

describe('entityChips', () => {
  it('extrait des puces lisibles depuis entities (clés connues, ignore le vide)', () => {
    const chips = entityChips({ budget: '1.2M', zones: ['Eaux-Vives', 'Champel'], type: 'appartement', pieces: 4, dates: null }, t)
    expect(chips).toContain('Budget : 1.2M')
    expect(chips).toContain('Zones : Eaux-Vives, Champel')
    expect(chips).toContain('Type : appartement')
    expect(chips).toContain('Pièces : 4')
    expect(chips).not.toContain('Dates')
  })
  it('renvoie [] pour entities vide/sans clé connue', () => {
    expect(entityChips({}, t)).toEqual([])
    expect(entityChips({ inconnu: 'x' }, t)).toEqual([])
  })
})
