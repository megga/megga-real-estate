// RLS — `visits` est FERMÉE à un compte qui ne fait que revendiquer un e-mail.
//
// ⚠ CE FICHIER A CHANGÉ DE SENS (03.08.2026). Il éprouvait la policy
// `visits_select_by_buyer_email` (20260526140000), qui laissait tout compte
// authentifié lire une ligne `visits` ENTIÈRE dès que la revendication `email` de
// son JWT égalait `buyer_email`. Cette ligne porte `manage_token` — la capability
// qui commande replanification, annulation et dépôt d'avis. Un e-mail revendiqué
// n'est pas un e-mail prouvé : la policy distribuait donc le jeton.
//
// Elle servait un seul écran, `VisitsRow.tsx`, supprimé avec la marketplace au
// pivot CRM-first ; `/account` redirige vers `/dashboard` et plus aucun compte de
// production n'est dépourvu de profil. Retirée par la migration
// 20260802223756_visit_token_lifecycle.sql.
//
// Le fichier est conservé RETOURNÉ plutôt que supprimé : il vaut désormais comme
// garde-fou anti-récidive. Rétablir la policy le fait rougir, ce qu'une simple
// suppression n'aurait pas fait.
//
// L'accès public légitime de l'acheteur passe par les RPC SECURITY DEFINER
// `*_visit_by_token`, éprouvées dans `rls-advisors-hardening.spec.ts`.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'

const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PASSWORD = 'Test-Buyer-Password-123!'
const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS — visits readable by buyer_email', () => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const buyerEmail = `buyer-${stamp}@megga-test.local`
  const otherEmail = `other-buyer-${stamp}@megga-test.local`

  let agencyId: string
  let propertyId: string
  let agentUserId: string
  let buyerUserId: string
  let visitMineId: string
  let visitOtherId: string
  let buyerClient: SupabaseClient

  beforeAll(async () => {
    const service = serviceRoleClient()

    // 1) Agency + agent profile (needed because visits.agency_id is NOT NULL)
    const { data: agency, error: agencyErr } = await service
      .from('agencies')
      .insert({ name: `Visit RLS Agency ${stamp}`, slug: `visit-rls-${stamp}` })
      .select('id')
      .single()
    if (agencyErr) throw new Error(`agency: ${agencyErr.message}`)
    agencyId = agency.id

    const agentEmail = `agent-${stamp}@megga-test.local`
    const { data: agentUser, error: agentErr } = await service.auth.admin.createUser({
      email: agentEmail,
      password: PASSWORD,
      email_confirm: true,
    })
    if (agentErr) throw new Error(`agentUser: ${agentErr.message}`)
    agentUserId = agentUser.user!.id

    await service.from('profiles').upsert(
      { id: agentUserId, email: agentEmail, full_name: 'Visit Agent', role: 'agent', agency_id: agencyId },
      { onConflict: 'id' }
    )

    // 2) Property
    const { data: prop, error: propErr } = await service
      .from('properties')
      .insert({ agency_id: agencyId, title: `Visit Test Property ${stamp}` })
      .select('id')
      .single()
    if (propErr) throw new Error(`property: ${propErr.message}`)
    propertyId = prop.id

    // 3) Contact needed because visits.contact_id is NOT NULL
    const { data: contact, error: contactErr } = await service
      .from('contacts')
      .insert({
        agency_id: agencyId,
        first_name: 'Visit',
        last_name: `Buyer ${stamp}`,
        email: buyerEmail,
        entity_type: 'pp', // pp = personne physique, pm = personne morale
        type: 'buyer',
        source: 'manual',
      })
      .select('id')
      .single()
    if (contactErr) throw new Error(`contact: ${contactErr.message}`)

    // 4) Two visits — one for our buyer, one for someone else
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: visits, error: visitErr } = await service
      .from('visits')
      .insert([
        {
          agency_id: agencyId,
          property_id: propertyId,
          contact_id: contact.id,
          scheduled_at: futureDate,
          status: 'planned',
          buyer_email: buyerEmail,
          buyer_message: 'Test message from buyer',
          agent_id: agentUserId,
        },
        {
          agency_id: agencyId,
          property_id: propertyId,
          contact_id: contact.id,
          scheduled_at: futureDate,
          status: 'planned',
          buyer_email: otherEmail,
          agent_id: agentUserId,
        },
      ])
      .select('id, buyer_email')
    if (visitErr) throw new Error(`visits: ${visitErr.message}`)
    visitMineId = visits.find(v => v.buyer_email === buyerEmail)!.id
    visitOtherId = visits.find(v => v.buyer_email === otherEmail)!.id

    // 5) Authenticated buyer (no profile, no agency)
    const { data: buyerUser, error: buyerErr } = await service.auth.admin.createUser({
      email: buyerEmail,
      password: PASSWORD,
      email_confirm: true,
    })
    if (buyerErr) throw new Error(`buyerUser: ${buyerErr.message}`)
    buyerUserId = buyerUser.user!.id

    buyerClient = createClient(URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signinErr } = await buyerClient.auth.signInWithPassword({
      email: buyerEmail,
      password: PASSWORD,
    })
    if (signinErr) throw new Error(`buyer signin: ${signinErr.message}`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (visitMineId)   await svc.from('visits').delete().eq('id', visitMineId).then(() => {}, () => {})
    if (visitOtherId)  await svc.from('visits').delete().eq('id', visitOtherId).then(() => {}, () => {})
    if (propertyId)    await svc.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    if (buyerUserId)   await svc.auth.admin.deleteUser(buyerUserId).catch(() => {})
    if (agentUserId)   await svc.auth.admin.deleteUser(agentUserId).catch(() => {})
    if (agencyId)      await svc.from('agencies').delete().eq('id', agencyId).then(() => {}, () => {})
  })

  it('la session acheteur est bien AUTHENTIFIÉE (garde anti-test creux)', async () => {
    // Sans cette assertion, tous les tests ci-dessous passeraient pour la mauvaise
    // raison : un client non connecté rend `[]` sur tout, et un fichier entier de
    // « rien ne fuit » resterait vert alors qu'il ne prouve plus rien. C'est le
    // motif du vert sans assertion, déjà rencontré deux fois sur ce chantier.
    const { data, error } = await buyerClient.auth.getUser()
    expect(error).toBeNull()
    expect(data.user?.id).toBe(buyerUserId)
    expect(data.user?.email).toBe(buyerEmail)
  })

  it('un compte qui revendique buyer_email NE LIT PLUS sa visite (policy retirée)', async () => {
    // Le cœur de la régression : cette ligne porte `manage_token`. La rendre
    // lisible sur une simple revendication d'e-mail revient à donner la capability
    // à qui sait prononcer l'adresse.
    const { data, error } = await buyerClient
      .from('visits')
      .select('id, buyer_email, manage_token')
      .eq('id', visitMineId)
    expect(error).toBeNull()
    expect(data, 'visits_select_by_buyer_email est revenue — le manage_token refuit').toEqual([])
  })

  it('buyer CANNOT see a visit booked under a different email', async () => {
    const { data, error } = await buyerClient
      .from('visits')
      .select('id')
      .eq('id', visitOtherId)
    expect(error).toBeNull()
    expect(data, `buyer leaked other email's visit`).toEqual([])
  })

  it('une liste sans filtre ne rend AUCUNE visite', async () => {
    // Autrefois « seulement les siennes ». Désormais aucune : un compte sans profil
    // n'a plus aucune lecture directe sur `visits`. On assère le vide, pas
    // l'absence-d'autrui — sinon le test resterait vert si la policy revenait.
    const { data, error } = await buyerClient
      .from('visits')
      .select('id, buyer_email')
      .limit(50)
    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })

  it('la jointure ne contourne pas le refus', async () => {
    // Une requête à jointures était le chemin réel de l'ancien écran. On vérifie
    // qu'elle ne rouvre pas une porte que la sélection simple ferme : PostgREST
    // applique la RLS de `visits` AVANT de résoudre les FK, donc pas de ligne.
    const { data, error } = await buyerClient
      .from('visits')
      .select(`
        id,
        scheduled_at,
        buyer_message,
        properties:property_id ( title, address ),
        agent:profiles!agent_id ( full_name )
      `)
      .eq('id', visitMineId)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it("le parcours public légitime, lui, marche toujours — par JETON, pas par e-mail", async () => {
    // Contrepartie indispensable : sans elle, ce fichier prouverait seulement
    // qu'on a tout fermé, pas qu'on a fermé la BONNE chose. L'acheteur garde son
    // accès, il le tient du lien qu'on lui a envoyé et non de son adresse.
    const svc = serviceRoleClient()
    const { data: row } = await svc.from('visits').select('manage_token').eq('id', visitMineId).single()
    const { data: vue, error } = await buyerClient.rpc('get_visit_by_token', {
      p_token: row!.manage_token as string,
    })
    expect(error).toBeNull()
    expect((vue as { id?: string } | null)?.id).toBe(visitMineId)
  })
})
