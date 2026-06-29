import { describe, it, expect } from 'vitest'
import { formatStyleBlock, formatVoiceExamples, fetchClientVoiceSamples, type LearnedStyle, type VoiceSample } from './agent-style'

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

// T2 « par agent » : branchement per-agent / repli agence (client Supabase mocké —
// agent-style.ts est chargeable sous Node, l'import `type ...https:` étant effacé).
type Row = { body: string | null }
type SbArg = Parameters<typeof fetchClientVoiceSamples>[0]
function makeClient(perAgentRows: Row[], agencyRows: Row[]) {
  const calls: Array<'agent' | 'agency'> = []
  const client = {
    from() {
      let isAgent = false
      const builder = {
        select: () => builder,
        eq: (col: string) => { if (col === 'sent_by_profile_id') isAgent = true; return builder },
        not: () => builder,
        order: () => builder,
        limit: () => { calls.push(isAgent ? 'agent' : 'agency'); return Promise.resolve({ data: isAgent ? perAgentRows : agencyRows }) },
      }
      return builder
    },
  }
  return { client: client as unknown as SbArg, calls }
}

describe('fetchClientVoiceSamples — par agent (T2)', () => {
  const agentRows: Row[] = [
    { body: 'Bonjour Marc, je vous confirme la visite de mardi.' },
    { body: 'Parfait, à demain 14h.' },
    { body: "Je reviens vers vous d'ici ce soir." },
  ]
  const agencyRows: Row[] = [{ body: 'Cordialement, l’agence.' }, { body: 'Merci de votre confiance.' }]

  it("utilise la voix de l'agent quand il a >= VOICE_MIN messages", async () => {
    const { client, calls } = makeClient(agentRows, agencyRows)
    const out = await fetchClientVoiceSamples(client, 'ag1', { profileId: 'p1' })
    expect(out.map((s) => s.body)).toEqual(agentRows.map((r) => r.body))
    expect(calls).toEqual(['agent']) // pas de repli
  })

  it("repli agence si l'agent a trop peu de messages (< VOICE_MIN)", async () => {
    const { client, calls } = makeClient([{ body: 'un seul message' }], agencyRows)
    const out = await fetchClientVoiceSamples(client, 'ag1', { profileId: 'p1' })
    expect(out.map((s) => s.body)).toEqual(agencyRows.map((r) => r.body))
    expect(calls).toEqual(['agent', 'agency']) // a tenté l'agent puis repli
  })

  it('sans profileId : agence directement (aucune requête par-agent)', async () => {
    const { client, calls } = makeClient(agentRows, agencyRows)
    const out = await fetchClientVoiceSamples(client, 'ag1')
    expect(out.map((s) => s.body)).toEqual(agencyRows.map((r) => r.body))
    expect(calls).toEqual(['agency'])
  })

  it('agencyId null → [] (jamais de requête)', async () => {
    const { client, calls } = makeClient(agentRows, agencyRows)
    expect(await fetchClientVoiceSamples(client, null, { profileId: 'p1' })).toEqual([])
    expect(calls).toEqual([])
  })
})
