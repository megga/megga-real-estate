// Backend integration spec (live CI) — note interne d'agence et lecture des invitations
// (migration 20260731270000, débloque l'étape 9, spec §5.3/§5.4/§4.3).
//
// Le test qui compte le plus ici est celui de la NON-FUITE : la note est interne à la
// plateforme, et la raison pour laquelle elle ne vit pas sur `agencies` est que cette
// table-là est lisible par ses propres membres. Si un jour quelqu'un « simplifie » en
// déplaçant la note vers une colonne, c'est ce test qui doit rougir.
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

describe.skipIf(!HAS_KEYS)('note interne d\'agence et invitations (étape 9)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()
    const email = `note-super-${setup.stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super Note ${setup.stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: data.user!.id, email, full_name: `Super Note ${setup.stamp}`, role: 'super_admin', agency_id: null },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`profile: ${pErr.message}`)
    superClient = anonClient()
    const { error: sErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin: ${sErr.message}`)

    // Une note et une invitation en attente sur l'agence A.
    // `invited_by` est NOT NULL : une invitation sans invitant n'existe pas dans ce
    // modèle, et l'omettre fait échouer le beforeAll — donc SKIPPER toute la suite,
    // ce qui se lit « 9 ignorés » et non « 7 échecs ».
    await svc.from('admin_agency_notes').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
    runSql(`begin
      insert into public.admin_agency_notes (agency_id, note)
        values ('${setup.agencyAId}'::uuid, 'Note interne de test');
      insert into public.team_invitations (agency_id, email, role, status, expires_at, invited_by)
        values ('${setup.agencyAId}'::uuid, 'invite-${setup.stamp}@megga-test.local',
                'agent', 'pending', now() + interval '7 days', '${setup.agentAId}'::uuid);`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (setup) {
      await svc.from('team_invitations').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
      await setup.cleanup()
    }
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── La note ────────────────────────────────────────────────────────────────────

  it('LA NON-FUITE — la note ne vit pas sur `agencies`, qui est lisible par ses membres', () => {
    // C'est la raison d'être de la table dédiée. `agencies_members_select` donne à chaque
    // membre la lecture de toute sa ligne, avec un GRANT de table : une colonne y serait
    // lue par l'agence. Et un REVOKE de colonne ne protégerait rien — défaut déjà mesuré
    // sur agencies.verification_*.
    assertSql(`
    begin
      if exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='agencies'
                    and column_name in ('admin_note','note_interne')) then
        raise exception 'la note est passee sur agencies : elle est desormais lisible par l agence elle-meme';
      end if;
      if to_regclass('public.admin_agency_notes') is null then
        raise exception 'admin_agency_notes absente : la note n a plus de support';
      end if;
    `)
  })

  it('un super-admin lit la note, un agent ne la voit pas', async () => {
    const { data: vue } = await superClient
      .from('admin_agency_notes').select('note').eq('agency_id', setup.agencyAId).maybeSingle()
    expect(vue?.note, 'le super-admin lit la note').toBe('Note interne de test')

    const { data: agent } = await setup.clientA
      .from('admin_agency_notes').select('note').eq('agency_id', setup.agencyAId)
    expect(agent ?? [], 'un membre de CETTE agence ne doit rien voir').toHaveLength(0)
  })

  it('la table est fermée en écriture à tous — le geste sera une RPC du Lot 2', () => {
    assertSql(`
    begin
      if has_table_privilege('authenticated', 'public.admin_agency_notes', 'INSERT')
         or has_table_privilege('service_role', 'public.admin_agency_notes', 'INSERT')
         or has_table_privilege('anon', 'public.admin_agency_notes', 'SELECT') then
        raise exception 'admin_agency_notes est ecrivable ou lisible hors du chemin prevu';
      end if;
      if (select count(*) from pg_policy where polrelid='public.admin_agency_notes'::regclass) <> 1 then
        raise exception 'une seule policy attendue (select super-admin)';
      end if;
    `)
  })

  // ── Les invitations ────────────────────────────────────────────────────────────

  it('un super-admin lit les invitations en attente d\'une agence', async () => {
    const { data, error } = await superClient.rpc('get_admin_agency_invitations', {
      p_agency_id: setup.agencyAId,
    })
    expect(error, 'la RPC ouvre ce que la RLS ferme').toBeNull()
    const rows = data as Record<string, unknown>[]
    expect(rows.length, 'une invitation en attente').toBe(1)
    expect(rows[0].email).toBe(`invite-${setup.stamp}@megga-test.local`)
    expect(rows[0].status).toBe('pending')
    expect(rows[0].is_expired, 'expire dans 7 jours').toBe(false)
    expect(rows[0].agency_name, 'le nom d\'agence est joint').toBeTruthy()
  })

  it('le jeton n\'est JAMAIS rendu — c\'est un secret de porteur', async () => {
    const { data } = await superClient.rpc('get_admin_agency_invitations', {
      p_agency_id: setup.agencyAId,
    })
    const row = (data as Record<string, unknown>[])[0]
    expect(Object.keys(row), 'aucune colonne de jeton dans la projection')
      .not.toContain('token')
    expect(JSON.stringify(row).toLowerCase()).not.toContain('token')
  })

  it('sans argument, la RPC sert le registre Utilisateurs — et reste bornée', async () => {
    const { data, error } = await serviceRoleClient().rpc('get_admin_agency_invitations', {
      p_agency_id: null, p_limit: 1_000_000,
    })
    expect(error).toBeNull()
    expect((data as unknown[]).length, 'plafond à 200').toBeLessThanOrEqual(200)
  })

  it('un agent ne peut pas appeler la RPC, ni lire la table en direct', async () => {
    const { error } = await setup.clientA.rpc('get_admin_agency_invitations', {})
    expect(error?.code, 'la garde refuse un JWT agent').toBe(DENIED)

    // Rappel de l'état d'origine : la RLS de team_invitations ne laisse voir que sa propre
    // agence. C'est justement pourquoi le super-admin, sans agence, avait besoin d'une RPC.
    const { data } = await setup.clientB.from('team_invitations').select('id')
    expect(data ?? [], 'l\'agence B ne voit pas les invitations de l\'agence A').toHaveLength(0)
  })

  it('une invitation acceptée n\'est plus une invitation', async () => {
    // Elle devient un membre, et l'équipe l'affiche déjà : la faire apparaître aux deux
    // endroits ferait compter deux fois la même personne.
    //
    // Appel en service_role, jamais depuis psql. La garde de la RPC est
    // `is_super_admin() OR is_service_role()` et n'admet PAS session_user = postgres : c'est
    // le piège documenté au §6 d'ETAT_CHANTIER, et j'y suis retombé en écrivant ce test.
    const svc = serviceRoleClient()
    await svc.from('team_invitations').update({ status: 'accepted' }).eq('agency_id', setup.agencyAId)

    const { data, error } = await svc.rpc('get_admin_agency_invitations', {
      p_agency_id: setup.agencyAId,
    })
    expect(error).toBeNull()
    expect((data as unknown[]).length, 'une invitation acceptée ne doit plus être listée').toBe(0)

    await svc.from('team_invitations').update({ status: 'pending' }).eq('agency_id', setup.agencyAId)
  })
})
