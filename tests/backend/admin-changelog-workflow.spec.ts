// Backend integration spec (live CI) — le changelog « What's new »
// (migration 20260801330000, étape 21, spec §5.10).
//
// Ce que ce fichier cherche à faire échouer :
//
//   1. LA PUBLICATION ACCIDENTELLE. `published` avait `DEFAULT TRUE` : une entrée insérée
//      sans y penser était visible de TOUS les agents. Une création doit arriver en
//      brouillon, et publier doit rester un geste séparé.
//   2. LA DIVERGENCE DES DEUX COLONNES. `published` reste la vérité de la RLS et de la page
//      Aujourd'hui ; `status` porte le workflow. « Publié sans être publié » ne doit pas
//      être REPRÉSENTABLE — c'est une contrainte, pas une convention, et le test l'attaque
//      en écriture directe.
//   3. LA PORTE D'ÉCRITURE. La table est fermée : plus d'INSERT ni de DELETE nus, sinon les
//      gestes auraient une seconde porte à côté d'eux, sans journal.
//   4. CE QUE VOIT UN AGENT. Un brouillon ne doit jamais lui parvenir.
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

const runSql = (body: string) => execSql(`do $$\n${body}\nend $$;`)
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

type Row = Record<string, unknown>

describe.skipIf(!HAS_KEYS)('changelog « What\'s new » (étape 21)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []
  let stamp = ''
  const creees: string[] = []

  /** Crée un brouillon et retient son id pour le nettoyage. */
  const creer = async (titre: string): Promise<string> => {
    const { data, error } = await serviceRoleClient().rpc('admin_changelog_save', {
      p_id: null, p_title: titre, p_content: 'contenu', p_version: '1.0',
      p_idempotency_key: `chg-${titre}`,
    })
    if (error) throw new Error(`save: ${error.message}`)
    const id = ((data as Row).data as Row).id as string
    creees.push(id)
    return id
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    stamp = setup.stamp
    const svc = serviceRoleClient()
    const email = `chglog-super-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super Chg ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: data.user!.id, email, full_name: `Super Chg ${stamp}`, role: 'super_admin', agency_id: null },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`profile: ${pErr.message}`)
    superClient = anonClient()
    const { error: sErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin: ${sErr.message}`)
  })

  afterAll(async () => {
    // La table est fermée en écriture à tous, y compris service_role : le nettoyage passe
    // par psql. C'est précisément ce que ce fichier vérifie.
    if (creees.length > 0) {
      runSql(`begin
        delete from public.admin_changelog where id in (${creees.map((i) => `'${i}'::uuid`).join(',')});`)
    }
    const svc = serviceRoleClient()
    if (setup) await setup.cleanup()
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 1. La publication accidentelle ─────────────────────────────────────────────

  it('UNE CRÉATION ARRIVE EN BROUILLON — jamais publiée d\'office', async () => {
    // `published` avait DEFAULT TRUE : une entrée insérée sans y penser partait à tous les
    // agents. C'est le pire défaut possible sur un journal de nouveautés.
    const id = await creer(`brouillon-${stamp}`)
    const { data } = await serviceRoleClient().from('admin_changelog')
      .select('status, published, published_at').eq('id', id).single()
    expect((data as Row).status).toBe('draft')
    expect((data as Row).published).toBe(false)
    expect((data as Row).published_at).toBeNull()
  })

  it('le DEFAULT de la colonne est corrigé, pas seulement contourné par la RPC', () => {
    // Si la RPC posait `false` sur un DEFAULT resté TRUE, toute autre voie d'écriture
    // (migration, script, correctif à chaud) republierait le défaut.
    assertSql(`
    declare v_def text;
    begin
      select column_default into v_def from information_schema.columns
       where table_schema='public' and table_name='admin_changelog' and column_name='published';
      if v_def is null or v_def ilike '%true%' then
        raise exception 'published a encore un DEFAULT publiant : %', coalesce(v_def,'(null)');
      end if;
    `)
  })

  // ── 2. La divergence, rendue impossible ────────────────────────────────────────

  it('« PUBLIÉ SANS ÊTRE PUBLIÉ » n\'est pas représentable', () => {
    // La contrainte, pas la convention. Le test attaque en écriture DIRECTE (psql, donc
    // sans passer par les gestes) : c'est la seule façon de vérifier que c'est la BASE qui
    // refuse, et non la discipline des RPC.
    assertSql(`
    declare v_id uuid; v_a_leve boolean := false;
    begin
      insert into public.admin_changelog (title, content, status, published)
           values ('accord-test', '', 'draft', false) returning id into v_id;
      begin
        update public.admin_changelog set published = true where id = v_id;
      exception when check_violation then
        v_a_leve := true;
      end;
      delete from public.admin_changelog where id = v_id;
      if not v_a_leve then
        raise exception 'status et published ont pu diverger : la contrainte d accord manque';
      end if;
    `)
  })

  it('une entrée programmée SANS date est refusée par la base', () => {
    // Programmée sans date, elle n'est pas programmée : elle est perdue.
    assertSql(`
    declare v_a_leve boolean := false;
    begin
      begin
        insert into public.admin_changelog (title, content, status, published)
             values ('sans-date', '', 'scheduled', false);
      exception when check_violation then
        v_a_leve := true;
      end;
      if not v_a_leve then
        delete from public.admin_changelog where title = 'sans-date';
        raise exception 'une entree scheduled sans scheduled_for a ete acceptee';
      end if;
    `)
  })

  // ── 3. Les gestes ──────────────────────────────────────────────────────────────

  it('publier est un geste séparé, et il est idempotent PAR L\'ÉTAT', async () => {
    const svc = serviceRoleClient()
    const id = await creer(`publie-${stamp}`)

    const { data: un } = await svc.rpc('admin_changelog_publish', { p_id: id })
    expect((un as Row).ok).toBe(true)
    expect(((un as Row).data as Row).published_at).toBeTruthy()

    // Republier ne refait rien, et n'est PAS une erreur : deux super-admins qui publient la
    // même entrée doivent converger.
    const { data: deux } = await svc.rpc('admin_changelog_publish', { p_id: id })
    expect(((deux as Row).data as Row).already_done).toBe(true)

    const { data: ligne } = await svc.from('admin_changelog')
      .select('status, published').eq('id', id).single()
    expect((ligne as Row).status).toBe('published')
    expect((ligne as Row).published).toBe(true)
  })

  it('une entrée publiée ne se MODIFIE ni ne se SUPPRIME sans être dépubliée', async () => {
    // Réécrire ou effacer ce que les agents ont déjà lu, c'est réécrire l'histoire.
    const svc = serviceRoleClient()
    const id = await creer(`fige-${stamp}`)
    await svc.rpc('admin_changelog_publish', { p_id: id })

    const { data: mod } = await svc.rpc('admin_changelog_save', {
      p_id: id, p_title: 'autre titre', p_content: 'x', p_version: null,
      p_idempotency_key: `chg-mod-${stamp}`,
    })
    expect((mod as Row).ok).toBe(false)
    expect((mod as Row).code).toBe('precondition_failed')

    const { data: sup } = await svc.rpc('admin_changelog_delete', { p_id: id })
    expect((sup as Row).ok).toBe(false)
    expect((sup as Row).code).toBe('precondition_failed')
  })

  it('dépublier ramène en brouillon et CONSERVE la date de première publication', async () => {
    const svc = serviceRoleClient()
    const id = await creer(`depublie-${stamp}`)
    await svc.rpc('admin_changelog_publish', { p_id: id })

    const { data } = await svc.rpc('admin_changelog_unpublish', { p_id: id })
    expect((data as Row).ok).toBe(true)

    const { data: ligne } = await svc.from('admin_changelog')
      .select('status, published, published_at').eq('id', id).single()
    expect((ligne as Row).status).toBe('draft')
    expect((ligne as Row).published).toBe(false)
    // `published_at` dit que ça A ÉTÉ publié un jour : une republication ne doit pas
    // effacer ce fait.
    expect((ligne as Row).published_at, 'la date de première publication est conservée').not.toBeNull()
  })

  it('programmer dans le PASSÉ est refusé — le geste de publication existe', async () => {
    const svc = serviceRoleClient()
    const id = await creer(`prog-passe-${stamp}`)
    const { data } = await svc.rpc('admin_changelog_schedule', {
      p_id: id, p_when: new Date(Date.now() - 3_600_000).toISOString(),
    })
    expect((data as Row).ok).toBe(false)
    expect((data as Row).code).toBe('precondition_failed')
  })

  it('LE CRON publie ce qui est dû, et rien d\'autre', async () => {
    const svc = serviceRoleClient()
    const du = await creer(`du-${stamp}`)
    const pasEncore = await creer(`pas-encore-${stamp}`)

    await svc.rpc('admin_changelog_schedule', {
      p_id: du, p_when: new Date(Date.now() + 60_000).toISOString(),
    })
    await svc.rpc('admin_changelog_schedule', {
      p_id: pasEncore, p_when: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    })

    // On ramène l'échéance du premier dans le passé, en écriture directe : la RPC de
    // programmation refuse (à juste titre) une date passée, et attendre une minute en CI
    // n'apprendrait rien de plus.
    runSql(`begin
      update public.admin_changelog set scheduled_for = now() - interval '1 minute'
       where id = '${du}'::uuid;`)

    const { data: n, error } = await svc.rpc('changelog_publish_due')
    expect(error).toBeNull()
    expect(Number(n), 'au moins l\'entrée due est publiée').toBeGreaterThanOrEqual(1)

    const { data: lignes } = await svc.from('admin_changelog')
      .select('id, status').in('id', [du, pasEncore])
    const parId = Object.fromEntries((lignes as Row[]).map((l) => [l.id, l.status]))
    expect(parId[du], 'l\'échéance passée est publiée').toBe('published')
    expect(parId[pasEncore], 'celle de la semaine prochaine ne bouge pas').toBe('scheduled')
  })

  it('UNE PUBLICATION PROGRAMMÉE LAISSE UNE TRACE AU REGISTRE', async () => {
    // Trouvé par la revue du Lot 2. `changelog_publish_due` rendait une nouveauté visible
    // de TOUS les agents sans écrire une seule ligne au registre, alors que le geste manuel
    // identique (`admin_changelog_publish`) journalise en `warn`. Le seul chemin de
    // publication qui atteint tout le monde était donc aussi le seul invisible à l'écran
    // Sécurité — et hors chaîne d'empreintes.
    //
    // Le cliquet de l'étape 23 ne pouvait pas le voir : son périmètre s'écrivait
    // `proname ~ '^admin_'`, une convention de NOM, là où le reste du fichier définit ses
    // périmètres par une PROPRIÉTÉ. Le périmètre est élargi dans le même passage — ce
    // test-ci éprouve le comportement, celui-là empêche la récidive ailleurs.
    const svc = serviceRoleClient()
    const id = await creer(`trace-prog-${stamp}`)
    await svc.rpc('admin_changelog_schedule', {
      p_id: id, p_when: new Date(Date.now() + 60_000).toISOString(),
    })
    runSql(`begin
      update public.admin_changelog set scheduled_for = now() - interval '1 minute'
       where id = '${id}'::uuid;`)
    const { error } = await svc.rpc('changelog_publish_due')
    expect(error).toBeNull()

    // Lecture en SQL direct, pas via supabase-js : un REVOKE sur `admin_log` rendrait une
    // lecture service_role VIDE SANS erreur, et l'assertion passerait sur zéro ligne.
    assertSql(`
    declare v_n int; v_routine boolean; v_sev text;
    begin
      select count(*), bool_or(l.routine), min(l.severity)
        into v_n, v_routine, v_sev
        from public.admin_log l
       where l.entity_id = '${id}'::uuid and l.action = 'changelog_published';

      if v_n < 1 then
        raise exception E'Publication PROGRAMMEE sans ligne au registre MEGGA.\\n'
          '  Le geste manuel equivalent journalise, celui-ci non : la seule publication\\n'
          '  qui atteint tous les agents serait la seule sans trace.';
      end if;
      if v_routine then
        raise exception E'Ligne marquee "routine".\\n'
          '  get_admin_security_journal filtre "not routine" : la trace existerait en base\\n'
          '  mais resterait invisible a l ecran Securite. Une trace pour personne.';
      end if;
      if v_sev is distinct from 'warn' then
        raise exception 'severite "%" : le geste manuel identique journalise en warn', v_sev;
      end if;
    `)
  })

  // ── 4. Ce que voit un agent ────────────────────────────────────────────────────

  it('UN AGENT NE VOIT QUE LE PUBLIÉ — jamais un brouillon', async () => {
    const svc = serviceRoleClient()
    const brouillon = await creer(`secret-${stamp}`)
    const publie = await creer(`visible-${stamp}`)
    await svc.rpc('admin_changelog_publish', { p_id: publie })

    const { data } = await setup.clientA.from('admin_changelog').select('id, title')
    const vus = (data ?? []) as Row[]
    expect(vus.some((l) => l.id === publie), 'la page Aujourd\'hui lit les publiées').toBe(true)
    expect(vus.some((l) => l.id === brouillon), 'un brouillon ne doit JAMAIS parvenir à un agent').toBe(false)
  })

  it('LA PORTE D\'ÉCRITURE est fermée — plus d\'INSERT ni de DELETE nus', () => {
    assertSql(`
    begin
      if has_table_privilege('authenticated', 'public.admin_changelog', 'INSERT')
         or has_table_privilege('authenticated', 'public.admin_changelog', 'DELETE')
         or has_table_privilege('anon', 'public.admin_changelog', 'INSERT')
         or has_table_privilege('anon', 'public.admin_changelog', 'UPDATE') then
        raise exception 'admin_changelog est encore ecrivable en direct : les gestes ont une seconde porte';
      end if;
      -- Une seule policy doit rester, en lecture : l ecriture passe par les RPC.
      if (select count(*) from pg_policy where polrelid='public.admin_changelog'::regclass) <> 1 then
        raise exception 'une seule policy (select) attendue sur admin_changelog';
      end if;
    `)
  })

  it('la RLS s\'appuie sur `is_super_admin()`, pas sur `profiles.role` en dur', () => {
    // Le mur réel du dépôt, c'est « rôle ET e-mail allowlisté ». La forme en dur ratait la
    // moitié allowlist — divergence corrigée à l'étape 21.
    assertSql(`
    declare v_q text;
    begin
      select pg_get_expr(polqual, polrelid) into v_q
        from pg_policy where polrelid='public.admin_changelog'::regclass and polname='admin_changelog_select';
      if v_q not like '%is_super_admin%' then
        raise exception 'la policy de lecture ne passe pas par is_super_admin()';
      end if;
      if v_q like '%super_admin''::text%' then
        raise exception 'la policy teste encore profiles.role en dur : le controle d allowlist est contourne';
      end if;
    `)
  })

  // ── 5. Le journal et la porte ──────────────────────────────────────────────────

  it('chaque geste est journalisé en famille `comm`', async () => {
    const { data } = await serviceRoleClient().rpc('get_admin_security_journal', {
      p_window: 'today', p_filter: 'comm', p_limit: 100,
    })
    const actions = (data as Row[]).map((l) => String(l.action))
    for (const a of ['changelog_saved', 'changelog_published', 'changelog_unpublished']) {
      expect(actions, `« ${a} » doit laisser une trace`).toContain(a)
    }
  })

  it('LA NON-FUITE — un JWT agent est refusé sur les cinq gestes', async () => {
    for (const [fn, args] of [
      ['admin_changelog_save', { p_id: null, p_title: 'x', p_content: '', p_version: null, p_idempotency_key: 'k' }],
      ['admin_changelog_publish', { p_id: creees[0] }],
      ['admin_changelog_schedule', { p_id: creees[0], p_when: new Date(Date.now() + 86_400_000).toISOString() }],
      ['admin_changelog_unpublish', { p_id: creees[0] }],
      ['admin_changelog_delete', { p_id: creees[0] }],
    ] as Array<[string, Record<string, unknown>]>) {
      const { error } = await setup.clientA.rpc(fn, args)
      expect(error?.code, `${fn} doit refuser un JWT agent`).toBe(DENIED)
    }

    // Le cron n'est pas non plus une surface d'écran.
    assertSql(`
    begin
      if has_function_privilege('authenticated', 'public.changelog_publish_due()', 'EXECUTE') then
        raise exception 'le cron de publication est joignable par authenticated';
      end if;
    `)
  })
})
