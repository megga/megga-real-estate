/**
 * L'atelier de bureau est retiré (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §6) : le fil de
 * matchs tient la page 0 de Matching, et ce qui survit de l'atelier a rejoint son lecteur (§6.2) — son icône la
 * Recherche, ses types, ses formats et sa phrase MEGGA AI l'écran mobile.
 *
 * Ce que cette spec refuse :
 *   · le dossier `src/components/matching-atelier/`, revenu sous ce nom ;
 *   · un fichier de `src/` qui le nomme encore — un import, ou un renvoi vers son banc —, ou une spec qui l'importe ;
 *   · le banc de l'atelier (`/dev/matching-atelier`) : sa page, ses fixtures, sa route ;
 *   · un état de démonstration de la Recherche sans banc — l'atelier était son seul banc : ses quatre états
 *     (`MrhDemoEtat`) se choisissent au menu de `/dev/crm`, et la Recherche de ce banc montre celui qu'on a choisi ;
 *   · une garde i18n restée sur l'atelier : `matching-fil` prend sa place dans les deux listes verrouillées et dans le
 *     scanner, qui ne nomment plus `matching-atelier`.
 *
 * Lecture du code : ce qu'on refuse est une structure — des fichiers, des imports, une route, des listes —, pas un état
 * de l'écran.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const R = process.cwd()

const lire = (fichier: string): string => readFileSync(join(R, fichier), 'utf8')

/** Les fichiers d'un dossier, récursivement, dont le nom passe le filtre. */
function fichiers(dossier: string, garder: (nom: string) => boolean): string[] {
  return readdirSync(join(R, dossier), { withFileTypes: true }).flatMap((e) => {
    const chemin = `${dossier}/${e.name}`
    if (e.isDirectory()) return fichiers(chemin, garder)
    return garder(e.name) ? [chemin] : []
  })
}

/** Les modules qu'un code importe — statiquement, dynamiquement, pour ses seuls effets — ou qu'une spec simule. */
function importes(code: string): string[] {
  const motif = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]|\bvi\.mock\(\s*['"]([^'"]+)['"]/gm
  return [...code.matchAll(motif)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4])
}

/**
 * Le corps d'un tableau nommé (`nom = [` … `]`), à n'importe quelle indentation, SANS ses lignes de commentaire :
 * un glob commenté ne vise plus rien, et une note qui nomme l'atelier n'en réintroduit aucun (même règle que
 * `globsDe`, dans `i18n-globs-vivants.spec.ts`).
 */
function tableau(fichier: string, nom: string): string {
  const texte = lire(fichier)
  const debut = texte.indexOf(`${nom} = [`)
  expect(debut, `\`${nom}\` introuvable dans ${fichier}`).toBeGreaterThan(-1)
  const fin = texte.slice(debut).search(/\n\s*\]/)
  expect(fin, `fin de \`${nom}\` introuvable dans ${fichier}`).toBeGreaterThan(-1)
  return texte.slice(debut, debut + fin).split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n')
}

describe('l’atelier de bureau est retiré', () => {
  it('son dossier n’existe plus', () => {
    expect(existsSync(join(R, 'src/components/matching-atelier'))).toBe(false)
  })

  it('aucun fichier de src/ ne le nomme, et aucune spec ne l’importe', () => {
    const sources = fichiers('src', (n) => /\.(tsx?|css|json)$/.test(n))
    expect(sources.length, 'src/ ne rend plus rien : la clause ne mesure rien').toBeGreaterThan(500)
    expect(sources.filter((f) => lire(f).includes('matching-atelier'))).toEqual([])

    const specs = fichiers('tests', (n) => /\.tsx?$/.test(n))
    expect(specs.length, 'tests/ ne rend plus rien : la clause ne mesure rien').toBeGreaterThan(300)
    const vises = specs.flatMap((f) =>
      importes(lire(f))
        .filter((m) => /matching-atelier|MatchingShowcasePage|matchingAtelierFixtures/.test(m))
        .map((m) => `${f} → ${m}`),
    )
    expect(vises).toEqual([])
  })

  it('son banc est parti, avec sa route', () => {
    expect(existsSync(join(R, 'src/pages/dev/MatchingShowcasePage.tsx'))).toBe(false)
    expect(existsSync(join(R, 'src/pages/dev/matchingAtelierFixtures.ts'))).toBe(false)
    expect(lire('src/App.tsx')).not.toMatch(/MatchingShowcasePage|\/dev\/matching-atelier/)
  })

  it('les quatre états de démonstration de la Recherche ont un banc : le menu de /dev/crm, sur Matching', () => {
    const union = /export type MrhDemoEtat = ([^\n]+)/.exec(lire('src/components/matching-recherche/mrhDemo.ts'))?.[1] ?? ''
    const etats = [...union.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort()
    expect(etats).toEqual(['bloque', 'erreur', 'ok', 'vide'])

    const banc = lire('src/pages/dev/CrmShowcasePage.tsx')
    const menu = /const ETATS_RECHERCHE\b[\s\S]*?\n\]/.exec(banc)?.[0] ?? ''
    expect([...menu.matchAll(/id: '(\w+)'/g)].map((m) => m[1]).sort()).toEqual(etats)
    // L'état choisi est posé autour des routes du banc, et la Recherche du Matching le lit : jamais un état figé.
    expect(banc).toContain('<RechercheDuBanc.Provider value={recherche}>')
    const matching = lire('src/pages/dev/matchingFilBanc.tsx')
    expect(matching).toContain('useContext(RechercheDuBanc)')
    expect(matching).not.toMatch(/demo="/)
    // Ce que le menu FAIT, pas seulement ce qu'il liste : la ligne « Recherche » s'affiche sur la surface qui monte
    // le Matching, chaque état y a son bouton, chaque bouton pose le sien, et la page du banc le passe tel quel.
    const garde = /courante\?\.id === '([\w-]+)' && \(/.exec(banc)?.[1]
    expect(garde, 'ligne « Recherche » sans garde de surface lisible').toBeDefined()
    expect(banc).toMatch(new RegExp(`\\{ id: '${garde}', chemin: '/dashboard/matching'`))
    expect(banc).toMatch(/\{ETATS_RECHERCHE\.map\(\(e\) => \(/)
    expect(banc).toContain('onClick={() => setRecherche(e.id)}')
    expect(banc).toMatch(/<RechercheDuBanc\.Provider value=\{recherche\}>[\s\S]*<RoutesBanc \/>[\s\S]*<\/RechercheDuBanc\.Provider>/)
    expect(matching).toMatch(/const (\w+) = useContext\(RechercheDuBanc\)[\s\S]*?\bdemo=\{\1\}/)
  })

  it('la garde i18n vise le fil à la place de l’atelier, des deux côtés, et le scanner aussi', () => {
    for (const [fichier, nom] of [['eslint.config.js', 'lockedFamilies'], ['scripts/lint-i18n-hardcoded.mjs', 'LOCKED_GLOBS']]) {
      const liste = tableau(fichier, nom)
      expect(liste, `${fichier} › ${nom}`).toContain("'src/components/matching-fil/**/*.{ts,tsx}'")
      expect(liste, `${fichier} › ${nom}`).not.toContain('matching-atelier')
    }
    const scanner = tableau('scripts/i18n-scan.mjs', 'DEFAULT_DIRS')
    expect(scanner).toContain("'src/components/matching-fil'")
    expect(scanner).not.toContain('matching-atelier')
  })
})
