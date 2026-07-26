// Non-régression — chemin d'inscription (trigger on_auth_user_created).
//
// Le trigger qui appelle handle_new_user() n'était dans aucune migration : en local
// l'inscription ne créait ni profil ni agence, et en prod l'objet vivait hors du
// contrôle de version. Ces tests exercent une vraie inscription et cassent la CI si
// le trigger disparaît. Migration : 20260726140000_auth_user_created_trigger.

import { describe, it, expect, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'

const PW = 'Test-Password-123!'
const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('inscription — provisioning automatique', () => {
  const userIds: string[] = []

  // Inscrit un utilisateur SANS toucher à profiles : tout ce qui suit doit être
  // l'œuvre du trigger, sinon le test ne prouve rien.
  async function signUp(meta: Record<string, string>): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await svc.auth.admin.createUser({
      email: `signup-${stamp}@megga-test.local`,
      password: PW,
      email_confirm: true,
      user_metadata: meta,
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    userIds.push(data.user!.id)
    return data.user!.id
  }

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of userIds) {
      const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
      if (prof?.agency_id) await svc.from('agencies').delete().eq('id', prof.agency_id).then(() => {}, () => {})
    }
  })

  it('crée le profil sans intervention (le trigger existe)', async () => {
    const id = await signUp({ full_name: 'Alice Trigger', role: 'agent' })
    const svc = serviceRoleClient()
    const { data: prof } = await svc.from('profiles').select('id, role').eq('id', id).maybeSingle()
    expect(prof, 'aucun profil créé : le trigger on_auth_user_created est absent').not.toBeNull()
    expect(prof?.id).toBe(id)
  })

  it('le fondateur est admin de son agence et passe is_agency_admin()', async () => {
    const id = await signUp({ full_name: 'Bob Fondateur', role: 'agent' })
    const svc = serviceRoleClient()
    const { data: prof } = await svc
      .from('profiles')
      .select('agency_id, role')
      .eq('id', id)
      .maybeSingle()
    expect(prof?.agency_id, 'aucune agence provisionnée').toBeTruthy()
    expect(prof?.role, 'le fondateur doit diriger son agence, sinon is_agency_admin() le bloque').toBe('admin')
  })

  // provision_solo_agency() ne posait pas le role avant le 20260726140100 : tout
  // fondateur inscrit avant ce fix est resté 'agent' malgré son agency_id déjà posé
  // (le garde `agency_id is null` de l'UPDATE ne le voit plus). backfill_founder_admin_roles()
  // répare ces comptes hérités — ces deux tests en prouvent les deux bords.
  it('backfill : un fondateur remis à agent en base (état hérité) redevient admin', async () => {
    const id = await signUp({ full_name: 'Carla Héritage', role: 'agent' })
    const svc = serviceRoleClient()

    // Simule l'état laissé par l'ancienne version de provision_solo_agency :
    // agency_id posé, role jamais touché. service_role contourne
    // trg_profiles_guard_role_agency (garde réservée à authenticated/anon).
    const { error: downgradeErr } = await svc.from('profiles').update({ role: 'agent' }).eq('id', id)
    expect(downgradeErr).toBeNull()

    const { error: backfillErr } = await svc.rpc('backfill_founder_admin_roles')
    expect(backfillErr).toBeNull()

    const { data: prof } = await svc.from('profiles').select('role').eq('id', id).maybeSingle()
    expect(prof?.role, 'le backfill doit réparer le fondateur hérité').toBe('admin')
  })

  it('backfill : un agent rattaché à une agence dont il n\'est pas le créateur reste agent', async () => {
    const founderId = await signUp({ full_name: 'Founder Agence', role: 'agent' })
    // role 'buyer' : handle_new_user() ne déclenche provision_solo_agency que pour
    // les rôles agence, donc ce profil n'a pas sa propre agence à faire fuiter.
    const invitedId = await signUp({ full_name: 'Agent Invité', role: 'buyer' })
    const svc = serviceRoleClient()

    const { data: founderProf } = await svc
      .from('profiles')
      .select('agency_id')
      .eq('id', founderId)
      .maybeSingle()
    expect(founderProf?.agency_id, 'agence du fondateur introuvable').toBeTruthy()

    // Simule un rattachement (invite/join) : agent d'une agence qu'il n'a PAS créée
    // — agencies.created_by reste celui du fondateur, jamais invitedId.
    const { error: attachErr } = await svc
      .from('profiles')
      .update({ agency_id: founderProf!.agency_id, role: 'agent' })
      .eq('id', invitedId)
    expect(attachErr).toBeNull()

    const { error: backfillErr } = await svc.rpc('backfill_founder_admin_roles')
    expect(backfillErr).toBeNull()

    const { data: invitedProf } = await svc
      .from('profiles')
      .select('role, agency_id')
      .eq('id', invitedId)
      .maybeSingle()
    expect(invitedProf?.agency_id).toBe(founderProf!.agency_id)
    expect(invitedProf?.role, 'un agent invité ne doit jamais être promu admin par le backfill').toBe('agent')
  })

  it('nomme l’agence d’après agency_name saisi à l’inscription', async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const agencyName = `Régie Test ${stamp}`
    const id = await signUp({ full_name: 'Carla Nom', role: 'agent', agency_name: agencyName })
    const svc = serviceRoleClient()
    const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
    const { data: ag } = await svc.from('agencies').select('name').eq('id', prof!.agency_id!).maybeSingle()
    expect(ag?.name, 'le nom saisi à l’inscription doit servir, pas celui de la personne').toBe(agencyName)
  })

  it('en cas de collision de nom, replie sans jamais laisser l’utilisateur sans agence', async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const shared = `Régie Collision ${stamp}`
    const first = await signUp({ full_name: 'Dan Premier', role: 'agent', agency_name: shared })
    const second = await signUp({ full_name: 'Eve Seconde', role: 'agent', agency_name: shared })
    const svc = serviceRoleClient()
    const { data: p1 } = await svc.from('profiles').select('agency_id').eq('id', first).maybeSingle()
    const { data: p2 } = await svc.from('profiles').select('agency_id').eq('id', second).maybeSingle()
    expect(p1?.agency_id, 'le premier doit avoir son agence').toBeTruthy()
    expect(p2?.agency_id, 'le second ne doit JAMAIS rester sans agence : CRM muet garanti').toBeTruthy()
    expect(p2?.agency_id).not.toBe(p1?.agency_id)
  })

  it('ne provisionne aucune agence quand une invitation valide attend l’e-mail', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

    // Une agence hôte et son dirigeant, qui émettra l'invitation.
    const hostId = await signUp({ full_name: 'Hôte Agence', role: 'agent', agency_name: `Hôte ${stamp}` })
    const { data: host } = await svc.from('profiles').select('agency_id').eq('id', hostId).maybeSingle()
    const invitedEmail = `invite-${stamp}@megga-test.local`

    const { error: invErr } = await svc.from('team_invitations').insert({
      agency_id: host!.agency_id, email: invitedEmail, role: 'agent', invited_by: hostId,
    })
    expect(invErr, `insert invitation: ${invErr?.message}`).toBeNull()

    const { data: created, error } = await svc.auth.admin.createUser({
      email: invitedEmail, password: PW, email_confirm: true,
      user_metadata: { full_name: 'Invité Test', role: 'agent' },
    })
    if (error) throw new Error(`createUser invité: ${error.message}`)
    userIds.push(created.user!.id)

    const { data: prof } = await svc
      .from('profiles').select('agency_id').eq('id', created.user!.id).maybeSingle()
    expect(prof, 'le profil doit exister').not.toBeNull()
    expect(prof?.agency_id, 'un invité ne doit PAS recevoir d’agence solo : accept-team-invite la rendrait orpheline').toBeNull()
  })
})
