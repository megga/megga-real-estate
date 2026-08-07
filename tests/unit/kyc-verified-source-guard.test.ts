import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, type Dirent } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'

/**
 * Garde-fou « règle d'or » LBA : la SEULE ÉCRITURE de dossier_status='verified'
 * vit dans la fonction trigger auto_verify_kyc_dossier (baseline). Tout autre
 * WRITE = bug LBA. On ne flague QUE les écritures — jamais les comparaisons
 * (===, WHERE, CHECK, IS DISTINCT FROM) ni les CHECK d'enum.
 *
 * DÉTERMINISME (incident du 06.08.2026). Ce guard partait au rouge par
 * intermittence sous `npm run test:unit` alors qu'il passait seul, SANS JAMAIS
 * nommer de fichier — signature d'une erreur FS, pas d'une violation. Un guard
 * qui crie au loup finit ignoré : le 06.08.2026 `main` a été déclaré cassé à
 * tort et une PR de sécurité retenue parce que des guards étaient rouges pour
 * des raisons non réelles (cf. PR #1177).
 *
 * Cause reproduite (churn de fichiers concurrent pendant le scan) : le walk
 * LISTE un chemin puis le REVISITE — `statSync` pour le typer, `readFileSync`
 * pour le lire. Entre les deux, un écrivain concurrent (`check-edge-roster.mjs
 * --write` régénère src/lib/edgeFunctionRoster.ts, un `git checkout`, un
 * éditeur) peut le faire disparaître → ENOENT non rattrapé → `Error: ENOENT …
 * open '…'` sous le nom du test, sans le moindre coupable nommé. Trois
 * corrections :
 *
 *  1. Le type vient désormais de l'entrée de répertoire (`withFileTypes`) :
 *     le statSync de typage, donc sa fenêtre de course, disparaît.
 *  2. Un chemin qui s'évapore entre le listing et l'ouverture est IGNORÉ — un
 *     writer rogue ne se cache pas dans un fichier inexistant. Seul un fichier
 *     qui EXISTE et refuse de s'ouvrir (verrou antivirus/indexeur : EBUSY,
 *     EPERM…) est signalé, après retry, comme ILLISIBLE — et jamais confondu
 *     avec un coupable.
 *  3. Racines relatives au cwd : un cwd inattendu faisait échouer readdirSync,
 *     que l'ancien `catch { return [] }` transformait en scan VIDE, donc en VERT
 *     silencieux. Les racines sont ancrées sur ce fichier, et le test « scanne
 *     réellement les trois racines » rougit si le scan cesse de voir l'arbre.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ROOTS = ['supabase/functions', 'supabase/migrations', 'src'] as const
const SKIP_DIRS = new Set(['node_modules', '_archived'])
const SOURCE_EXT = /\.(ts|tsx|sql)$/

// Écriture seule — mêmes motifs (et mêmes drapeaux) qu'à l'origine.
const WRITE_PATTERNS = [
  ['TS_WRITE', /dossier_status\s*:\s*['"]verified['"]/],   // .update({ dossier_status: 'verified' })
  ['SQL_SET', /set\s+dossier_status\s*=\s*'verified'/i],   // UPDATE ... SET dossier_status='verified'
  ['SQL_ASSIGN', /dossier_status\s*:=\s*'verified'/i],     // affectation plpgsql
] as const

// Le seul écrivain légitime, et la preuve que le scan fonctionne encore.
const BASELINE = 'supabase/migrations/00000000000000_baseline_remote_schema.sql'
const ALLOWLIST_TOKEN = 'auto_verify_kyc_dossier'

/** Le chemin n'existe plus — il n'y a aucun invariant à vérifier dedans. */
const GONE = new Set(['ENOENT', 'ENOTDIR'])
/** Le chemin existe mais est momentanément verrouillé (antivirus, indexeur) — ça vaut un retry. */
const LOCKED = new Set(['EBUSY', 'EPERM', 'EACCES', 'EMFILE', 'ENFILE', 'EAGAIN'])

/** Chemin repo-relatif à séparateurs `/` — sortie stable sous Windows comme sous Linux. */
const rel = (p: string): string => relative(REPO, p).split(sep).join('/')

type Attempt<T> =
  | { status: 'ok'; value: T }
  | { status: 'gone' }
  | { status: 'unreadable'; error: string }

/**
 * Lecture FS synchrone tolérante aux aléas, et qui les CLASSE.
 *
 * `gone` ≠ `unreadable`, et c'est tout l'objet du correctif : un fichier listé
 * par readdir puis supprimé avant qu'on l'ouvre ne dissimule rien (un writer
 * rogue ne peut pas se cacher dans un fichier qui n'existe pas), donc on
 * l'ignore. Un fichier qui EXISTE mais refuse de s'ouvrir, lui, empêche
 * réellement de vérifier l'invariant : on le signale et le test rougit.
 *
 * L'attente du retry est bloquante faute d'API sync alternative — chemin froid
 * (≤ 40 ms, seulement après un échec de lecture sur un fichier verrouillé).
 */
function readSafely<T>(op: () => T): Attempt<T> {
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

/**
 * Neutralise les lignes ENTIÈREMENT commentées. Règle volontairement étroite :
 * si les premiers caractères non blancs sont `//` ou `--`, la ligne est un
 * commentaire dans les DEUX langages — aucun risque de rogner une chaîne.
 *
 * Pourquoi : hors baseline, les deux seuls fichiers que le motif attrapait le
 * faisaient DEPUIS UN COMMENTAIRE (MobileKycListScreen.tsx L23, migration
 * 20260522_003 L9), et ne restaient verts que parce qu'une AUTRE ligne de
 * commentaire citait auto_verify_kyc_dossier. Reformuler l'une des deux passait
 * le guard au rouge sans qu'aucune écriture n'existe : exactement le faux
 * positif qu'on cherche à éliminer.
 */
function stripFullLineComments(src: string): string {
  return src.split('\n').map((line) => (/^\s*(\/\/|--)/.test(line) ? '' : line)).join('\n')
}

interface ScanResult {
  /** Fichiers scannés, chemins repo-relatifs. */
  files: string[]
  /** Chemins qu'on n'a PAS pu lire — aléa d'environnement, à distinguer d'un coupable. */
  unreadable: string[]
  /** `chemin:ligne [MOTIF]` pour chaque écriture interdite. */
  offenders: string[]
  /** Fichiers qui écrivent mais citent le trigger légitime. */
  allowlisted: string[]
  filesPerRoot: Record<string, number>
}

function collect(dir: string, files: string[], unreadable: string[]): void {
  const listing = readSafely(() => readdirSync(dir, { withFileTypes: true }))
  // Une racine absente ne remonte PAS ici : le test « scanne réellement les
  // trois racines » la nomme, avec un diagnostic bien plus parlant.
  if (listing.status === 'gone') return
  if (listing.status === 'unreadable') {
    unreadable.push(`${rel(dir)}/ — ${listing.error}`)
    return
  }
  // readdir n'a pas d'ordre garanti : sans tri, deux exécutions peuvent sortir
  // les mêmes coupables dans un ordre différent, et le diff devient illisible.
  const entries = [...listing.value].sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (isDirectory(entry, path, unreadable)) collect(path, files, unreadable)
    else if (SOURCE_EXT.test(entry.name)) files.push(path)
  }
}

/** `withFileTypes` ne suit pas les liens : on ne re-stat QUE pour eux. */
function isDirectory(entry: Dirent, path: string, unreadable: string[]): boolean {
  if (!entry.isSymbolicLink()) return entry.isDirectory()
  const stat = readSafely(() => statSync(path))
  if (stat.status === 'unreadable') unreadable.push(`${rel(path)} — ${stat.error}`)
  return stat.status === 'ok' && stat.value.isDirectory()
}

let cached: ScanResult | null = null

function scan(): ScanResult {
  if (cached) return cached
  const unreadable: string[] = []
  const offenders: string[] = []
  const allowlisted: string[] = []
  const files: string[] = []
  const filesPerRoot: Record<string, number> = {}

  for (const root of ROOTS) {
    const found: string[] = []
    collect(join(REPO, root), found, unreadable)
    filesPerRoot[root] = found.length
    for (const path of found) {
      const raw = readSafely(() => readFileSync(path, 'utf8'))
      // Disparu entre le listing et l'ouverture (écrivain concurrent) : rien à
      // vérifier, on passe. C'était LA cause du rouge intermittent historique.
      if (raw.status === 'gone') continue
      if (raw.status === 'unreadable') {
        unreadable.push(`${rel(path)} — ${raw.error}`)
        continue
      }
      const code = stripFullLineComments(raw.value)
      const hit = WRITE_PATTERNS.find(([, re]) => re.test(code))
      if (!hit) continue
      // Allowlist : citer la fonction trigger légitime. Un writer rogue
      // (edge/app) ne référencerait jamais ce trigger SQL.
      if (code.includes(ALLOWLIST_TOKEN)) {
        allowlisted.push(rel(path))
        continue
      }
      const [name, re] = hit
      const line = code.split('\n').findIndex((l) => re.test(l)) + 1
      offenders.push(`${rel(path)}:${line} [${name}]`)
    }
    files.push(...found.map(rel))
  }

  cached = { files, unreadable, offenders, allowlisted, filesPerRoot }
  return cached
}

describe("KYC règle d'or — dossier_status=verified", () => {
  // Passe d'abord : si le scan n'a rien vu, le test suivant serait vert POUR RIEN.
  it('scanne réellement les trois racines', () => {
    const { files, filesPerRoot, allowlisted } = scan()

    const emptyRoots = ROOTS.filter((r) => filesPerRoot[r] === 0)
    expect(emptyRoots, `Racines vides (cwd ou arborescence cassée ?) : ${emptyRoots.join(', ')}`).toEqual([])

    expect(files, `${BASELINE} introuvable — le scan ne couvre plus les migrations`).toContain(BASELINE)

    // Le baseline écrit 'verified' DANS auto_verify_kyc_dossier : il doit rester
    // détecté comme écriture ET couvert par l'allowlist. S'il tombe de cette
    // liste, c'est le détecteur ou l'allowlist qui a cessé de fonctionner.
    expect(allowlisted, 'Écrivain légitime perdu de vue — motifs ou allowlist cassés').toContain(BASELINE)
  })

  it("n'est écrit nulle part hors la fonction auto_verify_kyc_dossier", () => {
    const { offenders, unreadable } = scan()

    // Distinct du verdict : un chemin illisible dit « je n'ai pas pu vérifier »,
    // pas « quelqu'un écrit verified ». Sans cette séparation, un aléa FS
    // ressemblait à une violation LBA.
    expect(unreadable, `Lecture FS impossible (aléa d'environnement, PAS une violation) : ${unreadable.join(' | ')}`).toEqual([])

    expect(offenders, `Writers verified interdits : ${offenders.join(', ')}`).toEqual([])
  })
})
