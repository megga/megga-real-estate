/**
 * Garde : les gestes du matching ne dépendent d'aucune surface (conception du lot E1, §6.2).
 *
 * Le fil de matchs et l'écran mobile posent les mêmes gestes, et la Recherche en lit la règle du report : un seul
 * écrivain par geste, `src/lib/matchingGestes.ts`, et une seule file d'annulation, `src/lib/matchingAnnulation.ts`.
 * L'atelier de bureau disparaît au lot E1, sa lecture (`useAtelierMatching`) avec l'écran mobile au lot E2 : ce que le
 * fil écrit ne doit dépendre ni de l'un ni de l'autre.
 *
 * Ce que cette spec refuse :
 *   · un import, depuis l'un des deux modules, du dossier de l'atelier (`matching-atelier/`) ou de sa lecture
 *     (`useAtelierMatching`) : retirer l'atelier casserait le fil ;
 *   · un type de geste emprunté à ceux de l'atelier (`Pick` d'un type `Atelier…`) : `AcheteurGeste` et `BienGeste`
 *     sont écrits en propre, avec les seuls champs que les gestes lisent ;
 *   · un exécuteur (`exec…`) exporté ailleurs sous `src/`, ou un ré-export du module des gestes (de compatibilité,
 *     depuis `useAtelierMatching` ou d'où que ce soit) : deux adresses pour un geste, dont l'une meurt avec son écran ;
 *   · une seconde file d'annulation sous son ancien nom (`matching-atelier/pendingTriage.ts`).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const R = process.cwd()
const GESTES = 'src/lib/matchingGestes.ts'
const ANNULATION = 'src/lib/matchingAnnulation.ts'

function lire(chemin: string): string {
  expect(existsSync(join(R, chemin)), `${chemin} introuvable`).toBe(true)
  return readFileSync(join(R, chemin), 'utf8')
}

/** Commentaires blanchis : un en-tête peut NOMMER l'atelier sans en dépendre. */
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')

/** Les fichiers TypeScript de `dossier`, récursivement, commentaires blanchis. */
function sources(dossier: string): { chemin: string; code: string }[] {
  return readdirSync(join(R, dossier), { withFileTypes: true }).flatMap((e) => {
    const chemin = `${dossier}/${e.name}`
    if (e.isDirectory()) return sources(chemin)
    return /\.tsx?$/.test(e.name) ? [{ chemin, code: sansCommentaires(readFileSync(join(R, chemin), 'utf8')) }] : []
  })
}

/** Les modules qu'un code importe : statiquement, dynamiquement ou pour ses seuls effets. */
function importes(code: string): string[] {
  const motif = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm
  return [...code.matchAll(motif)].map((m) => m[1] ?? m[2] ?? m[3])
}

describe('les gestes du matching ne dépendent d’aucune surface', () => {
  it.each([GESTES, ANNULATION])('%s n’importe rien de l’atelier', (chemin) => {
    const modules = importes(sansCommentaires(lire(chemin)))
    expect(modules.length, `aucun import lu dans ${chemin} : la garde ne mesurerait plus rien`).toBeGreaterThan(0)
    expect(modules.filter((m) => /matching-atelier\/|useAtelierMatching/.test(m))).toEqual([])
  })

  it.each([GESTES, ANNULATION])('%s n’emprunte aucun type de l’atelier', (chemin) => {
    expect(sansCommentaires(lire(chemin))).not.toMatch(/Pick<\s*Atelier/)
  })

  it('AcheteurGeste et BienGeste sont déclarés dans le module des gestes', () => {
    const code = sansCommentaires(lire(GESTES))
    expect(code).toMatch(/^export (?:interface|type) AcheteurGeste\b/m)
    expect(code).toMatch(/^export (?:interface|type) BienGeste\b/m)
  })

  it('un exécuteur n’a qu’une adresse : le module des gestes', () => {
    const fichiers = sources('src')
    expect(fichiers.some((f) => f.chemin === GESTES), `${GESTES} hors de la lecture : la garde ne mesurerait plus rien`)
      .toBe(true)
    const ailleurs = fichiers.filter((f) => f.chemin !== GESTES).flatMap(({ chemin, code }) => {
      const declares = [...code.matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+(exec[A-Z]\w*)/gm)]
        .map((m) => m[1])
      const reexportes = [...code.matchAll(/^export\s*(?:type\s*)?\{([^}]*)\}/gm)]
        .flatMap((m) => m[1].split(','))
        .map((n) => n.trim())
        .filter((n) => /\bexec[A-Z]/.test(n))
      const relais = /^export\b[^;]*\bfrom\s*['"][^'"]*\/matchingGestes['"]/m.test(code)
        ? ['ré-export du module des gestes'] : []
      return [...declares, ...reexportes, ...relais].map((n) => `${chemin} : ${n}`)
    })
    expect(ailleurs).toEqual([])
  })

  it('la file d’annulation n’a qu’une adresse', () => {
    expect(existsSync(join(R, 'src/components/matching-atelier/pendingTriage.ts'))).toBe(false)
  })
})
