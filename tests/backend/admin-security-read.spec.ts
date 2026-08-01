// Backend integration spec (live CI) — l'écran Sécurité en lecture
// (migration 20260801260000, étape 14 du plan, spec §5.9, §7, §10.4, §10.5).
//
// Écrite APRÈS coup : la migration est livrée depuis le 31.07, ses tests ne l'étaient pas.
// L'étape 10 a montré ce que ça coûte — `get_admin_kyc_funnel_30d`, cochée ✅ sans qu'aucune
// spec ne l'appelle, levait 42804 à chaque appel. Une migration qui s'applique ne prouve que
// la SYNTAXE : plpgsql ne vérifie les types du corps qu'à l'exécution. Le premier test de ce
// fichier est donc le plus bête et le plus utile : les cinq fonctions RÉPONDENT-ELLES ?
//
// Ensuite, par ordre d'importance :
//
//   1. LA FENÊTRE EN EUROPE/ZURICH (§10.5). Mesuré dans la migration : la borne de Zurich
//      vaut 22:00Z quand `date_trunc('day', now())` vaut 00:00Z — deux heures d'écart, donc
//      deux listes différentes. Zurich n'est JAMAIS à UTC+0 : l'écart doit exister en toute
//      saison, et c'est ce qui rend l'assertion valable toute l'année.
//   2. LES JOKERS DE RECHERCHE. `%` et `_` tapés par l'agent ne doivent pas changer la
//      sémantique d'un `like`. Un test qui cherche un mot normal ne le verrait pas.
//   3. LA PARTITION routine / non-routine. Le journal montre l'une, le pied replié l'autre,
//      et les compteurs portent sur la PREMIÈRE — arbitrage assumé de la migration : un
//      compteur qui promet une ligne que la liste ne peut pas montrer est pire qu'un
//      compteur plus petit.
//
// ⚠ DEUX CLIENTS, CHOISIS D'APRÈS LA GARDE. Les trois `get_admin_security_*` sont gardées
// par `is_super_admin() OR is_service_role()`, SANS branche `session_user` : elles ne
// s'éprouvent pas depuis psql, où session_user vaut toujours `postgres`. En revanche
// `admin_log_write`, qui SÈME, admet `session_user in ('postgres','supabase_admin')` — elle
// s'appelle des deux façons. Ici tout passe par un client authentifié, pour rester uniforme.
//
// ⚠ `admin_log` est APPEND-ONLY : les lignes semées ne sont ni modifiables ni supprimables.
// D'où des assertions RELATIVES (avant/après) ou portées par un marqueur, jamais des
// égalités sur des totaux que d'autres specs font bouger en parallèle.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'
const DENIED = '42501'
const BAD_INPUT = '22023'

const runSql = (body: string) => execSql(`do $$\n${body}\nend $$;`)
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

type Row = Record<string, unknown>

describe.skipIf(!HAS_KEYS)('écran Sécurité en lecture (étape 14)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []
  let stamp = ''

  /** Écrit une ligne du registre. `admin_log_write` est la SEULE porte d'écriture. */
  const write = async (p: Record<string, unknown>): Promise<string> => {
    const { data, error } = await superClient.rpc('admin_log_write', p)
    if (error) throw new Error(`admin_log_write(${JSON.stringify(p)}): ${error.message}`)
    return data as string
  }

  const journal = async (p: Record<string, unknown> = {}): Promise<Row[]> => {
    const { data, error } = await serviceRoleClient().rpc('get_admin_security_journal', p)
    if (error) throw new Error(`journal: ${error.message}`)
    return data as Row[]
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    stamp = setup.stamp
    const svc = serviceRoleClient()
    const email = `sec-super-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super Sec ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: data.user!.id, email, full_name: `Super Sec ${stamp}`, role: 'super_admin', agency_id: null },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`profile: ${pErr.message}`)
    superClient = anonClient()
    const { error: sErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin: ${sErr.message}`)

    // ⚠ `severity` vaut info|warn|CRIT — jamais 'critical', qui est le vocabulaire
    // d'activity_events. L'écrire ici lèverait 23503 sur la clé étrangère, ferait échouer le
    // beforeAll, donc SKIPPER la suite : « N ignorés », pas « N échecs ».
    await write({
      p_family: 'ops', p_action: 'sec_test_crit', p_severity: 'crit',
      p_entity_type: 'contact', p_entity_label: `sec-crit ${stamp}`,
      p_metadata: [{ l: 'Motif', v: 'premier' }, { l: 'Portée', v: 'second' }],
    })
    await write({
      p_family: 'lifecycle', p_action: 'sec_test_warn', p_severity: 'warn',
      p_entity_type: 'agency', p_entity_label: `sec-warn ${stamp}`,
      p_agency_id: setup.agencyAId,
    })
    // Une ligne de ROUTINE : elle ne doit jamais apparaître dans la liste principale.
    await write({
      p_family: 'ops', p_action: 'sec_test_routine', p_severity: 'info',
      p_entity_type: 'cron', p_entity_label: `sec-routine ${stamp}`, p_routine: true,
    })
    // Les deux lignes du test de jokers, et celle du test d'accents.
    await write({ p_family: 'ops', p_action: 'sec_joker_a', p_entity_type: 'test',
                  p_entity_label: `secjoker-alpha ${stamp}` })
    await write({ p_family: 'ops', p_action: 'sec_joker_b', p_entity_type: 'test',
                  p_entity_label: `secjoker-beta ${stamp}` })
    await write({ p_family: 'ops', p_action: 'sec_accent', p_entity_type: 'test',
                  p_entity_label: `Sécurité ${stamp}` })
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    // admin_log n'est pas nettoyable (append-only, par conception). Seuls les comptes et
    // agences le sont.
    if (setup) await setup.cleanup()
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 0. Elles répondent ─────────────────────────────────────────────────────────

  it('LES CINQ FONCTIONS RÉPONDENT — le test que l\'étape 13 n\'avait pas', async () => {
    const svc = serviceRoleClient()
    for (const [fn, args] of [
      ['admin_security_window', { p_window: 'today' }],
      ['admin_security_entity', { p_entity_type: 'contact', p_entity_label: 'X', p_agency_name: 'Y' }],
      ['get_admin_security_journal', {}],
      ['get_admin_security_routine', {}],
      ['get_admin_security_counters', {}],
    ] as Array<[string, Record<string, unknown>]>) {
      const { error } = await svc.rpc(fn, args)
      expect(error, `${fn} doit répondre — plpgsql ne vérifie ses types qu'à l'exécution`).toBeNull()
    }
  })

  // ── 1. La fenêtre (§10.5) ──────────────────────────────────────────────────────

  it('LA FENÊTRE — « aujourd\'hui » est minuit à Zurich, jamais minuit UTC', () => {
    // Zurich n'est JAMAIS à UTC+0 : +1 en hiver, +2 en été. L'écart doit donc exister en
    // toute saison — c'est ce qui rend cette assertion valable toute l'année, et pas
    // seulement le jour où on l'écrit.
    //
    // Appelée depuis psql SANS scrupule : admin_security_window n'a pas de garde (elle ne
    // lit aucune table), contrairement aux trois get_admin_security_*.
    assertSql(`
    begin
      if public.admin_security_window('today')
         = (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') then
        raise exception 'la borne « aujourd hui » est calculee en UTC, pas en Europe/Zurich';
      end if;
      if public.admin_security_window('today')
         <> (date_trunc('day', now() at time zone 'Europe/Zurich') at time zone 'Europe/Zurich') then
        raise exception 'la borne « aujourd hui » ne vaut pas minuit de Zurich';
      end if;
      if public.admin_security_window('month')
         <> (date_trunc('month', now() at time zone 'Europe/Zurich') at time zone 'Europe/Zurich') then
        raise exception 'la borne « ce mois » ne vaut pas le 1er du mois a Zurich';
      end if;
    `)
  })

  it('une fenêtre glissante n\'a besoin d\'aucun fuseau', () => {
    assertSql(`
    begin
      if abs(extract(epoch from (
           public.admin_security_window('rolling_24h') - (now() - interval '24 hours')))) > 5 then
        raise exception 'rolling_24h ne vaut pas maintenant moins 24 heures';
      end if;
    `)
  })

  it('une fenêtre INCONNUE lève, elle ne se replie pas sur toute la table', async () => {
    // Le repli silencieux serait le pire des deux : l'écran afficherait dix ans de registre
    // en croyant montrer la journée. La fonction de fenêtre rend NULL, l'appelant lève.
    assertSql(`
    begin
      if public.admin_security_window('la-semaine-derniere') is not null then
        raise exception 'une fenetre inconnue doit rendre NULL';
      end if;
    `)
    const { error } = await serviceRoleClient()
      .rpc('get_admin_security_journal', { p_window: 'la-semaine-derniere' })
    expect(error?.code, 'le journal doit refuser une fenêtre inconnue').toBe(BAD_INPUT)
  })

  it('un FILTRE inconnu lève aussi — sévérités et familles sont disjointes', async () => {
    const svc = serviceRoleClient()
    const { error } = await svc.rpc('get_admin_security_journal', { p_filter: 'impers' })
    // `impers` est le cas réel : la maquette porte encore cette chip, le référentiel ne la
    // connaît pas (« Voir en tant que » est retiré de la V1).
    expect(error?.code, 'un filtre absent des deux référentiels doit lever').toBe(BAD_INPUT)

    // Le filtre unique porte indifféremment une sévérité OU une famille.
    for (const f of ['crit', 'ops', 'all']) {
      const { error: ok } = await svc.rpc('get_admin_security_journal', { p_filter: f })
      expect(ok, `« ${f} » est un filtre valide`).toBeNull()
    }
  })

  // ── 2. La recherche ────────────────────────────────────────────────────────────

  it('LES JOKERS — un « % » tapé ne se comporte pas comme « tout »', async () => {
    // Deux lignes semées : `secjoker-alpha` et `secjoker-beta`.
    const larges = await journal({ p_search: `secjoker`, p_limit: 100 })
    expect(larges.length, 'la recherche nue trouve les deux lignes').toBeGreaterThanOrEqual(2)

    // `secjoker%alpha` : si le « % » était passé tel quel à `like`, il matcherait
    // `secjoker-alpha`. Neutralisé, la requête devient `secjokeralpha` — qui n'existe pas.
    const avecJoker = await journal({ p_search: `secjoker%alpha`, p_limit: 100 })
    expect(avecJoker.length, 'le « % » doit être retiré, pas interprété').toBe(0)

    // Idem pour `_`, joker d'UN caractère : `secjoker_alpha` matcherait `secjoker-alpha`.
    const avecUnderscore = await journal({ p_search: `secjoker_alpha`, p_limit: 100 })
    expect(avecUnderscore.length, 'le « _ » doit être retiré, pas interprété').toBe(0)
  })

  it('la recherche est NORMALISÉE — « securite » trouve « Sécurité »', async () => {
    const trouve = await journal({ p_search: `securite ${stamp}`, p_limit: 100 })
    expect(trouve.length, 'l\'accent ne doit pas être un obstacle (unaccent)').toBeGreaterThanOrEqual(1)

    const avecAccent = await journal({ p_search: `Sécurité ${stamp}`, p_limit: 100 })
    expect(avecAccent.length, 'et la forme accentuée trouve aussi').toBeGreaterThanOrEqual(1)
  })

  it('une recherche de moins de 3 caractères est IGNORÉE, jamais rejetée', async () => {
    // §7. Rejeter forcerait l'écran à gérer une erreur pour une frappe en cours.
    const { data, error } = await serviceRoleClient()
      .rpc('get_admin_security_journal', { p_search: 'ab', p_limit: 5 })
    expect(error, 'deux caractères ne doivent pas lever').toBeNull()
    // Ignorée veut dire « comme si rien n'était tapé » : la liste reste peuplée.
    const sansRecherche = await journal({ p_limit: 5 })
    expect((data as unknown[]).length, 'la recherche courte ne filtre rien')
      .toBe(sansRecherche.length)
  })

  // ── 3. La partition routine / non-routine ──────────────────────────────────────

  it('LA PARTITION — la routine ne pollue jamais la liste principale', async () => {
    const principal = await journal({ p_limit: 100, p_search: `sec-` })
    const labels = principal.map((r) => String(r.entity ?? ''))
    expect(labels.some((l) => l.includes(`sec-crit ${stamp}`)), 'la ligne crit est listée').toBe(true)
    expect(labels.some((l) => l.includes(`sec-routine ${stamp}`)),
      'une ligne de routine n\'a rien à faire dans la liste principale').toBe(false)

    const { data: routine, error } = await serviceRoleClient()
      .rpc('get_admin_security_routine', { p_limit: 20 })
    expect(error).toBeNull()
    const rLabels = (routine as Row[]).map((r) => String(r.entity ?? ''))
    expect(rLabels.some((l) => l.includes(`sec-routine ${stamp}`)),
      'le pied replié montre la routine').toBe(true)
    expect(rLabels.some((l) => l.includes(`sec-crit ${stamp}`)),
      'et rien d\'autre').toBe(false)
  })

  it('les COMPTEURS portent sur la liste principale — l\'arbitrage assumé', async () => {
    // Un compteur qui promet une ligne que la liste ne peut pas montrer est pire qu'un
    // compteur plus petit : cliquer la puce ouvrirait « Aucun événement pour ce filtre ».
    const { data, error } = await serviceRoleClient().rpc('get_admin_security_counters')
    expect(error).toBeNull()
    const c = data as Row
    const parFamille = c.by_family as Record<string, number>
    const parSeverite = c.by_severity as Record<string, number>

    const sommeFamilles = Object.values(parFamille).reduce((s, n) => s + Number(n), 0)
    const sommeSeverites = Object.values(parSeverite).reduce((s, n) => s + Number(n), 0)
    expect(sommeFamilles, 'le total = la somme des familles').toBe(Number(c.total))
    expect(sommeSeverites, 'le total = la somme des sévérités').toBe(Number(c.total))

    // Le total de routine est rendu À PART, pour le pied — jamais fondu dans `total`.
    expect(Object.keys(c), 'routine_total est séparé').toContain('routine_total')
    expect(Number(c.routine_total), 'la ligne de routine semée y est comptée').toBeGreaterThanOrEqual(1)

    // Et le contrat qui compte : chaque puce doit pouvoir s'ouvrir sur une liste non vide.
    for (const [famille, n] of Object.entries(parFamille)) {
      if (Number(n) === 0) continue
      const liste = await journal({ p_filter: famille, p_limit: 1 })
      expect(liste.length, `la puce « ${famille} » (${n}) ouvre une liste vide`).toBeGreaterThan(0)
    }
  })

  // ── 4. Ce que l'écran affiche ──────────────────────────────────────────────────

  it('les métadonnées sortent en PAIRES ORDONNÉES, pas dans un ordre indéterminé', async () => {
    // [{l,v}] → [[l,v]]. Sans WITH ORDINALITY + ORDER BY, jsonb_agg a un ordre non
    // spécifié : l'écran afficherait la conséquence avant le fait.
    const rows = await journal({ p_search: `sec-crit ${stamp}`, p_limit: 5 })
    expect(rows.length, 'la ligne semée est retrouvée').toBeGreaterThanOrEqual(1)
    const meta = rows[0].meta as unknown[]
    expect(Array.isArray(meta), 'meta est une liste de paires').toBe(true)
    expect(meta).toEqual([['Motif', 'premier'], ['Portée', 'second']])
  })

  it('un tableau de métadonnées VIDE rend NULL, jamais `[]`', async () => {
    // `[]` est truthy en JavaScript : l'écran ouvrirait un bloc de détail muet.
    const rows = await journal({ p_search: `secjoker-beta ${stamp}`, p_limit: 5 })
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0].meta, 'aucune métadonnée ⇒ NULL, pas un tableau vide').toBeNull()
  })

  it('l\'action est une CLÉ technique, l\'heure est à Zurich', async () => {
    const rows = await journal({ p_search: `sec-crit ${stamp}`, p_limit: 5 })
    const r = rows[0]
    // La base ne stocke pas de français : l'i18n interpole côté écran (audit.action.*).
    expect(String(r.action), 'clé technique snake_case attendue').toMatch(/^[a-z0-9_]+$/)
    expect(String(r.ts), 'HH24:MI:SS').toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(r.sev).toBe('crit')
    expect(r.fam).toBe('ops')
    // L'entité est composée : « Contact · <label> », 2 ou 3 segments joints par « · ».
    expect(String(r.entity)).toContain('·')
    expect(String(r.entity)).toContain('Contact')
  })

  it('un type d\'entité INCONNU reste visible, il n\'est pas absorbé', async () => {
    const { data, error } = await serviceRoleClient().rpc('admin_security_entity', {
      p_entity_type: 'un_type_jamais_vu', p_entity_label: 'Label', p_agency_name: 'Agence',
    })
    expect(error).toBeNull()
    expect(String(data), 'un type inconnu doit rester lisible à l\'écran')
      .toBe('un_type_jamais_vu · Label · Agence')

    // Les segments vides disparaissent au lieu de produire « Contact ·  ·  ».
    const { data: court } = await serviceRoleClient().rpc('admin_security_entity', {
      p_entity_type: 'contact', p_entity_label: null, p_agency_name: '   ',
    })
    expect(String(court), 'les segments vides sont retirés').toBe('Contact')
  })

  // ── 5. La pagination ───────────────────────────────────────────────────────────

  it('l\'ordre est TOTAL — la pagination ne saute aucune ligne', async () => {
    // `ts desc` seul n'est pas un ordre total : plusieurs lignes d'une même transaction
    // partagent l'horodatage, et l'OFFSET sauterait des lignes. `seq desc` départage.
    const page1 = await journal({ p_limit: 3, p_offset: 0 })
    const page2 = await journal({ p_limit: 3, p_offset: 3 })
    const ids = [...page1, ...page2].map((r) => String(r.id))
    expect(new Set(ids).size, 'aucun doublon entre deux pages consécutives').toBe(ids.length)

    // `total_count` porte sur la sélection ENTIÈRE, pas sur la page.
    if (page1.length > 0) {
      expect(Number(page1[0].total_count), 'total_count dépasse la taille de page')
        .toBeGreaterThanOrEqual(page1.length)
    }
  })

  it('les listes sont bornées en HAUT autant qu\'en bas', async () => {
    const grand = await journal({ p_limit: 1_000_000 })
    expect(grand.length, 'plafond à 100').toBeLessThanOrEqual(100)
    const { data: routine } = await serviceRoleClient()
      .rpc('get_admin_security_routine', { p_limit: 1_000_000 })
    expect((routine as unknown[]).length, 'plafond à 20').toBeLessThanOrEqual(20)
  })

  // ── 6. La porte ────────────────────────────────────────────────────────────────

  it('LA NON-FUITE — un JWT agent est refusé sur les trois lectures', async () => {
    for (const [fn, args] of [
      ['get_admin_security_journal', {}],
      ['get_admin_security_routine', {}],
      ['get_admin_security_counters', {}],
    ] as Array<[string, Record<string, unknown>]>) {
      const { error } = await setup.clientA.rpc(fn, args)
      expect(error?.code, `${fn} doit refuser un JWT agent`).toBe(DENIED)
    }
    // Le pendant : une garde qui refuse tout le monde serait verte ci-dessus et inutile.
    const { error: ok } = await superClient.rpc('get_admin_security_counters', {})
    expect(ok, 'un super-admin allowlisté doit passer').toBeNull()
  })

  it('les deux fonctions PURES ne sont pas ouvertes à `anon`', () => {
    // Elles n'ont pas de garde — elles ne lisent aucune table, il n'y a rien derrière quoi
    // garder. Mais sans REVOKE, une fonction est exécutable par PUBLIC, donc par anon, et
    // le balayage de gardes ne les verrait pas : il ne filtre que les SECURITY DEFINER.
    assertSql(`
    begin
      if has_function_privilege('anon', 'public.admin_security_window(text)', 'EXECUTE')
         or has_function_privilege('anon', 'public.admin_security_entity(text,text,text)', 'EXECUTE') then
        raise exception 'une fonction de l ecran Securite est executable par anon';
      end if;
    `)
  })
})
