/**
 * Garde-fou : les cibles de navigation de la console admin restent préfixées.
 *
 * La console a vécu six jours comme application autonome, où ses routes étaient
 * à la RACINE (`/agencies/:id`, `/users`). Refusionnée dans le CRM le 28 juillet
 * 2026, elle est montée sous `/dashboard/admin` — mais les liens des pages sont
 * restés absolus. Une cible à la racine ne produit pas d'erreur : elle tombe sur
 * le 404 du CRM, ou pire sur une route publique (`/agencies` est une redirection
 * marketplace, qui éjectait vers la vitrine).
 *
 * Un test statique plutôt qu'un parcours e2e : il ne dépend d'aucune donnée, ne
 * peut pas passer à vide, et couvre les liens que la console ne rend que
 * lorsqu'il y a des lignes à afficher.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

/** Sous-chemins de la console — ceux qui n'existent PAS à la racine du CRM. */
const ADMIN_SUBPATHS = [
  'agencies', 'users', 'end-users', 'moderation', 'monitoring', 'compliance',
  'kyb-review', 'onboarding-calls',
  'changelog', 'feature-flags', 'plans', 'live', 'security', 'nps', 'autonomy',
  'tool-usage', 'learning',
].join('|')

// Cible de navigation (`to=`, `href:`, `navigate(`) suivie d'un littéral qui
// s'ouvre sur un sous-chemin admin. Un gabarit correct commence par
// `${ADMIN_CONSOLE_PATH}` : le `/` n'y suit pas le guillemet, donc il ne matche pas.
const ROOT_TARGET = new RegExp(`(?:to=|href:|navigate\\()\\s*[{(]?\\s*['"\`]/(?:${ADMIN_SUBPATHS})\\b`)

const ROOTS = ['src/pages/admin', 'src/components/admin']

/**
 * Le rail du shell est la seule exception : sa table de navigation stocke des
 * chemins NUS et les préfixe au rendu. Le test ci-dessous vérifie qu'il le fait
 * toujours — l'exception reste donc vérifiée, elle n'ouvre pas d'angle mort.
 */
const SHELL = 'src/components/admin/AdminShell.tsx'

/**
 * Chemin à séparateurs POSIX.
 *
 * `join` rend des `\` sous Windows, alors que `SHELL` ci-dessus s'écrit avec des `/` :
 * la comparaison `f !== SHELL` était donc TOUJOURS vraie en local, l'exception du rail
 * ne s'appliquait jamais, et sa table de chemins nus — le comportement que ce fichier
 * documente comme légitime — se lisait comme une infraction. Vert en CI (Linux), rouge
 * sur la machine du développeur. Normaliser à la source vaut mieux que de normaliser à
 * la comparaison : les messages d'infraction sortent eux aussi en `/`.
 */
const posix = (p: string): string => p.split(sep).join('/')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = posix(join(dir, entry))
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.tsx') || full.endsWith('.ts') ? [full] : []
  })
}

describe('cibles de navigation de la console admin', () => {
  const files = [
    ...ROOTS.flatMap(walk),
    ...readdirSync('src/hooks')
      .filter(f => f.startsWith('useAdmin'))
      .map(f => posix(join('src/hooks', f))),
  ]

  it('trouve bien les fichiers de la console (sinon le test ne prouve rien)', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it('le rail du shell préfixe ses chemins nus au rendu', () => {
    const raw = readFileSync(SHELL, 'utf-8')
    expect(
      raw.includes('${ADMIN_CONSOLE_PATH}${item.href}'),
      `${SHELL} : la table de nav stocke des chemins nus, ils DOIVENT être préfixés au rendu`,
    ).toBe(true)
  })

  it('ne contient aucune cible à la racine', () => {
    const offenders = files.filter(f => f !== SHELL).flatMap(file =>
      readFileSync(file, 'utf-8')
        .split('\n')
        .map((text, i) => ({ file, line: i + 1, text: text.trim() }))
        .filter(({ text }) => ROOT_TARGET.test(text)),
    )

    expect(
      offenders,
      `cible(s) de navigation à la racine — préfixer par ADMIN_CONSOLE_PATH :\n${offenders.map(o => `  ${o.file}:${o.line} — ${o.text}`).join('\n')}`,
    ).toEqual([])
  })
})
