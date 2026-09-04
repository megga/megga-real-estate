// RLS de la Messagerie : visibilité owner/agency, isolation inter-agences, Vault
// inaccessible aux clients, RPC de liste. Tourne contre `supabase start`
// (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PASSWORD = 'Test-Password-123!'

describe.skipIf(!HAS_KEYS)('Messagerie — RLS, RPC, Vault', () => {
  let s: TwoAgenciesSetup
  let service: SupabaseClient
  let ownerBoxId: string      // boîte 'owner' de l'agent A
  let sharedBoxId: string     // boîte 'agency' de l'agent A
  let boxBId: string          // boîte de l'agence B
  let agentA2Id: string
  let clientA2: SupabaseClient
  let threadOwnerId: string
  let threadSharedId: string
  let labelAId: string
  let labelBId: string        // libellé de l'agence B — cible du WITH CHECK de mail_threads
  let contactAId: string      // contact de l'agence A — cas passant des alias
  let contactBId: string      // contact de l'agence B — cible du WITH CHECK des alias
  let messageOwnerId: string  // message de la boîte perso : super-admin ET offboarding
  let superAdminId: string
  let superClient: SupabaseClient

  const mkAccount = async (agencyId: string, ownerId: string, email: string, visibility: 'owner' | 'agency') => {
    const { data, error } = await service.from('mail_accounts').insert({
      agency_id: agencyId, owner_id: ownerId, provider: 'gmail', email, visibility,
    }).select('id').single()
    if (error) throw new Error(`mail_accounts ${email}: ${error.message}`)
    return data.id as string
  }
  const mkThread = async (accountId: string, agencyId: string, subject: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await service.from('mail_threads').insert({
      account_id: accountId, agency_id: agencyId, provider_thread_id: `t-${subject}-${Date.now()}`,
      subject, snippet: 'extrait', from_name: 'Alice Martin', from_email: 'alice@example.ch',
      last_message_at: new Date().toISOString(), last_inbound_at: new Date().toISOString(),
      is_read: false, ...extra,
    }).select('id').single()
    if (error) throw new Error(`mail_threads ${subject}: ${error.message}`)
    return data.id as string
  }
  const mkContact = async (agencyId: string, firstName: string, lastName: string, email: string) => {
    const { data, error } = await service.from('contacts').insert({
      agency_id: agencyId, first_name: firstName, last_name: lastName, email, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contacts ${email}: ${error.message}`)
    return data.id as string
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    service = serviceRoleClient()
    ownerBoxId = await mkAccount(s.agencyAId, s.agentAId, `perso-${s.stamp}@a.test`, 'owner')
    sharedBoxId = await mkAccount(s.agencyAId, s.agentAId, `contact-${s.stamp}@a.test`, 'agency')
    boxBId = await mkAccount(s.agencyBId, s.agentBId, `contact-${s.stamp}@b.test`, 'agency')
    threadOwnerId = await mkThread(ownerBoxId, s.agencyAId, 'Perso A')
    threadSharedId = await mkThread(sharedBoxId, s.agencyAId, 'Partagé A')
    await mkThread(sharedBoxId, s.agencyAId, 'Archivé A', { is_archived: true, is_read: true })
    await mkThread(boxBId, s.agencyBId, 'Agence B')

    // Un message dans la boîte PERSO : c'est le corps du courriel, la donnée que le
    // super-admin ne doit pas lire et que l'ex-membre doit perdre en partant.
    const { data: msg, error: mErr } = await service.from('mail_messages').insert({
      thread_id: threadOwnerId, account_id: ownerBoxId, agency_id: s.agencyAId,
      provider_message_id: `m-perso-${s.stamp}`, direction: 'inbound',
      from_name: 'Alice Martin', from_email: 'alice@example.ch',
      subject: 'Perso A', snippet: 'extrait', body_text: 'corps confidentiel',
      sent_at: new Date().toISOString(),
    }).select('id').single()
    if (mErr) throw new Error(`mail_messages: ${mErr.message}`)
    messageOwnerId = msg.id as string

    // Second agent DANS l'agence A : voit la boîte partagée, pas la boîte perso.
    const emailA2 = `agent-a2-${s.stamp}@megga-test.local`
    const { data: u, error: uErr } = await service.auth.admin.createUser({
      email: emailA2, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: 'Agent A2', role: 'agent' },
    })
    if (uErr) throw new Error(uErr.message)
    agentA2Id = u!.user!.id
    await service.from('profiles').upsert(
      { id: agentA2Id, email: emailA2, full_name: 'Agent A2', role: 'agent', agency_id: s.agencyAId },
      { onConflict: 'id' },
    )
    clientA2 = createClient(URL, ANON_KEY)
    const { error: sErr } = await clientA2.auth.signInWithPassword({ email: emailA2, password: PASSWORD })
    if (sErr) throw new Error(sErr.message)

    // Super-admin : agency_id NULL, domaine allowlisté par setupTwoAgencies
    // (app_config.super_admin_test_domain) — c'est ce que lit is_super_admin().
    const emailSu = `mail-super-${s.stamp}@megga-test.local`
    const { data: su, error: suErr } = await service.auth.admin.createUser({
      email: emailSu, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: 'Super Mail', role: 'agent' },
    })
    if (suErr) throw new Error(suErr.message)
    superAdminId = su!.user!.id
    const { error: spErr } = await service.from('profiles').upsert(
      { id: superAdminId, email: emailSu, full_name: 'Super Mail', role: 'super_admin', agency_id: null },
      { onConflict: 'id' },
    )
    if (spErr) throw new Error(spErr.message)
    superClient = anonClient()
    const { error: ssErr } = await superClient.auth.signInWithPassword({ email: emailSu, password: PASSWORD })
    if (ssErr) throw new Error(ssErr.message)

    const { data: lab, error: lErr } = await s.clientA.from('mail_labels')
      .insert({ agency_id: s.agencyAId, name: `À traiter ${s.stamp}`, color: '#fe566b' }).select('id').single()
    if (lErr) throw new Error(lErr.message)
    labelAId = lab.id

    const { data: labB, error: lbErr } = await service.from('mail_labels')
      .insert({ agency_id: s.agencyBId, name: `Chez B ${s.stamp}`, color: '#00aa55' }).select('id').single()
    if (lbErr) throw new Error(lbErr.message)
    labelBId = labB.id as string

    contactAId = await mkContact(s.agencyAId, 'Paul', 'Dumont', `paul-${s.stamp}@ex.ch`)
    contactBId = await mkContact(s.agencyBId, 'Bea', 'Berger', `bea-${s.stamp}@ex.ch`)
  }, 60_000)

  afterAll(async () => {
    await service.from('mail_accounts').delete().in('id', [ownerBoxId, sharedBoxId, boxBId])
    await service.from('mail_labels').delete().in('id', [labelAId, labelBId])
    await service.from('contacts').delete().in('id', [contactAId, contactBId])
    if (agentA2Id) await service.auth.admin.deleteUser(agentA2Id)
    if (superAdminId) await service.auth.admin.deleteUser(superAdminId)
    await s.cleanup()
  })

  it('le propriétaire voit ses deux boîtes, un collègue ne voit que la partagée', async () => {
    const { data: mine } = await s.clientA.from('mail_accounts').select('id').in('id', [ownerBoxId, sharedBoxId])
    expect((mine ?? []).map((r) => r.id).sort()).toEqual([ownerBoxId, sharedBoxId].sort())
    const { data: colleague } = await clientA2.from('mail_accounts').select('id').in('id', [ownerBoxId, sharedBoxId])
    expect((colleague ?? []).map((r) => r.id)).toEqual([sharedBoxId])
  })

  it('une autre agence ne voit rien, ni comptes ni fils', async () => {
    const { data: acc } = await s.clientB.from('mail_accounts').select('id').in('id', [ownerBoxId, sharedBoxId])
    expect(acc ?? []).toEqual([])
    const { data: th } = await s.clientB.from('mail_threads').select('id').in('id', [threadOwnerId, threadSharedId])
    expect(th ?? []).toEqual([])
  })

  it('les fils suivent la visibilité du compte', async () => {
    const { data } = await clientA2.from('mail_threads').select('id').in('id', [threadOwnerId, threadSharedId])
    expect((data ?? []).map((r) => r.id)).toEqual([threadSharedId])
  })

  it('un client ne peut pas écrire un fil, ni un compte, ni lire un état OAuth', async () => {
    const { error: e1 } = await s.clientA.from('mail_threads')
      .update({ is_read: true }).eq('id', threadSharedId).select('id')
    // La colonne is_read n'est pas accordée à authenticated : PostgREST refuse (42501).
    expect(e1).not.toBeNull()
    const emailKo = `refus-compte-${s.stamp}@y.test`
    const { error: e2 } = await s.clientA.from('mail_accounts')
      .insert({ agency_id: s.agencyAId, owner_id: s.agentAId, provider: 'gmail', email: emailKo })
    expect(e2).not.toBeNull()
    // ⚠ MÊME RÈGLE QU'AUX BROUILLONS ET AUX ALIAS PLUS BAS : une erreur non nulle ne
    // prouve pas qu'aucune ligne n'a été écrite — PostgREST sait répondre 201 avec un
    // corps vide sur certaines formes de requête. Ce fichier appliquait la relecture
    // service-role aux deux autres refus et pas à celui-ci, qui est pourtant le plus
    // lourd : une ligne `mail_accounts` écrite par un client est un compte de courrier
    // fabriqué de toutes pièces.
    const { data: resteCompte } = await service.from('mail_accounts').select('id').eq('email', emailKo)
    expect(resteCompte ?? []).toEqual([])
    const { data: st, error: e3 } = await s.clientA.from('mail_oauth_states').select('state')
    expect(e3).not.toBeNull()
    expect(st ?? []).toEqual([])
  })

  it('un client peut poser un libellé sur un fil visible (colonne accordée)', async () => {
    const { error } = await s.clientA.from('mail_threads')
      .update({ label_id: labelAId }).eq('id', threadSharedId)
    expect(error).toBeNull()
    const { data } = await s.clientA.from('mail_threads').select('label_id').eq('id', threadSharedId).single()
    expect(data?.label_id).toBe(labelAId)
  })

  it('les ponts Vault sont refusés aux clients', async () => {
    const { error } = await s.clientA.rpc('mail_secret_read', { p_id: '00000000-0000-0000-0000-000000000000' })
    expect(error).not.toBeNull()
    expect(String(error?.message)).toMatch(/permission denied|not found|42501/i)
  })

  // AJOUT — un refus ne prouve pas qu'un pont FONCTIONNE. `vault.secrets` compte 0 ligne
  // en production : le patron esign_secret_* recopié ici n'a jamais tourné pour de vrai,
  // et `mail_secret_update` n'a AUCUN précédent au dépôt (esign n'a que store/read/delete,
  // et `vault.update_secret` n'est appelée nulle part). Rien d'autre ne l'éprouvera jamais.
  it('le service-role fait l aller-retour complet dans le Vault', async () => {
    const nom = `mail:test:${s.stamp}`
    const avant = '{"a":1}'
    const apres = '{"a":2}'

    const store = await service.rpc('mail_secret_store', { p_secret: avant, p_name: nom })
    expect(store.error).toBeNull()
    expect(String(store.data)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    const secretId = store.data as string

    try {
      const lu = await service.rpc('mail_secret_read', { p_id: secretId })
      expect(lu.error).toBeNull()
      expect(String(lu.data)).toBe(avant)

      const maj = await service.rpc('mail_secret_update', { p_id: secretId, p_secret: apres })
      expect(maj.error).toBeNull()
      const relu = await service.rpc('mail_secret_read', { p_id: secretId })
      expect(String(relu.data)).toBe(apres)
    } finally {
      const del = await service.rpc('mail_secret_delete', { p_id: secretId })
      expect(del.error).toBeNull()
    }
    const disparu = await service.rpc('mail_secret_read', { p_id: secretId })
    expect(disparu.error).toBeNull()
    expect(disparu.data).toBeNull()
  })

  it('mail_list_threads : dossiers, total, recherche', async () => {
    const inbox = await s.clientA.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'in' })
    expect(inbox.error).toBeNull()
    expect(inbox.data?.map((r: { subject: string }) => r.subject)).toEqual(['Partagé A'])
    expect(Number(inbox.data?.[0]?.total)).toBe(1)

    const arch = await s.clientA.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'arch' })
    expect(arch.data?.map((r: { subject: string }) => r.subject)).toEqual(['Archivé A'])

    const search = await s.clientA.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'in', p_q: 'ALICE' })
    expect(search.data?.length).toBe(1)
    const none = await s.clientA.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'in', p_q: 'zzz' })
    expect(none.data ?? []).toEqual([])

    // Un compte invisible rend une liste vide, pas une erreur (la RLS filtre avant).
    // ⚠ `error` EST asserté : sans lui, un `grant execute` révoqué sur
    // `mail_list_threads` satisferait cette isolation — la RPC échouerait, `data` serait
    // null, et le test verrait le vide qu'il attend. Il ne tenait que par le contrôle
    // d'erreur du cas passant, quinze lignes plus haut, dans le même `it()`.
    const foreign = await s.clientB.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'in' })
    expect(foreign.error).toBeNull()
    expect(foreign.data ?? []).toEqual([])
  })

  it('mail_unread_counts et mail_folder_counts', async () => {
    // ⚠ Le libellé est posé ICI et non hérité du test précédent : `label_counts` dépendait
    // de l'ordre de DÉCLARATION des `it()`, un couplage que rien n'écrivait et que le
    // premier réordonnancement — ou un `--shard` — aurait cassé sans que la cause se voie.
    const { error: eLabel } = await s.clientA.from('mail_threads')
      .update({ label_id: labelAId }).eq('id', threadSharedId)
    expect(eLabel).toBeNull()

    const { data } = await s.clientA.rpc('mail_unread_counts')
    const row = (data ?? []).find((r: { account_id: string }) => r.account_id === sharedBoxId)
    expect(Number(row?.unread)).toBe(1)
    const { data: fc } = await s.clientA.rpc('mail_folder_counts', { p_account_id: sharedBoxId })
    expect(Number(fc?.[0]?.inbox_unread)).toBe(1)
    expect(Number(fc?.[0]?.archived)).toBe(1)
    expect(Number(fc?.[0]?.drafts)).toBe(0)
    expect(fc?.[0]?.label_counts).toEqual({ [labelAId]: 1 })
  })

  it('mail_search_contacts cherche dans l agence de l appelant seulement', async () => {
    const { data: c } = await service.from('contacts').insert({
      agency_id: s.agencyAId, first_name: 'Zoé', last_name: 'Rochat', email: `zoe-${s.stamp}@ex.ch`, type: 'buyer',
    }).select('id').single()
    const hit = await s.clientA.rpc('mail_search_contacts', { p_q: 'zoé roch' })
    expect(hit.data?.map((r: { id: string }) => r.id)).toContain(c!.id)
    const miss = await s.clientB.rpc('mail_search_contacts', { p_q: 'zoé roch' })
    expect((miss.data ?? []).map((r: { id: string }) => r.id)).not.toContain(c!.id)
    await service.from('contacts').delete().eq('id', c!.id)
  })

  // AJOUT — le plan maître (§7.2) promet que le super-admin ne lit AUCUN corps de
  // courriel. Aucune policy `is_super_admin()` n'existe sur mail_messages, et son
  // agency_id vaut NULL : la propriété tient par un `=` avec NULL, ce qui est exactement
  // le genre de garantie qui se casse à la première policy « de confort » ajoutée plus tard.
  it('un super-admin ne lit aucun message', async () => {
    const visible = await s.clientA.from('mail_messages').select('id').eq('id', messageOwnerId)
    expect((visible.data ?? []).map((r) => r.id)).toEqual([messageOwnerId])

    // ⛔ TÉMOIN POSITIF D'ABORD. Une lecture vide se produit aussi bien parce que la
    // policy tient que parce que la session est morte (jeton expiré, connexion ratée
    // avalée) — et « vide pour une raison qui n'est pas la bonne » est exactement la
    // forme de test que cette revue traque. Le témoin choisi prouve les DEUX prémisses en
    // une lecture : `super_admin_read_all_profiles` (USING `is_super_admin()`) est la
    // seule policy qui rende à cette session le profil d'un agent d'une agence à laquelle
    // elle n'appartient pas. Non vide ⇒ la session vit ET `is_super_admin()` répond vrai.
    // C'est bien un super-admin PUISSANT qui, ci-dessous, ne lit aucun courrier.
    const temoin = await superClient.from('profiles').select('id').eq('id', s.agentAId)
    expect(temoin.error, 'la session super-admin ne lit RIEN — le vide ci-dessous ne prouverait rien').toBeNull()
    expect((temoin.data ?? []).map((r) => r.id), 'is_super_admin() ne répond pas vrai pour cette session').toEqual([s.agentAId])

    const { data: rien, error } = await superClient.from('mail_messages').select('id')
    expect(error).toBeNull()
    expect(rien ?? []).toEqual([])
  })

  // AJOUT — les trois WITH CHECK resserrés à la revue de la task 1.1. Chacun refuse une
  // écriture INTER-AGENCES que la seule clé étrangère laisserait passer.
  it('un brouillon estampillé d une autre agence est refusé', async () => {
    const sujetOk = `brouillon-ok-${s.stamp}`
    const sujetKo = `brouillon-refus-${s.stamp}`

    // Cas passant d'abord : sans lui, un refus ne prouverait pas que le chemin d'écriture
    // existe — un brouillon refusé pour un motif quelconque passerait pour une preuve.
    const ok = await s.clientA.from('mail_drafts').insert({
      account_id: sharedBoxId, agency_id: s.agencyAId, author_id: s.agentAId, subject: sujetOk,
    }).select('id').single()
    expect(ok.error).toBeNull()
    await s.clientA.from('mail_drafts').delete().eq('id', ok.data!.id)

    const { error } = await s.clientA.from('mail_drafts').insert({
      account_id: sharedBoxId, agency_id: s.agencyBId, author_id: s.agentAId, subject: sujetKo,
    })
    expect(error).not.toBeNull()
    // ⚠ L'erreur ne suffit pas : PostgREST sait répondre 201 avec un corps vide sur
    // certaines formes de requête. On relit avec le service-role, hors RLS.
    const { data: reste } = await service.from('mail_drafts').select('id').eq('subject', sujetKo)
    expect(reste ?? []).toEqual([])
  })

  it('un libellé d une autre agence ne peut pas être posé sur un fil', async () => {
    const ok = await s.clientA.from('mail_threads')
      .update({ label_id: labelAId }).eq('id', threadSharedId)
    expect(ok.error).toBeNull()

    const { error } = await s.clientA.from('mail_threads')
      .update({ label_id: labelBId }).eq('id', threadSharedId)
    expect(error).not.toBeNull()
    const { data: apres } = await service.from('mail_threads')
      .select('label_id').eq('id', threadSharedId).single()
    expect(apres?.label_id).toBe(labelAId)
  })

  it('un alias vers le contact d une autre agence est refusé', async () => {
    const emailOk = `alias-ok-${s.stamp}@ex.ch`
    const emailKo = `alias-refus-${s.stamp}@ex.ch`

    const ok = await s.clientA.from('mail_contact_aliases').insert({
      agency_id: s.agencyAId, email: emailOk, contact_id: contactAId, learned_by: s.agentAId,
    }).select('id').single()
    expect(ok.error).toBeNull()
    await s.clientA.from('mail_contact_aliases').delete().eq('id', ok.data!.id)

    // agency_id reste celui de l'appelant : c'est le contact qui appartient à l'agence B.
    // Sans le `exists` du WITH CHECK, l'ingestion (service-role, hors RLS) recopierait ce
    // contact étranger sur mail_threads.contact_id — un fil « rattaché » et vide.
    const { error } = await s.clientA.from('mail_contact_aliases').insert({
      agency_id: s.agencyAId, email: emailKo, contact_id: contactBId, learned_by: s.agentAId,
    })
    expect(error).not.toBeNull()
    const { data: reste } = await service.from('mail_contact_aliases').select('id').eq('email', emailKo)
    expect(reste ?? []).toEqual([])
  })

  // AJOUT, ET LE DERNIER DE LA LISTE (la suite est sérielle : ce test déplace un profil
  // puis le remet, et l'ordre de déclaration est donc l'ordre d'exécution).
  //
  // La fuite que le ET conjoint de mail_account_visible ferme : `team_remove_member` ne
  // fait qu'un `update profiles set agency_id = null, role = 'buyer'` — la ligne profiles
  // SURVIT, donc la clé étrangère `owner_id … on delete cascade` ne se déclenche jamais et
  // le compte reste 'active'. `accept-team-invite` réécrit ensuite `profiles.agency_id`
  // vers une NOUVELLE agence. Sans le ET, la branche `owner_id = auth.uid()` suivrait
  // l'ex-membre chez le concurrent.
  //
  // ⚠ Le JWT de s.clientA n'est PAS renouvelé, et c'est le cœur du test : la policy
  // réévalue get_my_agency_id() à chaque instruction, elle n'est pas figée dans le jeton.
  it('une boîte ne suit pas son propriétaire qui change d agence', async () => {
    const avantComptes = await s.clientA.from('mail_accounts').select('id').eq('id', ownerBoxId)
    expect((avantComptes.data ?? []).map((r) => r.id)).toEqual([ownerBoxId])
    const avantFils = await s.clientA.from('mail_threads').select('id').eq('id', threadOwnerId)
    expect((avantFils.data ?? []).map((r) => r.id)).toEqual([threadOwnerId])
    const avantMsg = await s.clientA.from('mail_messages').select('id').eq('id', messageOwnerId)
    expect((avantMsg.data ?? []).map((r) => r.id)).toEqual([messageOwnerId])
    const avantListe = await s.clientA.rpc('mail_list_threads', { p_account_id: ownerBoxId, p_folder: 'in' })
    expect(avantListe.data?.length).toBe(1)

    try {
      const { error: movErr } = await service.from('profiles')
        .update({ agency_id: s.agencyBId }).eq('id', s.agentAId)
      expect(movErr).toBeNull()

      const { data: comptes } = await s.clientA.from('mail_accounts').select('id').eq('id', ownerBoxId)
      expect(comptes ?? []).toEqual([])
      const { data: fils } = await s.clientA.from('mail_threads').select('id').eq('account_id', ownerBoxId)
      expect(fils ?? []).toEqual([])
      const { data: msgs } = await s.clientA.from('mail_messages').select('id').eq('account_id', ownerBoxId)
      expect(msgs ?? []).toEqual([])
      const apresListe = await s.clientA.rpc('mail_list_threads', { p_account_id: ownerBoxId, p_folder: 'in' })
      expect(apresListe.data ?? []).toEqual([])
    } finally {
      await service.from('profiles').update({ agency_id: s.agencyAId }).eq('id', s.agentAId)
    }
  })
})
