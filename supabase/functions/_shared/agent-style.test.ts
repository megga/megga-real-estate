import { describe, it, expect } from 'vitest'
import { formatStyleBlock, formatVoiceExamples, fetchClientVoiceSamples, fetchCorrectionExamples, formatCorrectionExamples, buildStyleDistillPrompt, type LearnedStyle, type VoiceSample, type CorrectionExample } from './agent-style'

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
        is: () => builder, // filtre media_type null (exclusion des légendes de photos)
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

describe('formatCorrectionExamples (T2 par l’exemple)', () => {
  const corr: CorrectionExample[] = [
    { draft: 'Bonjour Monsieur Dupont, je me permets de vous recontacter.', final: 'Salut Marc, je te relance vite fait.' },
    { draft: 'Cordialement.', final: 'À bientôt 👍' },
  ]
  it('rend un bloc contrastif « tu proposais → l’agent a préféré »', () => {
    const s = formatCorrectionExamples(corr)
    expect(s).toContain('tu proposais')
    expect(s).toContain('a préféré')
    expect(s).toContain('Salut Marc')
  })
  it('borne le bloc (<= 900 car.)', () => {
    const big: CorrectionExample[] = [{ draft: 'A'.repeat(500), final: 'B'.repeat(500) }]
    expect(formatCorrectionExamples(big).length).toBeLessThanOrEqual(900)
  })
  it('vide si aucune paire / côtés vides / null', () => {
    expect(formatCorrectionExamples([])).toBe('')
    expect(formatCorrectionExamples(null)).toBe('')
    expect(formatCorrectionExamples(undefined)).toBe('')
    expect(formatCorrectionExamples([{ draft: '  ', final: 'x' }])).toBe('')
    expect(formatCorrectionExamples([{ draft: 'x', final: '' }])).toBe('')
  })
  it('variante EN', () => {
    expect(formatCorrectionExamples(corr, 'en')).toContain('the agent preferred')
  })
})

describe('fetchCorrectionExamples (T2)', () => {
  type Row = { megga_draft: string | null; agent_final: string | null }
  function mk(rows: Row[]) {
    let queried = false
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => { queried = true; return Promise.resolve({ data: rows }) },
    }
    const client = { from: () => builder } as unknown as Parameters<typeof fetchCorrectionExamples>[0]
    return { client, wasQueried: () => queried }
  }
  it("renvoie les paires de l'agent", async () => {
    const { client } = mk([{ megga_draft: 'Bonjour Monsieur', agent_final: 'Salut Marc' }])
    const out = await fetchCorrectionExamples(client, 'p1')
    expect(out).toEqual([{ draft: 'Bonjour Monsieur', final: 'Salut Marc' }])
  })
  it('sans profileId → [] sans requête', async () => {
    const { client, wasQueried } = mk([{ megga_draft: 'Bonjour', agent_final: 'Salut' }])
    expect(await fetchCorrectionExamples(client, null)).toEqual([])
    expect(wasQueried()).toBe(false)
  })
  it('filtre les paires incomplètes', async () => {
    const { client } = mk([{ megga_draft: 'incomplet', agent_final: '' }, { megga_draft: 'Avant texte', agent_final: 'Après texte' }])
    expect(await fetchCorrectionExamples(client, 'p1')).toEqual([{ draft: 'Avant texte', final: 'Après texte' }])
  })
})

describe('buildStyleDistillPrompt', () => {
  it('scrubbe les PII de chaque message avant DeepSeek', () => {
    const p = buildStyleDistillPrompt([
      'Salut, note l\'IBAN CH93 0076 2011 6238 5295 7 du client',
      'mdp: secret123 pour le portail',
      'AVS 756.1234.5678.90 à vérifier',
    ])
    expect(p).not.toContain('CH93')
    expect(p).not.toContain('secret123')
    expect(p).not.toContain('756.1234.5678.90')
    expect(p).toContain('[REDACTED:IBAN]')
    expect(p).toContain('[REDACTED:PASSWORD]')
    expect(p).toContain('[REDACTED:AVS]')
    // La consigne de style reste intacte.
    expect(p).toContain('Résume SON style de communication')
  })
  it('rédige le texte ENTIER avant de tronquer (pas de fuite via troncature)', () => {
    // IBAN à cheval sur la borne 200 : un slice(0,200) AVANT redaction laisserait
    // un fragment « CH93 » que le regex IBAN ne matche pas → fuite. redact-puis-slice
    // rédige l'IBAN complet d'abord, donc aucun chiffre ne subsiste.
    const long = `${'a'.repeat(190)} IBAN CH93 0076 2011 6238 5295 7`
    const p = buildStyleDistillPrompt([long])
    expect(p).not.toContain('CH93')
  })
})
