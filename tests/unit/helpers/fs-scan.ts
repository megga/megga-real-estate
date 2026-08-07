/**
 * Balayage de fichiers pour les garde-fous statiques (tests/unit/*.spec.ts).
 *
 * POURQUOI CE MODULE EXISTE. Plusieurs garde-fous lisent l'arbre du dépôt pour
 * vérifier un invariant de code (« aucune écriture de dossier_status=verified »,
 * « toute écriture dans activity_events pose une category », « aucun export CSV
 * dans la console », « aucune cible de nav admin à la racine »). Tous partageaient
 * deux défauts de lecture FS — l'un rendait le rouge FAUX, l'autre rendait le vert
 * FAUX. Les corriger quatre fois séparément, c'est se garantir qu'ils divergeront.
 *
 * ── Défaut 1 : rouge intermittent (course de fichiers) ────────────────────────
 * Le walk historique VISITAIT TROIS FOIS le même chemin : `readdirSync(dir)` pour
 * le lister, `statSync(p)` pour le typer, `readFileSync(p)` pour le lire. Entre
 * deux visites, un écrivain concurrent — `node scripts/check-edge-roster.mjs
 * --write` qui régénère src/lib/edgeFunctionRoster.ts, un `git checkout`, un
 * éditeur qui sauvegarde — peut faire disparaître le chemin. Résultat : un
 * `Error: ENOENT … open '…'` non rattrapé, remonté SOUS LE NOM DU TEST et sans
 * nommer le moindre fichier fautif — indiscernable d'une vraie violation.
 *
 * Un garde-fou qui crie au loup finit ignoré, puis désactivé. Deux corrections :
 *
 *  1. Le type vient de l'entrée de répertoire (`withFileTypes`) : le `statSync` de
 *     typage — donc sa fenêtre de course — disparaît. On ne re-stat que les liens
 *     symboliques, que `Dirent` ne résout pas.
 *  2. Les erreurs FS sont CLASSÉES au lieu d'être propagées. Un chemin qui
 *     s'évapore entre le listing et l'ouverture (`ENOENT`/`ENOTDIR`) est ignoré
 *     sans bruit : il n'y a aucun invariant à vérifier dans un fichier qui
 *     n'existe pas, et personne ne dissimule du code dedans. Un chemin qui EXISTE
 *     mais refuse de s'ouvrir (verrou antivirus ou indexeur : `EBUSY`, `EPERM`…)
 *     est réessayé, puis remonté comme ILLISIBLE — un aveu d'« je n'ai pas pu
 *     vérifier », jamais confondu avec un coupable.
 *
 * ── Défaut 2 : racines relatives au cwd ───────────────────────────────────────
 * Les racines s'écrivaient `'src/hooks'`, `'supabase/functions'`… résolues contre
 * `process.cwd()`. Lancé depuis un autre répertoire, chaque garde-fou dégénérait —
 * mais PAS de la même façon, et la mesure (probe du 07.08.2026, cwd forcé sur
 * `src/`) vaut mieux que l'intuition :
 *
 *  · walks sans try/catch (activity-events, admin-console-paths) : `readdirSync`
 *    JETTE `ENOENT` pendant la collecte. Rouge — bruyant, mais anonyme : l'erreur
 *    remonte sous le nom du test sans dire quelle racine a manqué, exactement la
 *    même signature illisible que la course du défaut 1.
 *  · walks gardés par `existsSync` (no-csv-export) : scan VIDE, en silence. Là,
 *    son contrôle positif (`> 20 fichiers`) rattrape la chute — mais son
 *    assertion « le helper exportCsv a disparu » passe au VERT pour une mauvaise
 *    raison : `existsSync` ne jette jamais, il répond simplement « non » quand on
 *    regarde au mauvais endroit. Un faux négatif muet.
 *
 * Ancrer les racines sur l'emplacement de CE fichier supprime la classe entière :
 * plus de dépendance au cwd, donc ni ENOENT anonyme ni scan vide. Chaque garde-fou
 * garde en plus un contrôle positif nommé (racines non vides + fichier témoin
 * présent), qui transforme un arbre déplacé en diagnostic lisible plutôt qu'en
 * trace d'exception.
 *
 * ── Détail annexe : sortie stable ─────────────────────────────────────────────
 * `readdir` n'a pas d'ordre garanti et `join` rend des `\` sous Windows. Les
 * entrées sont triées et les chemins rendus repo-relatifs en `/` : deux exécutions
 * listent les mêmes coupables dans le même ordre, et un diff reste lisible.
 *
 * Le même traitement a été appliqué à `kyc-verified-source-guard.test.ts`, où le
 * défaut a d'abord été reproduit (ancien walk : 10 échecs sur 10 sous churn
 * concurrent ; walk durci : 10 succès sur 10).
 */
import { readFileSync, readdirSync, statSync, type Dirent } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'

/**
 * Racine du dépôt, ancrée sur ce fichier et NON sur `process.cwd()`.
 * Ce module vit à `tests/unit/helpers/` → trois niveaux à remonter.
 * Si on le déplace, les contrôles positifs des garde-fous rougissent (racines
 * vides) — c'est exactement leur rôle.
 */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Dossiers jamais balayés : dépendances et code archivé ne portent pas d'invariant. */
const SKIP_DIRS = new Set(['node_modules', '_archived'])

/** Le chemin n'existe plus — il n'y a aucun invariant à vérifier dedans. */
const GONE = new Set(['ENOENT', 'ENOTDIR'])
/** Le chemin existe mais est momentanément verrouillé (antivirus, indexeur) — ça vaut un retry. */
const LOCKED = new Set(['EBUSY', 'EPERM', 'EACCES', 'EMFILE', 'ENFILE', 'EAGAIN'])

/** Chemin repo-relatif à séparateurs `/` — sortie stable sous Windows comme sous Linux. */
export const rel = (p: string): string => relative(REPO, p).split(sep).join('/')

/** Chemin absolu à partir d'un chemin repo-relatif — à substituer à tout littéral cwd-relatif. */
export const repoPath = (...segments: string[]): string => join(REPO, ...segments)

export type Attempt<T> =
  | { status: 'ok'; value: T }
  | { status: 'gone' }
  | { status: 'unreadable'; error: string }

/**
 * Lecture FS synchrone tolérante aux aléas, et qui les CLASSE.
 *
 * `gone` ≠ `unreadable`, et c'est tout l'objet du correctif : un fichier listé par
 * readdir puis supprimé avant qu'on l'ouvre ne dissimule rien, donc on l'ignore ;
 * un fichier qui EXISTE mais refuse de s'ouvrir empêche réellement de vérifier
 * l'invariant, donc on le signale.
 *
 * L'attente du retry est bloquante faute d'API sync alternative — chemin froid
 * (≤ 40 ms, seulement après un échec de lecture sur un fichier verrouillé).
 */
export function readSafely<T>(op: () => T): Attempt<T> {
  let last: unknown
  for (const delay of [0, 10, 30]) {
    if (delay) {
      const until = Date.now() + delay
      while (Date.now() < until) { /* pause bloquante volontaire */ }
    }
    try {
      return { status: 'ok', value: op() }
    } catch (err) {
      last = err
      const code = (err as NodeJS.ErrnoException).code
      if (code && GONE.has(code)) return { status: 'gone' }
      if (!code || !LOCKED.has(code)) break
    }
  }
  // Les erreurs fs de Node portent déjà leur code dans le message ; ne pas le répéter.
  return { status: 'unreadable', error: (last as NodeJS.ErrnoException)?.message ?? String(last) }
}

/** Lit un fichier source, en classant les aléas FS. `absPath` vient de `scanRoots`. */
export function readFileSafely(absPath: string): Attempt<string> {
  return readSafely(() => readFileSync(absPath, 'utf8'))
}

/** Une racine à balayer, et le filtre qui décide des fichiers retenus. */
export interface RootSpec {
  /** Racine repo-relative, séparateurs `/` (ex. `'src/pages/admin'`). */
  root: string
  /** Retient un fichier sur son NOM de base — jamais sur son chemin complet. */
  keep: (name: string) => boolean
}

export interface Scan {
  /** Chemins ABSOLUS des fichiers retenus, ordre stable. À passer à `readFileSafely`. */
  files: string[]
  /** `chemin — message` pour ce qu'on n'a PAS pu lire : aléa d'environnement, pas un verdict. */
  unreadable: string[]
  /** Nombre de fichiers trouvés par racine — matière du contrôle positif anti-scan-vide. */
  filesPerRoot: Record<string, number>
}

/** `withFileTypes` ne résout pas les liens : on ne re-stat QUE pour eux. */
function isDirectory(entry: Dirent, path: string, unreadable: string[]): boolean {
  if (!entry.isSymbolicLink()) return entry.isDirectory()
  const stat = readSafely(() => statSync(path))
  if (stat.status === 'unreadable') unreadable.push(`${rel(path)} — ${stat.error}`)
  return stat.status === 'ok' && stat.value.isDirectory()
}

function collect(dir: string, keep: (name: string) => boolean, files: string[], unreadable: string[]): void {
  const listing = readSafely(() => readdirSync(dir, { withFileTypes: true }))
  // Une racine absente ne remonte PAS ici : le contrôle positif de chaque garde-fou
  // la nomme, avec un diagnostic bien plus parlant qu'une ligne « unreadable ».
  if (listing.status === 'gone') return
  if (listing.status === 'unreadable') {
    unreadable.push(`${rel(dir)}/ — ${listing.error}`)
    return
  }
  const entries = [...listing.value].sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (isDirectory(entry, path, unreadable)) collect(path, keep, files, unreadable)
    else if (keep(entry.name)) files.push(path)
  }
}

/**
 * Balaye récursivement les racines données et rend les fichiers retenus.
 *
 * Les racines sont résolues contre {@link REPO}, jamais contre `process.cwd()` :
 * un cwd inattendu ne peut donc plus vider le scan en silence.
 */
export function scanRoots(specs: readonly RootSpec[]): Scan {
  const files: string[] = []
  const unreadable: string[] = []
  const filesPerRoot: Record<string, number> = {}

  for (const { root, keep } of specs) {
    const found: string[] = []
    collect(repoPath(root), keep, found, unreadable)
    // `+=` et non `=` : deux specs peuvent viser la même racine avec des filtres
    // distincts, et le total doit rester le nombre de fichiers effectivement vus.
    filesPerRoot[root] = (filesPerRoot[root] ?? 0) + found.length
    files.push(...found)
  }

  return { files, unreadable, filesPerRoot }
}

/** Racines rendues vides par le scan — le symptôme d'un arbre ou d'un chemin cassé. */
export function emptyRoots(scan: Scan): string[] {
  return Object.keys(scan.filesPerRoot).filter((r) => scan.filesPerRoot[r] === 0)
}
