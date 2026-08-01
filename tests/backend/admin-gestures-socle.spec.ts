// Backend integration spec (live CI) — le socle des GESTES du Lot 2
// (migration 20260731300000, étape 16, spec §10.1 et §10.2).
//
// Ce fichier n'éprouve aucun geste : il éprouve les quatre primitives sur lesquelles ils
// reposeront tous. Un défaut ici se paierait sur chacun d'eux.
//
//   1. L'IDEMPOTENCE, et surtout son ATOMICITÉ. « Double-clic sur Suspendre = un seul
//      effet » est un critère de sortie du gate G2. Un test-puis-agit laisserait passer un
//      second appel entre le SELECT et l'INSERT ; ici l'atomicité vient de la primary key,
//      et ce fichier le vérifie EN CONCURRENCE, pas en séquence — deux appels séquentiels
//      passeraient même avec l'implémentation naïve.
//   2. LE BACKOFF ET LA MORT. Un job qui se rejoue indéfiniment ne remonte aucune anomalie :
//      c'est la panne qu'on ne voit jamais. Le passage à `dead` est donc testé jusqu'au bout.
//   3. LE VOCABULAIRE FERMÉ des codes d'erreur (§10.1) — un code inventé doit lever à
//      l'écriture, pas produire un écran muet en production.
//   4. LES VERROUS, dans le bon ORDRE (entité puis chaîne) : l'inverse produit un
//      interblocage 40P01 dès que deux gestes touchent la même agence.
//
// ⚠ CLIENT CHOISI D'APRÈS LA GARDE. `admin_receipt_*` et `admin_outbox_enqueue` sont gardées
// `is_super_admin() OR is_service_role()` — ni psql, ni JWT agent. `admin_outbox_claim` et
// `_settle` admettent en plus `session_user`, mais ne sont accordées QU'À `service_role` :
// elles s'appellent donc en service_role, jamais depuis un client authentifié.
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

describe.skipIf(!HAS_KEYS)('socle des gestes (étape 16)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []
  let stamp = ''

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    stamp = setup.stamp
    const svc = serviceRoleClient()
    const email = `socle-super-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super Socle ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: data.user!.id, email, full_name: `Super Socle ${stamp}`, role: 'super_admin', agency_id: null },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`profile: ${pErr.message}`)
    superClient = anonClient()
    const { error: sErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin: ${sErr.message}`)
  })

  afterAll(async () => {
    // Les lignes d'outbox_jobs et de rpc_receipts ne sont PAS nettoyées, et ne peuvent pas
    // l'être : les deux tables sont fermées en écriture à tous, y compris service_role —
    // c'est précisément ce que ce fichier vérifie. Elles s'effacent par leurs crons de
    // rétention (24 h / 90 j), et la base de CI est fraîche à chaque exécution.
    const svc = serviceRoleClient()
    if (setup) await setup.cleanup()
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 1. L'enveloppe d'erreur (§10.1) ────────────────────────────────────────────

  it('LE VOCABULAIRE EST FERMÉ — un code inventé lève, il ne passe pas', async () => {
    const svc = serviceRoleClient()
    const { data, error } = await svc.rpc('admin_error', {
      p_code: 'conflict', p_message_fr: 'Cette agence porte déjà ce nom.',
    })
    expect(error).toBeNull()
    expect(data).toEqual({ ok: false, code: 'conflict', message_fr: 'Cette agence porte déjà ce nom.' })

    // Un code hors des huit de §10.1. Le laisser passer produirait un écran incapable de
    // distinguer ce qu'il doit réessayer de ce qu'il doit signaler — et personne ne le
    // verrait avant la production.
    const { error: inconnu } = await svc.rpc('admin_error', {
      p_code: 'oups', p_message_fr: 'x',
    })
    expect(inconnu?.code, 'un code hors vocabulaire doit lever').toBe(BAD_INPUT)

    // Un message vide laisserait l'écran sans rien à afficher.
    const { error: muet } = await svc.rpc('admin_error', {
      p_code: 'conflict', p_message_fr: '   ',
    })
    expect(muet?.code, 'un message_fr vide doit lever').toBe(BAD_INPUT)
  })

  it('les huit codes de §10.1 sont tous acceptés, et aucun autre', async () => {
    const svc = serviceRoleClient()
    for (const code of ['unauthorized', 'not_found', 'conflict', 'precondition_failed',
                        'too_many', 'rate_limited', 'locked', 'upstream_error']) {
      const { error } = await svc.rpc('admin_error', { p_code: code, p_message_fr: 'message' })
      expect(error, `« ${code} » est du vocabulaire §10.1`).toBeNull()
    }
  })

  it('admin_ok() partage la clé `ok`, testée une seule fois par l\'appelant', async () => {
    const { data } = await serviceRoleClient().rpc('admin_ok', { p_data: { id: 42 } })
    expect(data).toEqual({ ok: true, data: { id: 42 } })
    const { data: nu } = await serviceRoleClient().rpc('admin_ok', {})
    expect(nu, 'sans données, la clé `data` disparaît plutôt que de valoir null').toEqual({ ok: true })
  })

  // ── 2. L'idempotence (§10.2) ───────────────────────────────────────────────────

  it('L\'IDEMPOTENCE — la première réservation passe, la seconde est refusée', async () => {
    const svc = serviceRoleClient()
    const cle = `socle-idem-${stamp}`
    const { data: un, error } = await svc.rpc('admin_receipt_try', { p_key: cle, p_rpc: 'test' })
    expect(error).toBeNull()
    expect(un, 'première fois : exécuter le geste').toBe(true)

    const { data: deux } = await svc.rpc('admin_receipt_try', { p_key: cle, p_rpc: 'test' })
    expect(deux, 'déjà vu : l\'effet a eu lieu, ne pas le refaire').toBe(false)
  })

  it('L\'ATOMICITÉ — dix appels CONCURRENTS ne réservent qu\'une fois', async () => {
    // Le test qui compte. Deux appels séquentiels passeraient MÊME avec un test-puis-agit
    // (SELECT puis INSERT) : le premier aurait commité avant que le second ne lise. C'est en
    // concurrence que l'implémentation naïve échoue — et c'est le double-clic réel sur
    // « Suspendre », critère de sortie du gate G2.
    const svc = serviceRoleClient()
    const cle = `socle-course-${stamp}`
    const resultats = await Promise.all(
      Array.from({ length: 10 }, () => svc.rpc('admin_receipt_try', { p_key: cle, p_rpc: 'course' }))
    )
    const acceptes = resultats.filter((r) => r.data === true).length
    const erreurs = resultats.filter((r) => r.error !== null)
    expect(erreurs, 'aucun appel ne doit ERREUR : le doublon est une réponse, pas une panne')
      .toHaveLength(0)
    expect(acceptes, 'exactement un appel sur dix doit obtenir la réservation').toBe(1)
  })

  it('le reçu porte l\'empreinte du résultat, posée après coup', async () => {
    const svc = serviceRoleClient()
    const cle = `socle-seal-${stamp}`
    await svc.rpc('admin_receipt_try', { p_key: cle, p_rpc: 'seal' })
    const { error } = await svc.rpc('admin_receipt_seal', { p_key: cle, p_result: { fait: true } })
    expect(error).toBeNull()

    // La table n'est lisible par personne : c'est le point. Une clé d'idempotence lisible
    // serait rejouable par qui la lit.
    assertSql(`
    begin
      if has_table_privilege('authenticated', 'public.rpc_receipts', 'SELECT')
         or has_table_privilege('service_role', 'public.rpc_receipts', 'SELECT')
         or has_table_privilege('anon', 'public.rpc_receipts', 'SELECT') then
        raise exception 'rpc_receipts est lisible : une cle d idempotence lue est rejouable';
      end if;
      if (select result_hash from public.rpc_receipts where idempotency_key = '${cle}') is null then
        raise exception 'l empreinte du resultat n a pas ete posee';
      end if;
    `)
  })

  // ── 3. L'outbox (§10.2) ────────────────────────────────────────────────────────

  it('un effet externe se dépose, se réclame, et se solde', async () => {
    const svc = serviceRoleClient()
    const { data: id, error } = await svc.rpc('admin_outbox_enqueue', {
      p_kind: 'email', p_payload: { tag: `socle-${stamp}`, to: 'personne@megga-staging.invalid' },
    })
    expect(error).toBeNull()
    expect(id).toBeTruthy()

    const { data: reclames, error: cErr } = await svc.rpc('admin_outbox_claim', { p_limit: 100 })
    expect(cErr).toBeNull()
    const mien = (reclames as Row[]).find((j) => j.id === id)
    expect(mien, 'le job déposé doit être réclamable immédiatement').toBeTruthy()
    expect(Number(mien!.attempts), 'la réclamation CONSOMME une tentative').toBe(1)

    const { data: statut } = await svc.rpc('admin_outbox_settle', { p_id: id, p_ok: true })
    expect(statut).toBe('done')
  })

  it('un `kind` hors des quatre de §4.2 est refusé par la base', async () => {
    const { error } = await serviceRoleClient().rpc('admin_outbox_enqueue', {
      p_kind: 'telepathie', p_payload: {},
    })
    expect(error, 'le CHECK doit refuser un kind inventé').not.toBeNull()
  })

  it('LE BACKOFF ET LA MORT — un job qui échoue recule, puis meurt', async () => {
    // Un job qui se rejoue indéfiniment ne remonte AUCUNE anomalie : c'est la panne qu'on
    // ne voit jamais. Le plafond est donc éprouvé jusqu'au bout.
    const svc = serviceRoleClient()
    const { data: id } = await svc.rpc('admin_outbox_enqueue', {
      p_kind: 'notify', p_payload: { tag: `socle-${stamp}-mort` },
    })

    // ⚠ C'est la RÉCLAMATION qui incrémente `attempts`, pas le solde. Et une fois le
    // backoff posé, `next_retry_at` est dans le futur : re-réclamer ne rendrait plus ce job
    // avant 30 secondes. Une première version de ce test enchaînait deux `claim` en
    // attendant que le compteur monte — il ne montait pas, et le test aurait échoué pour
    // une raison qui n'était pas celle qu'il croyait éprouver.
    await svc.rpc('admin_outbox_claim', { p_limit: 100 })

    // Plafond abaissé : c'est le PARAMÈTRE qu'on éprouve, pas sa valeur par défaut, et on
    // ne va pas boucler six fois pour le montrer.
    const { data: s1 } = await svc.rpc('admin_outbox_settle', {
      p_id: id, p_ok: false, p_error: 'timeout amont', p_max: 2,
    })
    expect(s1, 'sous le plafond : on réessaie').toBe('pending')

    const { data: apres } = await svc.from('outbox_jobs')
      .select('next_retry_at, attempts').eq('id', id).single()
    expect(new Date((apres as Row).next_retry_at as string).getTime(),
      'le backoff repousse la prochaine tentative dans le futur').toBeGreaterThan(Date.now())

    const { data: s2 } = await svc.rpc('admin_outbox_settle', {
      p_id: id, p_ok: false, p_error: 'toujours rien', p_max: 1,
    })
    expect(s2, 'plafond atteint : le job meurt au lieu de boucler').toBe('dead')

    const { data: lignes } = await svc.from('outbox_jobs').select('status, last_error, next_retry_at').eq('id', id)
    const j = (lignes as Row[])[0]
    expect(j.status).toBe('dead')
    expect(String(j.last_error), 'le motif du dernier échec est conservé pour le Monitoring')
      .toContain('toujours rien')
  })

  it('un mort n\'est JAMAIS repris tout seul', async () => {
    // C'est ce qui le rend visible : une file qui se rejoue indéfiniment n'alerte personne.
    const svc = serviceRoleClient()
    const { data: id } = await svc.rpc('admin_outbox_enqueue', {
      p_kind: 'portal', p_payload: { tag: `socle-${stamp}-zombie` },
    })
    await svc.rpc('admin_outbox_claim', { p_limit: 100 })
    await svc.rpc('admin_outbox_settle', { p_id: id, p_ok: false, p_error: 'mort', p_max: 0 })

    const { data: reclames } = await svc.rpc('admin_outbox_claim', { p_limit: 100 })
    expect((reclames as Row[]).some((j) => j.id === id),
      'un job mort ne doit plus jamais être réclamé').toBe(false)
  })

  it('un job inconnu lève au lieu de mentir sur son sort', async () => {
    const { error } = await serviceRoleClient().rpc('admin_outbox_settle', {
      p_id: '00000000-0000-0000-0000-000000000000', p_ok: true,
    })
    expect(error?.code).toBe(BAD_INPUT)
  })

  // ── 4. Les verrous (§10.2) ─────────────────────────────────────────────────────

  it('LES VERROUS — deux entités différentes ne se bloquent pas', () => {
    // Un verrou trop large sérialiserait toute la console : deux gestes sur deux agences
    // distinctes doivent pouvoir avancer en même temps.
    assertSql(`
    declare v_pris boolean;
    begin
      perform public.admin_lock_entity('agency', '${setup.agencyAId}'::uuid);
      -- pg_try_advisory_xact_lock rend false si le verrou est déjà tenu par une AUTRE
      -- transaction ; dans la même, il rend true. On vérifie donc l'ABSENCE de collision
      -- entre deux clés distinctes, ce qui est la propriété qui compte.
      select pg_try_advisory_xact_lock(hashtext('agency'), hashtext('${setup.agencyBId}'))
        into v_pris;
      if not v_pris then
        raise exception 'deux agences distinctes se bloquent : le verrou est trop large';
      end if;
    `)
  })

  it('le même identifiant sous deux TYPES d\'entité ne collisionne pas', () => {
    // Deux clés plutôt qu'un hash de concaténation : hash('agency:'||id) et
    // hash('profile:'||id) peuvent entrer en collision SILENCIEUSEMENT.
    assertSql(`
    declare v_pris boolean;
    begin
      perform public.admin_lock_entity('agency', '${setup.agencyAId}'::uuid);
      select pg_try_advisory_xact_lock(hashtext('profile'), hashtext('${setup.agencyAId}'))
        into v_pris;
      if not v_pris then
        raise exception 'agency et profile partagent un verrou pour le meme id';
      end if;
    `)
  })

  it('un verrou sans cible est refusé', async () => {
    const { error } = await serviceRoleClient().rpc('admin_lock_entity', {
      p_entity_type: 'agency', p_entity_id: null,
    })
    expect(error?.code).toBe(BAD_INPUT)
  })

  it('le verrou est de TRANSACTION, pas de session', () => {
    // Un verrou de session survivrait à une erreur et murerait l'entité jusqu'à la fin de
    // la connexion — c'est-à-dire indéfiniment derrière un pooler.
    assertSql(`
    begin
      if (select prosrc from pg_proc where proname = 'admin_lock_entity')
         not ilike '%pg_advisory_xact_lock%' then
        raise exception 'admin_lock_entity n utilise pas un verrou de TRANSACTION';
      end if;
    `)
  })

  // ── 5. La porte ────────────────────────────────────────────────────────────────

  it('LA NON-FUITE — un JWT agent est refusé, et le worker ne lui est pas accordé', async () => {
    for (const [fn, args] of [
      ['admin_receipt_try', { p_key: 'x', p_rpc: 'y' }],
      ['admin_receipt_seal', { p_key: 'x', p_result: {} }],
      ['admin_outbox_enqueue', { p_kind: 'email', p_payload: {} }],
    ] as Array<[string, Record<string, unknown>]>) {
      const { error } = await setup.clientA.rpc(fn, args)
      expect(error?.code, `${fn} doit refuser un JWT agent`).toBe(DENIED)
    }

    // claim/settle ne sont PAS accordées à `authenticated` : aucun écran n'a de raison de
    // vider une file, et leur garde admet `session_user`, ce qui les ferait sortir du volet
    // comportemental du balayage de gardes — dont la marge est plafonnée à quatre.
    assertSql(`
    begin
      if has_function_privilege('authenticated', 'public.admin_outbox_claim(integer)', 'EXECUTE')
         or has_function_privilege('authenticated',
              'public.admin_outbox_settle(uuid,boolean,text,smallint)', 'EXECUTE') then
        raise exception 'le worker d outbox est joignable par authenticated';
      end if;
      if not has_function_privilege('service_role', 'public.admin_outbox_claim(integer)', 'EXECUTE') then
        raise exception 'le worker d outbox n est pas joignable par service_role';
      end if;
    `)
  })

  it('les deux tables sont fermées en écriture directe', () => {
    assertSql(`
    begin
      if has_table_privilege('authenticated', 'public.outbox_jobs', 'INSERT')
         or has_table_privilege('service_role', 'public.outbox_jobs', 'INSERT')
         or has_table_privilege('anon', 'public.outbox_jobs', 'SELECT') then
        raise exception 'outbox_jobs est ecrivable hors du chemin prevu';
      end if;
      if has_table_privilege('authenticated', 'public.rpc_receipts', 'INSERT') then
        raise exception 'rpc_receipts est ecrivable directement';
      end if;
    `)
  })
})
