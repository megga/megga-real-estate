import { describe, it, expect } from 'vitest'
import {
  normalizeText, tokenize, scoreSnippet, selectKnowledge, formatKnowledgeBlock,
  unsourcedCitationWarning, type KnowledgeSnippet,
} from './knowledge-retrieval'

const snip = (over: Partial<KnowledgeSnippet>): KnowledgeSnippet => ({
  slug: 's', domain: 'bail_co', canton: null, title: 'T', body_md: 'Corps du snippet.',
  applies_to_actions: ['chat'], keywords: [], priority: 5,
  source_ref: 'CO art. 269d', source_url: 'https://example.ch', verified_at: '2026-07-05', ...over,
})

const LDTR = snip({
  slug: 'ldtr-alienation', domain: 'ldtr_ge', canton: 'GE',
  title: 'Vendre un appartement loué à Genève',
  body_md: 'À Genève, la vente d’un appartement loué est soumise à autorisation (LDTR art. 39).',
  keywords: ['ldtr', 'alienation', 'appartement loue', 'vendre appartement loue', 'autorisation'],
  source_ref: 'LDTR/GE art. 39',
})
const KOLLER = snip({
  slug: 'lex-koller-base', domain: 'lex_koller', canton: null,
  title: 'Achat par un étranger',
  body_md: 'La Lex Koller soumet à autorisation certaines acquisitions par des personnes à l’étranger.',
  keywords: ['lex koller', 'lfaie', 'etranger', 'personne a l etranger'],
  source_ref: 'LFAIE (Lex Koller)',
})

describe('normalizeText / tokenize', () => {
  it('retire accents et casse', () => {
    expect(normalizeText('Aliénation d’un Appartement')).toBe("alienation d'un appartement")
  })
  it('tokens ≥3 lettres, pas de chiffres', () => {
    const t = tokenize('Vendre un 4 pièces loué à Carouge')
    expect(t.has('vendre')).toBe(true)
    expect(t.has('pieces')).toBe(true)
    expect(t.has('un')).toBe(false)  // <3
    expect(t.has('4')).toBe(false)   // chiffre
  })
})

describe('scoreSnippet', () => {
  const norm = (m: string) => normalizeText(m)
  const tok = (m: string) => tokenize(m)

  it('mot-clé multi-mots présent → +3', () => {
    const s = scoreSnippet(LDTR, norm('je veux vendre un appartement loué'), tok('je veux vendre un appartement loué'), undefined, null)
    expect(s).toBeGreaterThanOrEqual(3) // "appartement loue" (+3) + "vendre appartement loue" (+3) + "vendre"... single 'vendre' not a keyword
  })
  it('bonus action + canton cumulés', () => {
    const msg = 'vendre appartement loue'
    const withCtx = scoreSnippet(LDTR, norm(msg), tok(msg), 'chat', 'GE')
    const withoutCtx = scoreSnippet(LDTR, norm(msg), tok(msg), 'analyze_market', 'VD')
    expect(withCtx).toBe(withoutCtx + 2 /*action*/ + 2 /*canton*/)
  })
  it('snippet non pertinent → 0 (bonus action seul ne suffit PAS)', () => {
    const s = scoreSnippet(KOLLER, norm('quel est mon agenda demain'), tok('quel est mon agenda demain'), 'chat', 'GE')
    // 'chat' est dans applies_to_actions mais aucun mot-clé ne matche → non éligible.
    expect(s).toBe(0)
  })
  it('mot-clé multi-mots respecte les frontières (« co 216 » ≠ « eco 216 »)', () => {
    const co = snip({ slug: 'co', keywords: ['co 216'], applies_to_actions: [] })
    expect(scoreSnippet(co, norm('la norme eco 216 du label'), tok('la norme eco 216 du label'), undefined, null)).toBe(0)
    expect(scoreSnippet(co, norm('selon co 216 la vente'), tok('selon co 216 la vente'), undefined, null)).toBe(3)
  })
  it('mot-clé numérique (« 2/3 ») est matchable via frontières', () => {
    const s = snip({ slug: 'amort', keywords: ['2/3'], applies_to_actions: [] })
    expect(scoreSnippet(s, norm('je finance les 2/3 du bien'), tok('je finance les 2/3 du bien'), undefined, null)).toBe(1)
    expect(scoreSnippet(s, norm('rien de numerique ici'), tok('rien de numerique ici'), undefined, null)).toBe(0)
  })
})

describe('selectKnowledge', () => {
  it('sélectionne le snippet pertinent, ignore les autres', () => {
    const sel = selectKnowledge([LDTR, KOLLER], 'je veux vendre un appartement loué à Genève', { action: 'chat', canton: 'GE' })
    expect(sel.map((s) => s.slug)).toContain('ldtr-alienation')
    expect(sel.map((s) => s.slug)).not.toContain('lex-koller-base')
  })
  it('aucun match → tableau vide (comportement actuel préservé)', () => {
    expect(selectKnowledge([LDTR, KOLLER], 'résume mon agenda', { action: 'chat' })).toEqual([])
  })
  it('respecte le cap maxSnippets', () => {
    const many = Array.from({ length: 6 }, (_, i) => snip({
      slug: `k${i}`, keywords: ['bail', 'loyer'], body_md: 'x', priority: i,
    }))
    const sel = selectKnowledge(many, 'question sur le bail et le loyer', { maxSnippets: 2 })
    expect(sel.length).toBe(2)
  })
  it('respecte le budget de tokens (snippet entier ou rien)', () => {
    const big = snip({ slug: 'big', keywords: ['bail'], body_md: 'x'.repeat(4000) }) // ~1000 tokens
    const small = snip({ slug: 'small', keywords: ['bail'], body_md: 'court', priority: 1 })
    const sel = selectKnowledge([big, small], 'question bail', { budgetTokens: 700, maxSnippets: 3 })
    expect(sel.map((s) => s.slug)).not.toContain('big') // dépasse le budget → écarté
  })
  it('tri déterministe (score puis priority puis slug)', () => {
    const a = snip({ slug: 'aaa', keywords: ['bail'], priority: 1 })
    const b = snip({ slug: 'bbb', keywords: ['bail'], priority: 9 })
    const sel = selectKnowledge([a, b], 'bail', { maxSnippets: 2 })
    expect(sel[0].slug).toBe('bbb') // priority plus haute d'abord (score égal)
  })
})

describe('formatKnowledgeBlock', () => {
  it('vide → chaîne vide', () => {
    expect(formatKnowledgeBlock([])).toBe('')
  })
  it('inclut titre, corps, source_ref, url, date JJ.MM.AAAA', () => {
    const b = formatKnowledgeBlock([LDTR])
    expect(b).toContain('SAVOIR MÉTIER VÉRIFIÉ')
    expect(b).toContain('LDTR/GE art. 39')
    expect(b).toContain('example.ch')
    expect(b).toContain('vérifié le 05.07.2026')
    expect(b).toContain('notaire')
  })
})

describe('unsourcedCitationWarning', () => {
  it('article cité couvert par un snippet injecté → pas d’avertissement', () => {
    const reply = "La vente est soumise à autorisation selon l'art. 39 LDTR."
    expect(unsourcedCitationWarning(reply, [LDTR])).toBeNull()
  })
  it('article NON couvert → avertissement', () => {
    const reply = "Voir l'art. 712 CC sur la propriété par étages."
    const w = unsourcedCitationWarning(reply, [LDTR])
    expect(w).not.toBeNull()
    expect(w).toContain('à vérifier')
  })
  it('loi nommée non injectée → avertissement', () => {
    const reply = "La Lex Koller interdit cet achat."
    expect(unsourcedCitationWarning(reply, [LDTR])).not.toBeNull() // Koller absent des injectés
  })
  it('loi nommée injectée → pas d’avertissement', () => {
    const reply = "La Lex Koller soumet l'achat à autorisation."
    expect(unsourcedCitationWarning(reply, [KOLLER])).toBeNull()
  })
  it('réponse sans citation légale précise → pas d’avertissement', () => {
    expect(unsourcedCitationWarning('Je te conseille de relancer ce client demain.', [])).toBeNull()
  })
  it('article d’une énumération dans source_ref → couvert (pas de faux positif)', () => {
    const s = snip({
      slug: 'bail-conge', source_ref: 'CO art. 266c, 266d, 273 al. 1',
      body_md: 'Les délais de congé suivent le CO.', keywords: ['conge'],
    })
    // le copilote cite art. 266d, présent dans l'énumération du source_ref
    expect(unsourcedCitationWarning("Le préavis suit l'art. 266d CO.", [s])).toBeNull()
  })
  it('article présent seulement dans le titre → couvert', () => {
    const s = snip({
      slug: 'x', title: 'Régime de l’art. 712 CC', source_ref: null,
      body_md: 'Description sans le numéro littéral.', keywords: ['ppe'],
    })
    expect(unsourcedCitationWarning("Voir l'art. 712 CC.", [s])).toBeNull()
  })
  it('sans snippet injecté, toute citation d’article est orpheline (cas non fondé)', () => {
    expect(unsourcedCitationWarning("Selon l'art. 42 LDTR, ...", [])).not.toBeNull()
  })
})
