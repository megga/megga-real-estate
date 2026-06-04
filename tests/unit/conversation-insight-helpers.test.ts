import { describe, it, expect } from 'vitest'
import { nextActionLabel, sentimentTone, entityChips } from '@/components/crm-sugar-v3/contact-detail/conversationInsight.helpers'

describe('nextActionLabel', () => {
  it('mappe les types connus en libellés FR', () => {
    expect(nextActionLabel('planifier_visite')).toBe('Planifier une visite')
    expect(nextActionLabel('envoyer_biens')).toBe('Envoyer des biens')
    expect(nextActionLabel('relancer')).toBe('Relancer')
    expect(nextActionLabel('qualifier_lead')).toBe('Qualifier le lead')
    expect(nextActionLabel('repondre')).toBe('Répondre')
    expect(nextActionLabel('rien')).toBe('Rien à faire')
  })
  it('renvoie le type brut capitalisé si inconnu', () => {
    expect(nextActionLabel('autre_chose')).toBe('Autre chose')
    expect(nextActionLabel('')).toBe('')
  })
})

describe('sentimentTone', () => {
  it('mappe le sentiment en libellé + ton', () => {
    expect(sentimentTone('positif')).toEqual({ label: 'Positif', tone: 'ok' })
    expect(sentimentTone('tendu')).toEqual({ label: 'Tendu', tone: 'err' })
    expect(sentimentTone('neutre')).toEqual({ label: 'Neutre', tone: 'neutral' })
    expect(sentimentTone(null)).toBeNull()
    expect(sentimentTone('xxx')).toEqual({ label: 'xxx', tone: 'neutral' })
  })
})

describe('entityChips', () => {
  it('extrait des puces lisibles depuis entities (clés connues, ignore le vide)', () => {
    const chips = entityChips({ budget: '1.2M', zones: ['Eaux-Vives', 'Champel'], type: 'appartement', pieces: 4, dates: null })
    expect(chips).toContain('Budget : 1.2M')
    expect(chips).toContain('Zones : Eaux-Vives, Champel')
    expect(chips).toContain('Type : appartement')
    expect(chips).toContain('Pièces : 4')
    expect(chips).not.toContain('Dates')
  })
  it('renvoie [] pour entities vide/sans clé connue', () => {
    expect(entityChips({})).toEqual([])
    expect(entityChips({ inconnu: 'x' })).toEqual([])
  })
})
