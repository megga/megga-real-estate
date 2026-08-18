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
 *
 * DÉTERMINISME. Le balayage passe par `tests/unit/helpers/fs-scan.ts` : racines
 * ancrées sur le dépôt (et non sur `process.cwd()`), typage des entrées par
 * `withFileTypes`, aléas FS classés en « disparu » (ignoré) vs « illisible »
 * (signalé à part). Le pourquoi de chacun de ces trois points est documenté en
 * tête de ce module.
 *
 * Ce que ça corrige ICI, mesuré : le walk d'origine visitait trois fois le même
 * chemin (readdir → statSync → readFileSync) ; sous un écrivain concurrent, il
 * partait au rouge 7 fois sur 10 avec un `ENOENT` anonyme — aucun fichier nommé,
 * indiscernable d'une vraie cible de navigation à la racine. Le walk durci passe
 * 10 fois sur 10 sous le même churn. Il n'avait par ailleurs aucun try/catch :
 * sous un cwd inattendu il jetait `ENOENT` pendant la collecte (rouge bruyant
 * mais tout aussi anonyme, pas un vert muet).
 */
import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'

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

const SOURCE = (n: string): boolean => n.endsWith('.tsx') || n.endsWith('.ts')

/**
 * Le rail du shell est la seule exception : sa table de navigation stocke des
 * chemins NUS et les préfixe au rendu. Le test ci-dessous vérifie qu'il le fait
 * toujours — l'exception reste donc vérifiée, elle n'ouvre pas d'angle mort.
 *
 * ⚠ La comparaison `f !== SHELL` n'a de sens que si les deux côtés s'écrivent
 * pareil. `join` rend des `\` sous Windows, alors que cette constante s'écrit
 * avec des `/` : la comparaison était donc TOUJOURS vraie en local, l'exception
 * du rail ne s'appliquait jamais, et sa table de chemins nus — le comportement
 * que ce fichier documente comme légitime — se lisait comme une infraction. Vert
 * en CI (Linux), rouge sur la machine du développeur. `rel()` normalise à la
 * source : les messages d'infraction sortent eux aussi en `/`.
 */
const SHELL = 'src/components/admin/AdminShell.tsx'

const scan = scanRoots([
  { root: 'src/pages/admin', keep: SOURCE },
  { root: 'src/components/admin', keep: SOURCE },
  // Les hooks de la console ne sont pas dans un dossier à eux : on les prend par préfixe.
  { root: 'src/hooks', keep: (n) => n.startsWith('useAdmin') },
])

describe('cibles de navigation de la console admin', () => {
  it('trouve bien les fichiers de la console (sinon le test ne prouve rien)', () => {
    const vides = emptyRoots(scan)
    expect(vides, `racine(s) vide(s) — arborescence déplacée ? : ${vides.join(', ')}`).toEqual([])

    expect(scan.files.length).toBeGreaterThan(30)
    // Ancre nommée : un scan qui compte assez de fichiers mais a perdu le shell
    // ne vérifie plus l'exception du rail juste en dessous.
    expect(scan.files.map(rel), `${SHELL} hors périmètre — le scan ne voit plus la console`)
      .toContain(SHELL)
  })

  it('le rail du shell préfixe ses chemins nus au rendu', () => {
    const raw = readFileSafely(repoPath(SHELL))
    // Ici l'absence n'est PAS un aléa tolérable : ce fichier est nommé en dur et
    // le test précédent vient d'en confirmer la présence.
    expect(raw.status, `${SHELL} illisible : ${raw.status === 'unreadable' ? raw.error : 'absent'}`)
      .toBe('ok')
    expect(
      raw.status === 'ok' && raw.value.includes('${ADMIN_CONSOLE_PATH}${item.href}'),
      `${SHELL} : la table de nav stocke des chemins nus, ils DOIVENT être préfixés au rendu`,
    ).toBe(true)
  })

  it('ne contient aucune cible à la racine', () => {
    const unreadable = [...scan.unreadable]
    const offenders: Array<{ file: string; line: number; text: string }> = []

    for (const path of scan.files) {
      const file = rel(path)
      if (file === SHELL) continue
      const raw = readFileSafely(path)
      // Disparu entre le listing et l'ouverture (écrivain concurrent) : rien à
      // vérifier — une cible de navigation ne se cache pas dans un fichier absent.
      if (raw.status === 'gone') continue
      if (raw.status === 'unreadable') {
        unreadable.push(`${file} — ${raw.error}`)
        continue
      }
      raw.value.split('\n').forEach((text, i) => {
        const trimmed = text.trim()
        if (ROOT_TARGET.test(trimmed)) offenders.push({ file, line: i + 1, text: trimmed })
      })
    }

    // Distinct du verdict : un chemin illisible dit « je n'ai pas pu vérifier »,
    // pas « il reste une cible à la racine ».
    expect(unreadable,
      `Lecture FS impossible (aléa d'environnement, PAS une infraction) : ${unreadable.join(' | ')}`)
      .toEqual([])

    expect(
      offenders,
      `cible(s) de navigation à la racine — préfixer par ADMIN_CONSOLE_PATH :\n${offenders.map(o => `  ${o.file}:${o.line} — ${o.text}`).join('\n')}`,
    ).toEqual([])
  })
})

/**
 * Les DEUX pièces qui rendent le changement de page fluide dans la console.
 *
 * Elles ont en commun de ne casser strictement rien en disparaissant : l'app
 * compile, les tests passent, la console s'affiche, et le défaut ne se voit qu'à
 * l'usage, sur un écran déjà défilé ou sur une seconde fiche agence. C'est
 * exactement le régime de péremption qui justifie un test statique.
 */
/**
 * Lit un fichier NOMMÉ EN DUR, ou échoue en le disant.
 *
 * Passe par `repoPath` + `readFileSafely` comme le reste de ce module : les
 * chemins sont ancrés sur le dépôt et non sur `process.cwd()`, sinon le test
 * change de verdict selon le répertoire d'où vitest est lancé. Et l'absence
 * n'est pas tolérée ici — un fichier renommé doit faire rougir la porte, pas
 * rendre le test creux.
 */
function lireOuEchouer(chemin: string): string {
  const brut = readFileSafely(repoPath(chemin))
  if (brut.status !== 'ok') {
    throw new Error(`${chemin} illisible : ${brut.status === 'unreadable' ? brut.error : 'absent'}`)
  }
  return brut.value
}

describe('fluidité des changements de page de la console', () => {
  it('remet la colonne de contenu en haut à chaque changement de chemin', () => {
    const shell = lireOuEchouer(SHELL)

    // Le défilement n'appartient PAS à la fenêtre ici : le cadre est en
    // `overflow: hidden` et la colonne de contenu porte l'ascenseur. Comme elle
    // appartient à la coquille, elle survit au changement de page — mesuré, on
    // gardait 400 px d'une page à l'autre.
    expect(shell, 'la colonne de contenu n’est plus référencée').toMatch(/ref=\{colonne\}/)
    expect(shell, 'plus de remise à zéro du défilement').toMatch(/colonne\.current\?\.scrollTo/)

    // `useLayoutEffect` et non `useEffect` : sinon le navigateur peint une image
    // de la nouvelle page à l'ancienne hauteur, et le défaut devient un sursaut.
    const effet = shell.match(/use(Layout)?Effect\(\(\) => \{\s*colonne\.current[\s\S]*?\}, \[([^\]]*)\]\)/)
    expect(effet, 'effet de remise à zéro introuvable').not.toBeNull()
    expect(effet![1], 'la remise à zéro doit être avant peinture (useLayoutEffect)').toBe('Layout')

    // Sur le CHEMIN seul : un filtre ou un onglet s'écrit dans la query, et
    // renvoyer l'admin en haut de page à chaque case cochée serait un second défaut.
    expect(effet![2].trim()).toBe('pathname')
  })

  it('remonte CHAQUE feuille dont l’identité vient de l’URL', () => {
    const routes = lireOuEchouer('src/components/admin/AdminConsoleRoutes.tsx')
    const dynamiques = [...routes.matchAll(/<Route\s+path="([^"]*:[^"]*)"\s+element=\{([^}]*)\}/g)]

    expect(dynamiques.length, 'aucune route dynamique trouvée — sélecteur périmé ?').toBeGreaterThan(0)

    for (const [, chemin, element] of dynamiques) {
      // Sans clé sur <Routes> (et il ne faut pas en remettre), passer d'une fiche
      // à l'autre garde le MÊME élément monté : l'état local de la précédente —
      // message de confirmation, modale ouverte — s'affiche sur la suivante.
      expect(element, `la route « ${chemin} » n’est pas enveloppée de ByParam`).toContain('ByParam')
    }
  })
})

