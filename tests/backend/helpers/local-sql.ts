// Exécution SQL directe contre la base Supabase LOCALE, pour les tests qui doivent
// rejouer le SQL brut d'une migration plutôt qu'appeler une fonction — cas des blocs
// DO anonymes (ex. le backfill de 20260728105000) qui, par construction, ne laissent
// aucun objet appelable via supabase-js une fois la migration passée.
//
// Passe par le conteneur Docker de `supabase start` (jamais un accès réseau direct,
// jamais la prod : le conteneur local est le seul canal utilisé). Docker est déjà un
// prérequis dur des tests backend (voir vitest.backend.config.ts) — aucune dépendance
// supplémentaire (pas de driver `pg`, pas de binaire `psql` requis sur l'hôte).
//
// ⚠ LE CONTENEUR SE DÉSIGNE, IL NE SE DEVINE PAS. Ce helper prenait le PREMIER
// `supabase_db_*` rendu par `docker ps`. Or `docker ps` trie par date de création
// décroissante : dès qu'une seconde instance Supabase locale tourne (autre projet,
// autre worktree), elle passe devant et le SQL part dans la mauvaise base. Constaté le
// 03.08.2026 — `relation "public.admin_log" does not exist` alors que la table existait
// bien côté megga, un échec sans aucun rapport avec le code testé. La sélection suit
// donc, dans l'ordre : SUPABASE_TEST_DB_CONTAINER, puis le `project_id` de
// supabase/config.toml (le conteneur s'appelle `supabase_db_<project_id>`), et ne
// retombe sur « l'unique conteneur qui tourne » que si ce project_id est illisible.
// Toute ambiguïté restante lève en nommant les candidats plutôt que d'en tirer un.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/** Même défaut que les specs (tests/backend/helpers/supabase.ts) — les deux doivent coïncider. */
const DEFAULT_TEST_URL = 'http://127.0.0.1:54321'

/** Hôtes acceptés pour SUPABASE_TEST_URL : `execSql` ne parle qu'à un conteneur local. */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

/**
 * `project_id` de supabase/config.toml, qui nomme les conteneurs du projet.
 * Rend `null` si le fichier est introuvable ou le champ absent — l'appelant se replie
 * alors sur une sélection par élimination, jamais sur un choix arbitraire.
 */
export function readProjectId(): string | null {
  try {
    const configPath = path.resolve(fileURLToPath(import.meta.url), '../../../../supabase/config.toml')
    return readFileSync(configPath, 'utf-8').match(/^\s*project_id\s*=\s*"([^"]+)"/m)?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * Choisit le conteneur Postgres à interroger parmi ceux qui tournent.
 *
 * Pure (elle reçoit la sortie de `docker ps` au lieu de l'appeler) pour être testable
 * sans Docker : voir tests/unit/local-sql-container.spec.ts.
 */
export function pickDbContainer(opts: {
  /** Noms des conteneurs `supabase_db_*` en cours d'exécution. */
  running: string[]
  /** `project_id` du dépôt, ou `null` s'il n'a pas pu être lu. */
  projectId: string | null
  /** Valeur de SUPABASE_TEST_DB_CONTAINER, qui l'emporte sur tout le reste. */
  override?: string | null
}): string {
  // Comparaison sur le nom EXACT : `docker ps --filter name=` matche par sous-chaîne,
  // donc un projet `megga` et un projet `megga-bis` se retrouvent tous deux dans la liste.
  const running = opts.running.filter(Boolean)
  const liste = running.length ? running.join(', ') : '(aucun)'

  if (opts.override) {
    if (running.includes(opts.override)) return opts.override
    throw new Error(
      `[tests] SUPABASE_TEST_DB_CONTAINER=${opts.override} ne correspond à aucun conteneur en cours ` +
      `d'exécution. Conteneurs supabase_db_* actifs : ${liste}.`
    )
  }

  if (!running.length) {
    throw new Error(
      '[tests] aucun conteneur supabase_db_* en cours d’exécution. ' +
      'Lancer `supabase start` avant les tests backend.'
    )
  }

  if (opts.projectId) {
    const attendu = `supabase_db_${opts.projectId}`
    if (running.includes(attendu)) return attendu
    throw new Error(
      `[tests] ${attendu} — le conteneur du projet (project_id « ${opts.projectId} » de ` +
      `supabase/config.toml) — n'est pas en cours d'exécution. Lancer \`supabase start\` DEPUIS CE DÉPÔT. ` +
      `Les conteneurs supabase_db_* actifs appartiennent à d'autres projets : ${liste} ; en interroger un ` +
      `produirait des erreurs sans rapport avec le code testé.`
    )
  }

  if (running.length > 1) {
    throw new Error(
      `[tests] plusieurs conteneurs supabase_db_* tournent et le project_id de supabase/config.toml est ` +
      `illisible : impossible de trancher sans deviner. Candidats : ${liste}. Désambiguïser avec ` +
      `SUPABASE_TEST_DB_CONTAINER=<nom>, ou arrêter les instances Supabase des autres projets.`
    )
  }

  return running[0]
}

/**
 * Vérifie que SUPABASE_TEST_URL (ce que lisent les specs, via PostgREST) et le conteneur
 * retenu (ce dans quoi `execSql` écrit) désignent la MÊME instance.
 *
 * Le lien entre les deux est le kong du projet : c'est lui qui publie le port de l'URL.
 * Sans preuve — kong non listé, ports non publiés — on ne rend aucun verdict plutôt que
 * d'en inventer un (`supabase start -x kong` reste licite).
 */
export function assertUrlMatchesContainer(opts: {
  /** Conteneur retenu, de la forme `supabase_db_<project_id>`. */
  container: string
  /** Valeur de SUPABASE_TEST_URL. */
  testUrl: string
  /** Lignes `<nom>\t<ports>` des conteneurs `supabase_kong_*` en cours d'exécution. */
  kongRows: string[]
}): void {
  let url: URL
  try {
    url = new URL(opts.testUrl)
  } catch {
    throw new Error(`[tests] SUPABASE_TEST_URL illisible : ${opts.testUrl}`)
  }

  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(
      `[tests] SUPABASE_TEST_URL cible ${url.host}, qui n'est pas une instance locale, alors qu'execSql ne ` +
      `sait parler qu'au conteneur Docker local (${opts.container}). Les specs liraient une base pendant ` +
      `qu'execSql écrirait dans une autre. Pointer SUPABASE_TEST_URL sur l'instance locale.`
    )
  }

  const kong = `supabase_kong_${opts.container.replace(/^supabase_db_/, '')}`
  const ports = opts.kongRows
    .filter((row) => row.split('\t')[0] === kong)
    .flatMap((row) => [...(row.split('\t')[1] ?? '').matchAll(/:(\d+)->/g)].map((m) => m[1]))
  if (!ports.length) return

  const urlPort = url.port || (url.protocol === 'https:' ? '443' : '80')
  if (ports.includes(urlPort)) return

  throw new Error(
    `[tests] SUPABASE_TEST_URL (port ${urlPort}) et le conteneur ${opts.container} (dont le kong publie ` +
    `${[...new Set(ports)].join(', ')}) désignent DEUX instances Supabase locales différentes : les specs ` +
    `liraient l'une pendant qu'execSql écrirait dans l'autre. Aligner SUPABASE_TEST_URL sur le port ` +
    `${ports[0]}, ou SUPABASE_TEST_DB_CONTAINER sur l'instance visée par l'URL.`
  )
}

/** Lignes non vides d'un `docker ps` — une par conteneur. */
function dockerPs(args: string[]): string[] {
  return execFileSync('docker', ['ps', ...args], { encoding: 'utf-8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Résolu une fois par processus : `execSql` est appelé des centaines de fois par run. */
let resolvedContainer: string | null = null

function findLocalDbContainer(): string {
  if (resolvedContainer) return resolvedContainer

  const container = pickDbContainer({
    running: dockerPs(['--filter', 'name=supabase_db_', '--format', '{{.Names}}']),
    projectId: readProjectId(),
    override: process.env.SUPABASE_TEST_DB_CONTAINER ?? null,
  })

  assertUrlMatchesContainer({
    container,
    testUrl: process.env.SUPABASE_TEST_URL ?? DEFAULT_TEST_URL,
    kongRows: dockerPs(['--filter', 'name=supabase_kong_', '--format', '{{.Names}}\t{{.Ports}}']),
  })

  resolvedContainer = container
  return resolvedContainer
}

/** Exécute du SQL contre la base Supabase locale (psql dans le conteneur Docker). */
export function execSql(sql: string): void {
  const container = findLocalDbContainer()
  execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
}
