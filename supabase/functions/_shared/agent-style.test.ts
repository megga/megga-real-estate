import { describe, it, expect } from 'vitest'
import { formatStyleBlock, formatVoiceExamples, type LearnedStyle, type VoiceSample } from './agent-style'

const base: LearnedStyle = { language: 'fr', formality: 'tu', emoji: true, traits: 'phrases courtes, va droit au but', status: 'active', updated_at: '2026-06-03T00:00:00Z', sample_count: 20 }

describe('formatStyleBlock', () => {
  it('rend un bloc tonal borné pour un style actif', () => {
    const s = formatStyleBlock(base)
    expect(s).toContain('Style de cet agent')
    expect(s).toContain('phrases courtes')
    expect(s.length).toBeLessThanOrEqual(320)
  })
  it('renvoie chaîne vide si le style n\'est pas actif ou absent', () => {
    expect(formatStyleBlock({ ...base, status: 'suggested' })).toBe('')
    expect(formatStyleBlock({ ...base, status: 'off' })).toBe('')
    expect(formatStyleBlock(null)).toBe('')
    expect(formatStyleBlock(undefined)).toBe('')
  })
  it('tronque traits trop longs (borne le prompt)', () => {
    const long = formatStyleBlock({ ...base, traits: 'x'.repeat(500) })
    expect(long.length).toBeLessThanOrEqual(320)
  })
})

const voice: VoiceSample[] = [
  { body: 'Bonjour Madame, le bien de Cologny est toujours disponible. Je vous propose une visite jeudi en fin de journée.' },
  { body: 'Bonjour, merci pour votre retour. Je reviens vers vous très vite avec les documents demandés.' },
]

describe('formatVoiceExamples', () => {
  it('rend un bloc few-shot pour ≥ 2 exemples', () => {
    const s = formatVoiceExamples(voice)
    expect(s).toContain('Copie le TON')
    expect(s).toContain('Cologny')
    expect(s.length).toBeLessThanOrEqual(900)
  })
  it('interdit explicitement de réutiliser le contenu (anti-fuite)', () => {
    expect(formatVoiceExamples(voice)).toMatch(/NE REPRENDS JAMAIS|jamais leur contenu/i)
  })
  it('renvoie vide en dessous de 2 exemples (cold-start → fallback)', () => {
    expect(formatVoiceExamples([])).toBe('')
    expect(formatVoiceExamples([{ body: 'ok' }])).toBe('')
    expect(formatVoiceExamples(null)).toBe('')
    expect(formatVoiceExamples(undefined)).toBe('')
  })
  it('dédoublonne et borne chaque exemple à 220 car.', () => {
    const dup = [{ body: 'Z'.repeat(400) }, { body: 'Z'.repeat(400) }, { body: 'Bonjour, voici les informations demandées.' }]
    const s = formatVoiceExamples(dup)
    expect(s).toContain('Bonjour, voici les informations')
    expect(s).not.toContain('Z'.repeat(221))
  })
  it('filtre les messages vides / trop courts', () => {
    expect(formatVoiceExamples([{ body: '  ' }, { body: 'a' }])).toBe('')
  })
  it('variante EN', () => {
    expect(formatVoiceExamples(voice, 'en')).toContain('Mirror the TONE')
  })
})
