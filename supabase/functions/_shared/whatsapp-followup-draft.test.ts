import { describe, it, expect } from 'vitest'
import {
  isStyleActive, buildInsightContext, buildFollowupDraftSystemPrompt,
  buildFollowupDraftUserPrompt, parseDraftMessage, DRAFT_MESSAGE_MAX_CHARS,
} from './whatsapp-followup-draft'

describe('isStyleActive — la métrique T1 (gate)', () => {
  it('vrai UNIQUEMENT si status = active', () => {
    expect(isStyleActive({ status: 'active' })).toBe(true)
  })
  it('faux pour suggested / off / vide / absent', () => {
    expect(isStyleActive({ status: 'suggested' })).toBe(false)
    expect(isStyleActive({ status: 'off' })).toBe(false)
    expect(isStyleActive({ status: '' })).toBe(false)
    expect(isStyleActive({})).toBe(false)
    expect(isStyleActive(null)).toBe(false)
    expect(isStyleActive(undefined)).toBe(false)
  })
})

describe('buildInsightContext', () => {
  it('null → chaîne vide', () => {
    expect(buildInsightContext(null)).toBe('')
    expect(buildInsightContext(undefined)).toBe('')
  })
  it('assemble résumé + intention + next_action.label + engagements (FR)', () => {
    const ctx = buildInsightContext({
      summary: 'Cherche 3.5 pièces à Genève',
      intent: 'achat',
      next_action: { type: 'planifier_visite', label: 'Planifier une visite' },
      commitments: ['Agent: rappeler jeudi', 'Client: dispo samedi'],
    }, 'fr')
    expect(ctx).toContain('Résumé du fil : Cherche 3.5 pièces à Genève')
    expect(ctx).toContain('Intention du client : achat')
    expect(ctx).toContain('Prochaine action suggérée : Planifier une visite')
    expect(ctx).toContain('Engagements pris : Agent: rappeler jeudi / Client: dispo samedi')
  })
  it('anglais quand lang=en', () => {
    const ctx = buildInsightContext({ summary: 'Looking for a 3.5-room flat', intent: 'buy' }, 'en')
    expect(ctx).toContain('Thread summary : Looking for a 3.5-room flat')
    expect(ctx).toContain('Client intent : buy')
  })
  it('borne les engagements à 5 et ignore le non-string', () => {
    const ctx = buildInsightContext({
      commitments: ['a', 'b', 'c', 'd', 'e', 'f', 42, null],
    }, 'fr')
    expect(ctx).toContain('a / b / c / d / e')
    expect(ctx).not.toContain('f')
    expect(ctx).not.toContain('42')
  })
  it('next_action sans label → ignoré (pas de ligne vide)', () => {
    expect(buildInsightContext({ next_action: { type: 'relancer' } }, 'fr')).toBe('')
  })
})

describe('buildFollowupDraftSystemPrompt', () => {
  it('FR : vouvoiement, message court, sortie JSON stricte', () => {
    const p = buildFollowupDraftSystemPrompt({ lang: 'fr' })
    expect(p).toContain('Vouvoiement strict')
    expect(p).toContain('COURT')
    expect(p).toContain('{"message"')
  })
  it('EN : registre poli + JSON', () => {
    const p = buildFollowupDraftSystemPrompt({ lang: 'en' })
    expect(p).toContain('Polite, professional register')
    expect(p).toContain('{"message"')
  })
  it('injecte le bloc de style seulement s\'il est fourni', () => {
    const withStyle = buildFollowupDraftSystemPrompt({ styleBlock: '\n\nStyle: vouvoie, sobre', lang: 'fr' })
    expect(withStyle).toContain('Ton ADDITIF de cet agent')
    expect(withStyle).toContain('Style: vouvoie, sobre')
    const without = buildFollowupDraftSystemPrompt({ lang: 'fr' })
    expect(without).not.toContain('Ton ADDITIF de cet agent')
  })
  it('concatène voix + corrections telles quelles', () => {
    const p = buildFollowupDraftSystemPrompt({ voiceBlock: '\n\nVOIX_XYZ', correctionsBlock: '\n\nCORR_XYZ', lang: 'fr' })
    expect(p).toContain('VOIX_XYZ')
    expect(p).toContain('CORR_XYZ')
  })
})

describe('buildFollowupDraftUserPrompt', () => {
  it('FR : nom du client + action + contexte', () => {
    const u = buildFollowupDraftUserPrompt({ clientName: 'Marie', action: 'Relancer le contact', insightContext: 'Résumé du fil : x', lang: 'fr' })
    expect(u).toContain('« Marie »')
    expect(u).toContain('Intention de relance de l\'agent : Relancer le contact')
    expect(u).toContain('Contexte de la conversation :\nRésumé du fil : x')
  })
  it('sans contexte → pas de bloc contexte', () => {
    const u = buildFollowupDraftUserPrompt({ clientName: 'Marie', action: 'Relancer', lang: 'fr' })
    expect(u).not.toContain('Contexte de la conversation')
  })
  it('nom vide → repli « le client » (FR) / « the client » (EN)', () => {
    expect(buildFollowupDraftUserPrompt({ clientName: '', action: 'Relancer', lang: 'fr' })).toContain('le client')
    expect(buildFollowupDraftUserPrompt({ clientName: '  ', action: 'Follow up', lang: 'en' })).toContain('the client')
  })
})

describe('parseDraftMessage', () => {
  it('extrait message de {"message":…}', () => {
    expect(parseDraftMessage('{"message":"Bonjour Marie, avez-vous pu réfléchir ?"}')).toBe('Bonjour Marie, avez-vous pu réfléchir ?')
  })
  it('tolère {"body":…} et texte brut', () => {
    expect(parseDraftMessage('{"body":"Coucou"}')).toBe('Coucou')
    expect(parseDraftMessage('Message brut lisible')).toBe('Message brut lisible')
  })
  it('vide / trop court / null → null', () => {
    expect(parseDraftMessage('')).toBeNull()
    expect(parseDraftMessage('   ')).toBeNull()
    expect(parseDraftMessage('{"message":""}')).toBeNull()
    expect(parseDraftMessage('{"message":"a"}')).toBeNull()
    expect(parseDraftMessage(null)).toBeNull()
    expect(parseDraftMessage(undefined)).toBeNull()
  })
  it('borne la longueur à DRAFT_MESSAGE_MAX_CHARS', () => {
    const long = 'x'.repeat(DRAFT_MESSAGE_MAX_CHARS + 500)
    expect(parseDraftMessage(JSON.stringify({ message: long }))!.length).toBe(DRAFT_MESSAGE_MAX_CHARS)
  })
})
