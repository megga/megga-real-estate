/**
 * Lecture du REGISTRE MEGGA (`admin_log`) pour l'écran Sécurité de la console.
 *
 * ⚠ CE N'EST PAS LA MÊME SOURCE QUE `useSecurityAudit`, ET C'EST TOUT LE SUJET.
 * `useSecurityAudit` lit `activity_events` — le journal des AGENCES : connexions, décisions
 * KYC, modération. Ce hook-ci lit `admin_log` — le registre de ce que MEGGA fait SUR une
 * agence, seul journal doté d'une chaîne d'empreintes. Les deux coexistent à l'écran parce
 * qu'ils répondent à deux questions différentes ; les confondre était précisément le défaut
 * que le remboursement de la dette du registre a corrigé côté écriture (migration
 * `20260802180000`), sans que personne n'ait jamais câblé la lecture.
 *
 * Tout le travail est fait par `get_admin_security_journal`, et il vaut la peine de savoir
 * ce qu'elle garantit — pour ne pas le refaire, moins bien, côté client :
 *   · elle est GARDÉE (`is_super_admin()`), donc aucun filtrage de confort ici ;
 *   · elle exclut les lignes `routine` (le cron horaire de vérification de chaîne n'a rien
 *     à faire dans un journal qu'on lit à l'œil) ;
 *   · elle PAGINE côté serveur et rend `total_count` — d'où `keepPreviousData`, sinon la
 *     table clignote à chaque page ;
 *   · elle compose déjà l'entité en libellé lisible (`Agence · Nom · …`) ;
 *   · elle rend la metadata en PAIRES ORDONNÉES `[[libellé, valeur], …]`, jamais un objet :
 *     l'ordre porte du sens (le fait avant sa conséquence) et `jsonb_agg` sans `order by`
 *     ne le garantirait pas. `null` sur tableau vide, parce que `[]` est truthy en JS et
 *     ouvrirait un bloc de détails muet.
 *
 * Vocabulaires FERMÉS, refusés en `22023` par la base si on invente une valeur — d'où les
 * types littéraux ci-dessous plutôt que `string`.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Fenêtres admises par `admin_security_window` — toute autre valeur lève `22023`. */
export type JournalWindow = 'today' | 'rolling_24h' | 'month'

/** Sévérités du registre. ⚠ Vocabulaire DISTINCT de celui d'`activity_events`, qui écrit
 *  `critical`/`warning`/`info` : la traduction se fait AU BORD (voir la page). */
export type JournalSeverity = 'crit' | 'warn' | 'info'

/** Les 12 familles de §4.2/§6, telles que les porte `admin_log_family`. */
export const JOURNAL_FAMILIES = [
  'session', 'identity', 'lifecycle', 'plans', 'deploy', 'export',
  'link', 'diffusion', 'comm', 'ai', 'ops', 'kyb',
] as const
export type JournalFamily = (typeof JOURNAL_FAMILIES)[number]

/** Le filtre unique de l'écran porte indifféremment une sévérité OU une famille : les deux
 *  vocabulaires sont disjoints par construction, ce que la RPC exploite pour les résoudre
 *  sans ambiguïté. */
export type JournalFilter = 'all' | JournalSeverity | JournalFamily

/** Une paire de metadata, telle que la RPC la rend : `[libellé, valeur]`. */
export type JournalPair = [string, string]

export interface JournalEntry {
  id: string
  /** `HH:MM:SS` en Europe/Zurich — la RPC ne rend PAS la date : la fenêtre la porte. */
  ts: string
  sev: JournalSeverity
  fam: JournalFamily
  action: string
  action_params: Record<string, unknown> | null
  /**
   * Libellé composé côté serveur (`Agence · Nom`), déjà lisible.
   * ⚠ Vaut la chaîne VIDE — jamais `null` — quand aucune des trois parties n'est
   * renseignée : `admin_security_entity` assemble par `array_to_string`. Tester avec `||`,
   * pas `??` (mesuré sur la production).
   */
  entity: string
  /** `actor_label` : un nom, ou « Système » pour un geste machine. */
  actor: string | null
  /** `null` — jamais `[]` — quand il n'y a aucune paire. */
  meta: JournalPair[] | null
  total_count: number
}

export interface JournalParams {
  window: JournalWindow
  filter: JournalFilter
  search: string
  page: number
  perPage: number
}

export interface JournalPage {
  entries: JournalEntry[]
  total: number
}

/**
 * Une page du registre. `page` est 1-indexée côté écran ; la RPC attend un offset.
 *
 * La recherche est transmise telle quelle : la RPC neutralise les jokers et IGNORE (sans
 * rejeter) toute recherche de moins de 3 caractères. Filtrer ici en plus ferait diverger
 * l'affichage du `total_count`, qui est calculé côté serveur avec les mêmes prédicats.
 */
export function useAdminSecurityJournal(params: JournalParams) {
  const { window, filter, search, page, perPage } = params
  return useQuery({
    queryKey: ['admin-security-journal', window, filter, search, page, perPage],
    queryFn: async (): Promise<JournalPage> => {
      const { data, error } = await supabase.rpc('get_admin_security_journal', {
        p_window: window,
        p_filter: filter,
        p_search: search.trim() || undefined,
        p_limit: perPage,
        p_offset: (page - 1) * perPage,
      })
      if (error) throw error
      const rows = (data ?? []) as unknown as JournalEntry[]
      // `total_count` est répété sur chaque ligne ; sur une page vide il n'existe pas, et
      // 0 est alors la seule valeur juste.
      return { entries: rows, total: rows.length > 0 ? Number(rows[0].total_count) : 0 }
    },
    placeholderData: keepPreviousData,
  })
}
