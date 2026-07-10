import { describe, it, expect } from 'vitest'
import { composeAgentSystemPrompt, type AgentSystemPromptParts } from './agent-system-prompt'
import { NBA_PROMPT_GUARDRAIL } from './contact-nba'

const parts = (over: Partial<AgentSystemPromptParts> = {}): AgentSystemPromptParts => ({
  system: 'SYSTEM_SENTINEL',
  styleGuide: 'STYLE_SENTINEL',
  learnedStyle: '',
  voice: '',
  corrections: '',
  group: 'GROUP_SENTINEL',
  listing: 'LISTING_SENTINEL',
  antiFab: 'ANTIFAB_SENTINEL',
  ...over,
})

describe('composeAgentSystemPrompt — injection du garde-fou NBA', () => {
  it('injecte TOUJOURS le garde-fou NBA (anti-initiative), baked-in', () => {
    const prompt = composeAgentSystemPrompt(parts())
    // Ce test est le filet anti-régression : si quelqu'un retire l'injection du garde-fou
    // dans composeAgentSystemPrompt, il casse ici (pas une CI verte silencieuse).
    expect(prompt).toContain(NBA_PROMPT_GUARDRAIL)
    expect(prompt).toContain("N'appelle AUCUN outil")
  })

  it('place le garde-fou NBA en toute fin, APRÈS l\'anti-fabrication (ordre figé)', () => {
    const prompt = composeAgentSystemPrompt(parts())
    expect(prompt.indexOf('ANTIFAB_SENTINEL')).toBeLessThan(prompt.indexOf(NBA_PROMPT_GUARDRAIL))
    expect(prompt.trimEnd().endsWith(NBA_PROMPT_GUARDRAIL.trimEnd())).toBe(true)
  })

  it('conserve tous les blocs dans l\'ordre attendu (persona → style → learned → voice → corrections → group → listing → antifab → NBA)', () => {
    const prompt = composeAgentSystemPrompt(parts({
      learnedStyle: 'LEARNED_SENTINEL', voice: 'VOICE_SENTINEL', corrections: 'CORR_SENTINEL',
    }))
    const order = [
      'SYSTEM_SENTINEL', 'STYLE_SENTINEL', 'LEARNED_SENTINEL', 'VOICE_SENTINEL',
      'CORR_SENTINEL', 'GROUP_SENTINEL', 'LISTING_SENTINEL', 'ANTIFAB_SENTINEL',
    ]
    let last = -1
    for (const token of order) {
      const idx = prompt.indexOf(token)
      expect(idx, `${token} présent`).toBeGreaterThan(-1)
      expect(idx, `${token} dans l'ordre`).toBeGreaterThan(last)
      last = idx
    }
    expect(prompt.indexOf(NBA_PROMPT_GUARDRAIL), 'NBA après antifab').toBeGreaterThan(last)
  })

  it('omet proprement les blocs conditionnels vides (jamais « undefined »)', () => {
    const prompt = composeAgentSystemPrompt(parts())
    expect(prompt).not.toContain('undefined')
    // learnedStyle/voice/corrections vides → pas de trace
    expect(prompt).not.toContain('LEARNED_SENTINEL')
  })
})
