// Non-régression — chemin d'inscription (trigger on_auth_user_created).
//
// Le trigger qui appelle handle_new_user() n'était dans aucune migration : en local
// l'inscription ne créait ni profil ni agence, et en prod l'objet vivait hors du
// contrôle de version. Ces tests exercent une vraie inscription et cassent la CI si
// le trigger disparaît. Migration : 20260728104000_auth_user_created_trigger.

import { describe, it, expect, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { execSql } from './helpers/local-sql'

const PW = 'Test-Password-123!'
const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

// Rejoue le fichier de migration complet plutôt que d'appeler une fonction de
// backfill : elle n'existe plus (20260728105000 la convertit en bloc DO anonyme,
// précisément pour qu'aucun objet ne reste appelable après coup — voir le
// commentaire en tête de ce bloc dans la migration). Rejouable sans risque : le
// fichier entier est idempotent (CREATE OR REPLACE FUNCTION + prédicat purement
// déclaratif dans le DO).
function replayBackfillMigration(): void {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260728105000_signup_agency_provisioning.sql'
  )
  execSql(fs.readFileSync(migrationPath, 'utf-8'))
}

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

  // Le fix ne dépend plus du nom du trigger en production (bloc DO sur pg_trigger,
  // filtré par la fonction appelée) : ce test protège l'invariant lui-même, pas un nom
  // précis. Un doublon fait échouer TOUTE inscription (violation de clé primaire dans
  // profiles) — voir docs/runbooks/trigger-inscription-duplique.md (désormais
  // historique). Preuve rouge/verte manuelle le 27.07.2026 : un second trigger
  // 'on_auth_user_created_legacy_console' appelant handle_new_user créé à la main via
  // psql fait passer get_signup_trigger_count() à 2 et ce test à l'échec ; supprimé, il
  // repasse à 1 et le test repasse au vert.
  it('un seul trigger sur auth.users appelle handle_new_user (pas de doublon silencieux)', async () => {
    const svc = serviceRoleClient()
    const { data, error } = await svc.rpc('get_signup_trigger_count')
    expect(error, `get_signup_trigger_count: ${error?.message}`).toBeNull()
    expect(
      data,
      'plus d’un trigger sur handle_new_user = double insert dans profiles = 500 sur toute inscription'
    ).toBe(1)
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

  // provision_solo_agency() ne posait pas le role avant le 20260728105000 : tout
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

    replayBackfillMigration()

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

    replayBackfillMigration()

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

  // Décision produit (revue finale du 27.07.2026) : un invité qui ne réclame JAMAIS
  // son invitation (elle expire à 7 jours, le trigger ne repasse pas) restait sinon à
  // agency_id NULL pour toujours — CRM muet, sans issue, wizard de rattrapage supprimé
  // et join_agency fermée. handle_new_user() ne consulte donc plus team_invitations et
  // provisionne systématiquement ; c'est accept-team-invite qui nettoie l'agence solo
  // au moment de la réclamation réelle. Preuve de bout en bout : l'agence solo existe
  // après le signup, puis a disparu après la réclamation, remplacée par la vraie.
  it('invité : agence solo à l’inscription, puis vraie agence et agence solo disparue après réclamation', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

    // Une agence hôte et son dirigeant, qui émettra l'invitation.
    const hostId = await signUp({ full_name: 'Hôte E2E', role: 'agent', agency_name: `Hôte E2E ${stamp}` })
    const { data: host } = await svc.from('profiles').select('agency_id').eq('id', hostId).maybeSingle()
    const invitedEmail = `invite-e2e-${stamp}@megga-test.local`

    const { data: invitation, error: invErr } = await svc
      .from('team_invitations')
      .insert({ agency_id: host!.agency_id, email: invitedEmail, role: 'agent', invited_by: hostId })
      .select('id, token')
      .single()
    expect(invErr, `insert invitation: ${invErr?.message}`).toBeNull()

    // Inscription de l'invité : reçoit une agence solo malgré l'invitation en attente.
    const { data: created, error } = await svc.auth.admin.createUser({
      email: invitedEmail, password: PW, email_confirm: true,
      user_metadata: { full_name: 'Invité E2E', role: 'agent' },
    })
    if (error) throw new Error(`createUser invité e2e: ${error.message}`)
    userIds.push(created.user!.id)

    const { data: profAfterSignup } = await svc
      .from('profiles').select('agency_id').eq('id', created.user!.id).maybeSingle()
    expect(profAfterSignup?.agency_id, 'l’invité doit recevoir une agence solo à l’inscription').toBeTruthy()
    const soloAgencyId = profAfterSignup!.agency_id as string
    expect(soloAgencyId, 'l’agence solo ne doit pas être la vraie agence hôte').not.toBe(host!.agency_id)

    const { data: soloAgency } = await svc
      .from('agencies').select('solo, created_by').eq('id', soloAgencyId).maybeSingle()
    expect(soloAgency?.solo, 'l’agence provisionnée au signup doit être marquée solo').toBe(true)
    expect(soloAgency?.created_by, 'l’invité doit être le créateur de son agence solo').toBe(created.user!.id)

    // Réclamation réelle : sign-in de l'invité + appel accept-team-invite (action claim).
    const invitedClient = anonClient()
    const { error: signInErr } = await invitedClient.auth.signInWithPassword({ email: invitedEmail, password: PW })
    expect(signInErr, `signin invité: ${signInErr?.message}`).toBeNull()

    const { data: claimData, error: claimErr } = await invitedClient.functions.invoke('accept-team-invite', {
      body: { token: invitation!.token, action: 'claim' },
    })
    expect(claimErr, `claim: ${JSON.stringify(claimErr)}`).toBeNull()
    expect(claimData?.success, `claim payload: ${JSON.stringify(claimData)}`).toBe(true)

    // Après réclamation : la VRAIE agence, et l'agence solo a disparu (nettoyée par accept-team-invite).
    const { data: profAfterClaim } = await svc
      .from('profiles').select('agency_id, role').eq('id', created.user!.id).maybeSingle()
    expect(profAfterClaim?.agency_id, 'après réclamation, l’invité doit appartenir à la vraie agence').toBe(host!.agency_id)

    const { data: soloAgencyAfter } = await svc
      .from('agencies').select('id').eq('id', soloAgencyId).maybeSingle()
    expect(soloAgencyAfter, 'l’agence solo devenue inutile doit avoir été supprimée par accept-team-invite').toBeNull()
  })
})
