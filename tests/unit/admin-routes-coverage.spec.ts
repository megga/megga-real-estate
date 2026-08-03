/**
 * Garde-fou : aucune route de la console admin ne peut rester hors couverture e2e.
 *
 * `tests/e2e-admin/admin-coverage.spec.ts` visite une liste de chemins ÉCRITE À LA
 * MAIN. Rien, dans un navigateur, ne connaît les routes qu'on ne lui demande pas :
 * ajouter une page au routeur sans l'ajouter à cette liste ne casse rien, ne
 * signale rien, et laisse la page libre de rendre un écran blanc ou de cracher des
 * erreurs console pendant des semaines. C'est exactement ce qui est arrivé à
 * `kyb-review`, remontée dans le CRM le 28.07 avec l'application autonome retirée :
 * routée, présente au rail, jamais visitée par la CI.
 *
 * Un test STATIQUE plutôt qu'une dérivation à l'exécution : importer
 * `AdminConsoleRoutes.tsx` depuis Playwright tirerait React, `AdminShell` et
 * dix-huit chunks lazy dans un runner qui n'en a pas besoin, pour une liste qui
 * doit de toute façon rester lisible (un libellé humain, un UUID concret pour le
 * paramètre `:id`). On ne dérive donc pas la liste — on rend impossible qu'elle
 * soit incomplète, ce qui est la propriété qui manquait.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ROUTER = 'src/components/admin/AdminConsoleRoutes.tsx'
const E2E_SPEC = 'tests/e2e-admin/admin-coverage.spec.ts'

/** Une route telle que déclarée par le routeur. */
interface DeclaredRoute {
  /** Chemin complet, préfixe de montage compris (ex. `/dashboard/admin/kyb-review`). */
  fullPath: string
  /** `<Navigate>` plutôt qu'une page : couvert par un test nommé, pas par la liste. */
  isRedirect: boolean
}

/**
 * Chemins qu'aucun test ne doit visiter — le catch-all n'est pas une destination,
 * c'est le comportement par défaut de tout ce qui n'existe pas.
 */
const NOT_A_DESTINATION = ['*']

/**
 * Routes du sous-arbre admin. `<Route element={<AdminShell />}>` (mise en page,
 * sans `path` ni `index`) ne matche pas : le motif exige l'un ou l'autre.
 */
function declaredRoutes(source: string, base: string): DeclaredRoute[] {
  const re = /<Route\s+(?:(index)|path="([^"]+)")\s+element=\{<(\w+)/g
  const out: DeclaredRoute[] = []
  for (const m of source.matchAll(re)) {
    const [, isIndex, path, element] = m
    if (path !== undefined && NOT_A_DESTINATION.includes(path)) continue
    out.push({
      fullPath: isIndex ? base : `${base}/${path}`,
      isRedirect: element === 'Navigate',
    })
  }
  return out
}

/** Valeur d'une constante `const NAME = '...'` du spec e2e. */
function stringConst(source: string, name: string): string {
  const m = new RegExp(`const ${name}\\s*=\\s*'([^']+)'`).exec(source)
  if (!m) throw new Error(`${E2E_SPEC} : constante ${name} introuvable`)
  return m[1]
}

/**
 * Résout une expression de chemin du tableau `ADMIN_ROUTES` (littéral gabarit ou
 * identifiant `BASE`). Retourne null si la forme est inconnue — le test échoue
 * alors bruyamment plutôt que d'ignorer silencieusement une entrée qu'il ne sait
 * pas lire, ce qui rouvrirait le trou qu'il est censé fermer.
 */
function resolvePathExpr(expr: string, consts: Record<string, string>): string | null {
  const trimmed = expr.trim()
  if (trimmed in consts) return consts[trimmed]
  const tpl = /^`(.*)`$/.exec(trimmed)
  if (!tpl) return null
  return tpl[1].replace(/\$\{(\w+)\}/g, (whole, name: string) => consts[name] ?? whole)
}

/** Chemins listés dans `ADMIN_ROUTES`, littéraux gabarits résolus. */
function coveredPaths(source: string, consts: Record<string, string>): string[] {
  const block = /const ADMIN_ROUTES: RouteSpec\[\] = \[([\s\S]*?)\n\]/.exec(source)
  if (!block) throw new Error(`${E2E_SPEC} : tableau ADMIN_ROUTES introuvable`)

  return [...block[1].matchAll(/\{\s*path:\s*(.+?),\s*label:/g)].map(([, expr]) => {
    const resolved = resolvePathExpr(expr, consts)
    if (resolved === null) {
      throw new Error(`${E2E_SPEC} : expression de chemin illisible — ${expr}`)
    }
    return resolved
  })
}

/** `agencies/:id` couvert par `agencies/<uuid>` : un paramètre matche un segment. */
function isCovered(fullPath: string, covered: string[]): boolean {
  if (!fullPath.includes('/:')) return covered.includes(fullPath)
  const pattern = new RegExp(
    `^${fullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\$/g, '$').replace(/:\w+/g, '[^/]+')}$`,
  )
  return covered.some((c) => pattern.test(c))
}

describe('couverture e2e des routes de la console admin', () => {
  const routerSource = readFileSync(ROUTER, 'utf-8')
  const specSource = readFileSync(E2E_SPEC, 'utf-8')
  const consts = {
    BASE: stringConst(specSource, 'BASE'),
    MOCK_UUID: stringConst(specSource, 'MOCK_UUID'),
  }
  const declared = declaredRoutes(routerSource, consts.BASE)
  const covered = coveredPaths(specSource, consts)

  // Sans ces deux bornes, une régression du parsing (routeur reformaté, tableau
  // renommé) rendrait le garde-fou vert sur zéro route comparée.
  it('lit bien le routeur et la liste e2e (sinon le test ne prouve rien)', () => {
    expect(declared.length, `${ROUTER} : aucune route lue`).toBeGreaterThan(15)
    expect(covered.length, `${E2E_SPEC} : aucun chemin lu`).toBeGreaterThan(15)
  })

  it('chaque page routée figure dans ADMIN_ROUTES', () => {
    const missing = declared
      .filter((r) => !r.isRedirect && !isCovered(r.fullPath, covered))
      .map((r) => r.fullPath)

    expect(
      missing,
      `route(s) déclarées dans ${ROUTER} et absentes d'ADMIN_ROUTES (${E2E_SPEC}) — `
      + `elles ne sont visitées par AUCUN test :\n${missing.map((p) => `  ${p}`).join('\n')}`,
    ).toEqual([])
  })

  // Une redirection n'a pas sa place dans ADMIN_ROUTES (le test paramétrique
  // affirme l'ABSENCE de redirection), mais elle doit être exercée quelque part :
  // sans quoi un ancien chemin encore présent dans des favoris peut cesser de
  // mener où que ce soit sans que rien ne le dise.
  it('chaque redirection routée est exercée par un test nommé', () => {
    const resolvedSpec = specSource
      .replaceAll('${BASE}', consts.BASE)
      .replaceAll('${MOCK_UUID}', consts.MOCK_UUID)

    const untested = declared
      .filter((r) => r.isRedirect && !resolvedSpec.includes(r.fullPath))
      .map((r) => r.fullPath)

    expect(
      untested,
      `redirection(s) déclarées dans ${ROUTER} qu'aucun test de ${E2E_SPEC} ne suit :\n`
      + untested.map((p) => `  ${p}`).join('\n'),
    ).toEqual([])
  })
})
