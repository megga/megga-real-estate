// Exécution SQL directe contre la base Supabase LOCALE, pour les tests qui doivent
// rejouer le SQL brut d'une migration plutôt qu'appeler une fonction — cas des blocs
// DO anonymes (ex. le backfill de 20260728105000) qui, par construction, ne laissent
// aucun objet appelable via supabase-js une fois la migration passée.
//
// Passe par le conteneur Docker de `supabase start` (jamais un accès réseau direct,
// jamais la prod : le conteneur local est le seul canal utilisé). Docker est déjà un
// prérequis dur des tests backend (voir vitest.backend.config.ts) — aucune dépendance
// supplémentaire (pas de driver `pg`, pas de binaire `psql` requis sur l'hôte).

import { execFileSync } from 'node:child_process'

function findLocalDbContainer(): string {
  const out = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf-8' }
  ).trim()
  const name = out.split('\n').find(Boolean)
  if (!name) {
    throw new Error(
      '[tests] aucun conteneur supabase_db_* en cours d’exécution. ' +
      'Lancer `supabase start` avant les tests backend.'
    )
  }
  return name
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
