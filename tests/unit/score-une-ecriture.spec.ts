/**
 * Le score d'un match s'écrit d'UNE façon : `FilScore` — la pastille de son palier et le chiffre (revue UX du
 * 29.09.2026). Il s'écrivait de trois : « ● 100 » dans la liste du fil, « 100 » sur une ligne « estimation » dans son
 * panneau, « ✧ 100 % estimé » dans « Planifier une visite ».
 *
 * Ce que cette spec refuse :
 *   · la ligne « estimation » sous le grand score du panneau, ou sa clé revenue dans l'une des quatre langues ;
 *   · un score d'acquéreur écrit à la main dans « Planifier une visite », ou sa clé `fiche.visite.qui.score` revenue ;
 *   · un score de bien écrit « 92 % » sur la fiche d'affaire (étape 5b-1) : son bloc « Matching » passe par `FilScore`.
 *
 * ⚠ L'estimation n'est pas perdue (CLAUDE.md §5) : `FilScore` la porte dans son infobulle et son libellé
 * d'accessibilité (`fil.scoreAria`), dans les quatre langues — ce que la dernière clause vérifie.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LANGUES = ['fr', 'de', 'en', 'it'] as const
const source = (chemin: string): string => readFileSync(join(process.cwd(), chemin), 'utf8')
const json = (chemin: string): Record<string, unknown> => JSON.parse(source(chemin)) as Record<string, unknown>

describe('le score d’un match s’écrit d’une façon', () => {
  it('le panneau du fil n’ajoute pas de ligne « estimation » sous son grand score', () => {
    expect(source('src/components/matching-fil/FilPanneau.tsx')).not.toContain("'fil.estimation'")
    for (const langue of LANGUES) {
      const fil = json(`src/i18n/locales/${langue}/matching.json`).fil as Record<string, unknown>
      expect(fil, langue).not.toHaveProperty('estimation')
    }
  })

  it('« Planifier une visite » écrit le score d’un acquéreur comme le fil : `FilScore`', () => {
    const fiche = source('src/components/crm/biens/fiche/PlanifierVisite.tsx')
    expect(fiche).toContain('<FilScore ')
    expect(fiche).not.toContain('fiche.visite.qui.score')
    for (const langue of LANGUES) {
      const listings = json(`src/i18n/locales/${langue}/listings.json`)
      const qui = ((listings.fiche as Record<string, unknown>).visite as Record<string, unknown>).qui as Record<string, unknown>
      expect(qui, langue).not.toHaveProperty('score')
    }
  })

  it('la fiche d’affaire écrit le score de chaque bien comme le fil : `FilScore`, jamais « {score} % »', () => {
    const bloc = source('src/components/matching-fil/BlocMatchingAffaire.tsx')
    const page = source('src/pages/agent/DealDetailPage.tsx')
    expect(bloc).toContain('<FilScore ')
    expect(page).toContain('<BlocMatchingAffaire ')
    // Toute expression qui nomme un score, suivie de « % » : `{b.score} %`, `{score} %`, `{Math.round(m.score)} %`…
    for (const s of [bloc, page]) expect(s).not.toMatch(/\{[^{}]*\bscore\b[^{}]*\}\s*%/)
  })

  it('l’estimation reste dite, dans l’infobulle et le libellé d’accessibilité de `FilScore`', () => {
    expect(source('src/components/matching-fil/filAtomes.tsx')).toContain("t('fil.scoreAria'")
    const MOTS: Record<(typeof LANGUES)[number], string> = { fr: 'estimation', de: 'Schätzung', en: 'estimate', it: 'stima' }
    for (const langue of LANGUES) {
      const fil = json(`src/i18n/locales/${langue}/matching.json`).fil as Record<string, string>
      expect(fil.scoreAria, langue).toContain(MOTS[langue])
    }
  })
})
