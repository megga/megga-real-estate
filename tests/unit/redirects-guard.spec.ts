/**
 * Garde-fou : aucune règle de bord ne doit expulser une surface du CRM.
 *
 * Pourquoi un test. Les règles de `public/_redirects` sont évaluées par
 * Cloudflare AVANT le fallback SPA, donc avant que React n'existe — et le
 * serveur de dev de Vite les ignore entièrement. Une règle périmée est donc
 * invisible : les suites e2e restent vertes pendant que la production renvoie
 * un 302.
 *
 * C'est exactement ce qui est arrivé à la console super-admin. Isolée sur
 * `admin.megga.ch` en juillet 2026, elle a été refusionnée dans le CRM le 28,
 * mais sa règle de bord a survécu au retrait du domaine : tout rechargement,
 * favori ou lien profond vers `/dashboard/admin` partait vers un hôte qui ne
 * résolvait plus. Seule la navigation interne fonctionnait, et rien dans la CI
 * ne pouvait le dire.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const FILE = 'public/_redirects'

interface Rule {
  line: number
  from: string
  to: string
}

/** Règles utiles seules : ni commentaires ni lignes vides. */
function parseRules(raw: string): Rule[] {
  return raw
    .split('\n')
    .map((text, i) => ({ text: text.trim(), line: i + 1 }))
    .filter(({ text }) => text && !text.startsWith('#'))
    .map(({ text, line }) => {
      const [from, to] = text.split(/\s+/)
      return { line, from, to }
    })
}

describe('public/_redirects', () => {
  const raw = readFileSync(FILE, 'utf-8')
  const rules = parseRules(raw)

  it('contient bien des règles (sinon le reste ne prouve rien)', () => {
    expect(rules.length).toBeGreaterThan(10)
  })

  it("n'envoie aucune route /dashboard vers un autre hôte", () => {
    // Les réécritures vers un hôte externe sont légitimes (le centre d'aide part
    // chez Intercom) — mais jamais depuis le CRM authentifié, dont toutes les
    // surfaces vivent dans cette application.
    const exiles = rules.filter(r => r.from.startsWith('/dashboard') && /^https?:\/\//.test(r.to))
    expect(
      exiles,
      `règle(s) qui expulsent une surface du CRM hors de l'origine :\n${exiles.map(r => `  ligne ${r.line} : ${r.from} → ${r.to}`).join('\n')}`,
    ).toEqual([])
  })

  it('ne pointe plus vers le domaine admin retiré', () => {
    // Sur les RÈGLES seules : le fichier a le droit de raconter en commentaire
    // pourquoi cette règle a existé, c'est même ce qui évite de la recréer.
    const dead = rules.filter(r => `${r.from} ${r.to}`.includes('admin.megga.ch'))
    expect(
      dead,
      `admin.megga.ch a été retiré, plus aucune règle ne doit y pointer :\n${dead.map(r => `  ligne ${r.line} : ${r.from} → ${r.to}`).join('\n')}`,
    ).toEqual([])
  })

  it('garde le fallback SPA en dernier', () => {
    // Une règle placée après lui ne serait jamais atteinte : le fallback capture
    // tout. Le fichier le dit en commentaire ; ce test le rend opposable.
    const last = rules[rules.length - 1]
    expect(last.from, 'le fallback SPA doit rester la dernière règle').toBe('/*')
  })
})
