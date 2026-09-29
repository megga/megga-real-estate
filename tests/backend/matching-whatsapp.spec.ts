// Matching · lot D2 — les fonctions de base du copilote WhatsApp (migration …_matching_whatsapp.sql).
//   W1  `matching_actions_agence` rend, pour l'agence passée, ce que `matching_actions_du_jour` rend à son agent ;
//       sous un jeton, une autre agence ne rend rien et l'anonyme est refusé ; sous le rôle de service — qui
//       contourne la RLS, le chemin du copilote — seul `p_agency` cloisonne, éprouvé aux quatre sortes d'actions
//       posées chez B.
//   W2  `wa_matching_consigner` : proposé (deal, relance, journal — le même deal réutilisé et son mandat rattaché
//       sur une 2ᵉ/3ᵉ proposition), intéressé, pas intéressé + motif, pas encore — aux règles du fil ; « déjà
//       consigné » ne réécrit rien. Refusés à l'erreur (22023) : une réponse inconnue, un motif hors liste (dont
//       recherche_ajustee, pourtant accepté par le CHECK de la table). Refusés par `ok:false`, rien écrit : un
//       match d'une autre agence, un acheteur hors agence, un profil d'une autre agence, un mandat d'une autre
//       agence. Tout est signé MEGGA AI ; un utilisateur ne peut pas appeler la fonction.
//   W3  `wa_matching_visite` : un intéressé passe `visit_planned`, la visite porte le deal et n'écrit pas au client
//       (`reminder_sent`) ; le journal `visit_scheduled` reprend le libellé et la référence (bien_ref) du fil — le
//       `stage_change` du deal, lui, ne porte ni l'un ni l'autre, seul « signé ai » vaut pour lui aussi. Une annonce
//       du marché (avec son lieu, « adresse, ville ») devient un événement d'agenda dont le journal
//       (calendar_events_journaliser, sous le rôle de service) signe `ai`, jamais `system`, y compris à sa
//       suppression (`calendar_event_deleted`, cas annonce + intéressé SANS deal préalable — le deal créé porte
//       `market_listing_id`) ; un proposé ne bouge pas (`match_id` n'est rendu QUE si l'appel a fait bouger le
//       match) ; une visite SANS match existant se pose sans deal ni mouvement ; un deal déjà à une étape
//       postérieure (offer) ne recule pas et « /annuler » ne le bouge pas non plus. Refusé par `ok:false` : un
//       profil d'une autre agence (`raison: 'profil'`, sans écriture), un mandat supprimé ou d'une autre agence
//       (`raison: 'bien'`) ; un utilisateur authentifié est rejeté de DROIT (42501 : la baseline du projet accorde
//       EXECUTE à `authenticated` par défaut sur toute fonction neuve — c'est le `revoke` de cette migration qui le
//       retire, pas son absence). « /annuler » rend le match et l'étape du deal (un deal CRÉÉ survit à `new_lead`,
//       la ligne reste) ; sa propre garde de profil refuse elle aussi AVANT toute écriture (`ok:false`, la visite
//       reste). Le chemin CRM (jeton utilisateur, sans ces réglages) est couvert par `tests/backend/mail-rls.spec.ts`
//       — non-régression.
//   W4  `wa_matching_biens_designes` : un mandat et une annonce suivie désignés par un mot SANS accent, majuscule
//       accentuée (« Écublens ») ou ligature (« Vandœuvres ») comprises — `lower(unaccent(x))` traite les trois ;
//       absents — un mandat d'une autre agence, un mandat supprimé, une annonce SANS match compatible dans l'agence ;
//       un NOMBRE du titre désigne comme celui de l'adresse ; un utilisateur authentifié rejeté de DROIT (42501, même
//       oracle que W3).
//   W5  `wa_matching_biens_de_l_acheteur` : le mandat et l'annonce d'UN acheteur désignés par un mot sans accent,
//       avec l'id de leur match, par score décroissant, `p_limite` respectée, 201 lignes au plus ; absents — le match
//       d'un AUTRE acheteur, un statut hors `p_statuts`, une autre agence (son match, ou son mandat cité par un match
//       d'ici), un mandat supprimé ; un match qui porte un mandat ET une annonce rend le mandat (`genre = 'mandat'`),
//       et ne se désigne pas par le texte de l'annonce ; un NOMBRE du titre désigne ; un « 4½ pièces » est gardé par
//       les mots que `motsDe` envoie pour « 4.5 pièces » ; un utilisateur authentifié rejeté de DROIT (42501).
//   W6  `loadAgencyData` (point du matin, `morning-brief-data.ts`) contre une vraie base : la SEULE preuve que la
//       chaîne du `.or` des relances est une syntaxe PostgREST valide, que l'alias embarqué `contact.agency_id`
//       vide le contact sans écarter la relance, et que l'exclusion d'une relance-retour correspond à ce que la
//       RPC elle-même compte comme un retour pour le même acheteur — rien qu'un faux client ne peut prouver, lui
//       qui n'applique ni le schéma ni `!inner`. À garder VERTE en CI avant toute fusion de ce lot.
//   W7  (lot E1) un deal perdu ne reçoit aucun geste neuf : « Marquer perdu » n'écrit que l'étape `lost`, le statut
//       reste `active`. « proposé » et la visite d'un intéressé ouvrent un deal neuf, que portent la relance et la
//       visite, au lieu de se rattacher au perdu, qui ne reçoit rien (ni mandat, ni étape) ; un deal suspendu
//       (`on_hold`) reste ouvert : le geste s'y rattache ; un deal ouvert ANCIEN l'emporte sur un deal perdu plus
//       RÉCENT, le plus récent n'étant cherché que parmi les ouverts. La règle de `dealOuvert` (src/lib/dealOuvert.ts).
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés — et les crochets aussi : ils
// sont au niveau du module, pour que chaque bloc du fichier ajoute le sien sans dupliquer la mise en place.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'
import { motsDe } from '../../supabase/functions/_shared/whatsapp-matching'
import { loadAgencyData } from '../../supabase/functions/_shared/morning-brief-data.ts'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const JOUR = 86_400_000
const ilYA = (jours: number) => new Date(Date.now() - jours * JOUR).toISOString()
const dans = (jours: number) => new Date(Date.now() + jours * JOUR).toISOString()

let s: TwoAgenciesSetup
let svc: SupabaseClient
const contacts: string[] = []
const annonces: string[] = []
const biens: string[] = []
const matchs: string[] = []
const relances: string[] = []
const visites: string[] = []
const evenements: string[] = []

const mkContact = async (agencyId: string, prenom: string) => {
  const { data, error } = await svc.from('contacts').insert({
    agency_id: agencyId, first_name: prenom, last_name: `D2 ${s.stamp}`, type: 'buyer',
  }).select('id').single()
  if (error) throw new Error(`contacts ${prenom}: ${error.message}`)
  contacts.push(data.id as string)
  return data.id as string
}
/**
 * ⚠ Les champs de la pige se posent À L'INSERTION : `trg_ra_price_status` remet `first_seen_at`,
 * `price_at_first_seen` et `price_reduced_at` à leur valeur d'avant sur tout UPDATE. Par défaut une annonce est
 * VIEILLE (vue il y a 60 jours, jamais baissée) : elle ne fait aucun signal « marché » sans qu'on le demande.
 */
const mkAnnonce = async (tag: string, champs: Record<string, unknown> = {}) => {
  const prix = (champs.current_price ?? champs.price ?? 1_200_000) as number
  const { data, error } = await svc.from('market_listings').insert({
    source_id: `d2-${tag}-${s.stamp}`, source_portal: 'flatfox', title: `D2 ${tag} ${s.stamp}`, address: `Rue ${tag} 1`,
    city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy', quality_score: 70, status: 'active',
    price: prix, current_price: prix, price_at_first_seen: prix, first_seen_at: ilYA(60), ...champs,
  }).select('id').single()
  if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
  annonces.push(data.id as string)
  return data.id as string
}
const mkBien = async (agencyId: string, tag: string) => {
  const { data, error } = await svc.from('properties').insert({
    agency_id: agencyId, title: `D2 ${tag} ${s.stamp}`, address: `Chemin ${tag} 2`, type: 'apartment',
    transaction_type: 'buy', price: 1_500_000, status: 'active',
  }).select('id').single()
  if (error) throw new Error(`properties ${tag}: ${error.message}`)
  biens.push(data.id as string)
  return data.id as string
}
const mkMatch = async (agencyId: string, contactId: string, cible: { annonce?: string; bien?: string }, champs: Record<string, unknown> = {}) => {
  const { data, error } = await svc.from('matches').insert({
    agency_id: agencyId, contact_id: contactId, score: 80, status: 'suggested',
    source: cible.annonce ? 'market' : 'internal', market_listing_id: cible.annonce ?? null, property_id: cible.bien ?? null, ...champs,
  }).select('id').single()
  if (error) throw new Error(`matches: ${error.message}`)
  matchs.push(data.id as string)
  return data.id as string
}
const mkRelance = async (agencyId: string, contactId: string, ids: string[], triggerAt: string) => {
  const { data, error } = await svc.from('reminders').insert({
    agency_id: agencyId, contact_id: contactId, type: 'follow_up_sent_property', trigger_rule: 'manual', trigger_days: 3,
    trigger_at: triggerAt, status: 'pending', channel: 'task', match_id: ids[0], match_ids: ids.length > 1 ? ids : null,
    message_template: 'Retour (spec D2)',
  }).select('id').single()
  if (error) throw new Error(`reminders: ${error.message}`)
  relances.push(data.id as string)
  return data.id as string
}
// Comme `actions()` dans `tests/backend/matching-actions-du-jour.spec.ts` (D1) : lève sur `error` plutôt que de le
// laisser filer en silence — utilisé pour les appels SOUS LE RÔLE DE SERVICE, qui contournent la RLS (le chemin réel
// du copilote) et ne doivent donc leur cloisonnement qu'à `p_agency`.
const actionsAgence = async (agency: string | null, limite = 20) => {
  const { data, error } = await svc.rpc('matching_actions_agence', { p_agency: agency, p_limite: limite })
  if (error) throw new Error(error.message)
  return (data ?? []) as { genre: string; contact_id: string | null; property_id: string | null }[]
}

let julie = '', marc = '', lea = '', chezB = ''

beforeAll(async () => {
  if (!HAS_KEYS) return
  s = await setupTwoAgencies()
  svc = serviceRoleClient()
  julie = await mkContact(s.agencyAId, 'Julie')
  marc = await mkContact(s.agencyAId, 'Marc')
  lea = await mkContact(s.agencyAId, 'Léa')
  chezB = await mkContact(s.agencyBId, 'ChezB')
})

afterAll(async () => {
  if (!HAS_KEYS || !s) return
  if (visites.length) await svc.from('visits').delete().in('id', visites)
  if (evenements.length) await svc.from('calendar_events').delete().in('id', evenements)
  // Les relances et les deals que les fonctions posent elles-mêmes : par contact.
  await svc.from('reminders').delete().in('contact_id', contacts)
  if (relances.length) await svc.from('reminders').delete().in('id', relances)
  await svc.from('transactions').delete().in('contact_buyer_id', contacts)
  if (matchs.length) await svc.from('matches').delete().in('id', matchs)
  if (annonces.length) await svc.from('market_listings').delete().in('id', annonces)
  if (biens.length) await svc.from('properties').delete().in('id', biens)
  if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
  await s.cleanup()
})

describe.skipIf(!HAS_KEYS)('W1 — les actions du jour d’une agence', () => {
  it('matching_actions_agence rend ce que matching_actions_du_jour rend à l’agent ; sous un jeton une autre agence ne rend rien, sous le rôle de service seul p_agency cloisonne', async () => {
    const a1 = await mkMatch(s.agencyAId, julie, { annonce: await mkAnnonce('w1') }, { status: 'sent', sent_at: ilYA(5), prix_propose: 1_200_000 })
    await mkRelance(s.agencyAId, julie, [a1], ilYA(1))
    // Sous le rôle de service, seul `p_agency` cloisonne — la RLS ne s'applique pas. Un ancrage perdu ferait aussi
    // remonter les lignes de l'agence B ici : c'est CE symptôme (tout, plutôt que rien) que ses quatre sortes
    // éprouvent — « rien » échouait déjà, sans elles, sur le `.some(julie)` plus bas.
    const bRetour = await mkMatch(s.agencyBId, chezB, { annonce: await mkAnnonce('w1b-retour') }, { status: 'sent', sent_at: ilYA(5) })
    await mkRelance(s.agencyBId, chezB, [bRetour], ilYA(1))
    await mkMatch(s.agencyBId, chezB, { annonce: await mkAnnonce('w1b-prix', { price: 1_400_000 }) }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_500_000 })
    const mandatB = await mkBien(s.agencyBId, 'w1b-mandat')
    await mkMatch(s.agencyBId, chezB, { bien: mandatB })
    await mkMatch(s.agencyBId, chezB, { annonce: await mkAnnonce('w1b-marche', { first_seen_at: ilYA(1) }) })

    const { data: parAgent } = await s.clientA.rpc('matching_actions_du_jour', { p_limite: 20 })
    const parService = await actionsAgence(s.agencyAId)
    expect(parService).toEqual(parAgent)
    expect(parService.some((x) => x.genre === 'retour' && x.contact_id === julie)).toBe(true)
    expect(parService.some((x) => x.contact_id === chezB)).toBe(false)
    expect(parService.some((x) => x.property_id === mandatB)).toBe(false)

    // Symétrique sur B : les quatre sortes, dans l'ordre que rend la fonction (comme A1 dans la spec de D1).
    expect((await actionsAgence(s.agencyBId)).map((x) => [x.genre, x.contact_id ?? x.property_id])).toEqual([
      ['retour', chezB], ['prix', chezB], ['mandat', mandatB], ['marche', chezB],
    ])
    // Un agencement qui perdrait l'ancrage sur `p_agency` (ex. un `left join` sans filtre) ne rendrait pas `[]` ici.
    expect(await actionsAgence(null)).toEqual([])

    const { data: chezLesAutres } = await s.clientB.rpc('matching_actions_agence', { p_agency: s.agencyAId, p_limite: 20 })
    expect(chezLesAutres).toEqual([])
    const { error } = await anonClient().rpc('matching_actions_agence', { p_agency: s.agencyAId, p_limite: 20 })
    expect(error).not.toBeNull()
  })
})

const consigner = async (match: string, reponse: string, motif: string | null = null, note: string | null = null) => {
  const { data, error } = await svc.rpc('wa_matching_consigner', {
    p_agency: s.agencyAId, p_profile: s.agentAId, p_match: match, p_reponse: reponse, p_motif: motif, p_note: note,
  })
  if (error) throw new Error(error.message)
  return data as { ok: boolean; deja?: boolean; statut?: string; deal_id?: string; relance_id?: string }
}
const lireMatch = async (id: string) =>
  (await svc.from('matches').select('status, sent_via, prix_propose, reaction_motif, reaction_note, response_at').eq('id', id).single()).data as Record<string, unknown>
const journal = async (contactId: string, action: string) =>
  ((await svc.from('activity_events').select('actor_kind, actor_id, object_label, metadata').eq('entity_id', contactId).eq('action', action)).data ?? []) as {
    actor_kind: string; actor_id: string | null; object_label: string | null; metadata: Record<string, unknown>
  }[]

describe.skipIf(!HAS_KEYS)('W2 — consigner une réponse', () => {
  it('« proposé » : le match, un deal new_lead, UNE relance à +3 jours, le journal signé MEGGA AI', async () => {
    const m = await mkMatch(s.agencyAId, marc, { annonce: await mkAnnonce('w2p') })
    const r = await consigner(m, 'propose')
    expect(r).toMatchObject({ ok: true, deja: false })
    const apres = await lireMatch(m)
    expect(apres).toMatchObject({ status: 'sent', sent_via: 'agent' })
    expect(Number(apres.prix_propose)).toBe(1_200_000)
    const { data: deal } = await svc.from('transactions').select('stage, status, contact_buyer_id').eq('id', r.deal_id!).single()
    expect(deal).toMatchObject({ stage: 'new_lead', status: 'active', contact_buyer_id: marc })
    const { data: relance } = await svc.from('reminders').select('type, channel, status, match_id, trigger_at, message_template').eq('id', r.relance_id!).single()
    expect(relance).toMatchObject({ type: 'follow_up_sent_property', channel: 'task', status: 'pending', match_id: m })
    expect(Date.parse((relance as { trigger_at: string }).trigger_at)).toBeGreaterThan(Date.now() + 2.9 * JOUR)
    // Le fil désigne le bien par sa référence, jamais son titre (refAnnonceMarche : Flatfox, source_id = d2-w2p-<stamp>).
    expect((relance as { message_template: string }).message_template).toContain(`MG-FL-d2-w2p-${s.stamp}`)
    expect(await journal(marc, 'match_propose')).toEqual([expect.objectContaining({
      actor_kind: 'ai', actor_id: null, metadata: expect.objectContaining({ bien_refs: [`MG-FL-d2-w2p-${s.stamp}`] }),
    })])
    // Deux fois le même geste : rien de réécrit — une seule relance, un seul deal, une seule ligne de journal.
    expect(await consigner(m, 'propose')).toMatchObject({ ok: true, deja: true })
    expect((await svc.from('reminders').select('id').eq('match_id', m)).data).toHaveLength(1)
    expect((await svc.from('transactions').select('id').eq('contact_buyer_id', marc)).data).toHaveLength(1)
    expect(await journal(marc, 'match_propose')).toHaveLength(1)

    // 2ᵉ proposition, sur un MANDAT : le MÊME deal (rattacherDeal du fil), le mandat qui s'y rattache.
    const mandat1 = await mkBien(s.agencyAId, 'w2p-mandat1')
    const m2 = await mkMatch(s.agencyAId, marc, { bien: mandat1 })
    const r2 = await consigner(m2, 'propose')
    expect(r2).toMatchObject({ ok: true, deja: false, deal_id: r.deal_id })
    const { data: deal2 } = await svc.from('transactions').select('property_id').eq('id', r2.deal_id!).single()
    expect(deal2).toMatchObject({ property_id: mandat1 })
    const { data: relance2 } = await svc.from('reminders').select('property_id, message_template').eq('id', r2.relance_id!).single()
    expect(relance2).toMatchObject({ property_id: mandat1 })
    expect((relance2 as { message_template: string }).message_template).toContain(`MG-IN-${mandat1.slice(0, 6).toUpperCase()}`)

    // 3ᵉ proposition, sur un AUTRE mandat : le deal ne change pas de property_id (déjà posé, jamais écrasé).
    const mandat2 = await mkBien(s.agencyAId, 'w2p-mandat2')
    const m3 = await mkMatch(s.agencyAId, marc, { bien: mandat2 })
    const r3 = await consigner(m3, 'propose')
    expect(r3).toMatchObject({ ok: true, deja: false, deal_id: r.deal_id })
    const { data: deal3 } = await svc.from('transactions').select('property_id').eq('id', r3.deal_id!).single()
    expect(deal3).toMatchObject({ property_id: mandat1 })
  })

  it('« intéressé » puis « pas intéressé » : les déclencheurs datent, journalisent (ai) et closent la relance', async () => {
    const m1 = await mkMatch(s.agencyAId, julie, { annonce: await mkAnnonce('w2i1') }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_200_000 })
    const m2 = await mkMatch(s.agencyAId, julie, { annonce: await mkAnnonce('w2i2') }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_200_000 })
    const rel = await mkRelance(s.agencyAId, julie, [m1, m2], ilYA(1))
    expect(await consigner(m1, 'interesse')).toMatchObject({ ok: true, deja: false })
    // « datent » : set_match_response_at pose response_at sur CE match.
    expect(Date.parse((await lireMatch(m1)).response_at as string)).toBeGreaterThan(Date.now() - 5000)
    expect((await svc.from('reminders').select('status').eq('id', rel).single()).data).toMatchObject({ status: 'pending' })
    expect(await consigner(m2, 'pas_interesse', 'prix', '  trop cher  ')).toMatchObject({ ok: true, deja: false })
    expect(await lireMatch(m2)).toMatchObject({ status: 'rejected', reaction_motif: 'prix', reaction_note: 'trop cher' })
    expect((await svc.from('reminders').select('status').eq('id', rel).single()).data).toMatchObject({ status: 'done' })
    const reactions = await journal(julie, 'match_reaction')
    expect(reactions.length).toBeGreaterThanOrEqual(2)
    expect(reactions.every((e) => e.actor_kind === 'ai' && e.metadata.via === 'whatsapp')).toBe(true)
    // « Pas intéressé » revient aussi sur un intérêt ; « intéressé » ne répond qu'à un bien proposé — et ce
    // second « intéressé » (deja:true, rien à faire) laisse le match tel quel : rejected, motif quartier.
    expect(await consigner(m1, 'pas_interesse', 'quartier')).toMatchObject({ ok: true, deja: false })
    expect(await consigner(m1, 'interesse')).toMatchObject({ ok: true, deja: true })
    expect(await lireMatch(m1)).toMatchObject({ status: 'rejected', reaction_motif: 'quartier' })
  })

  it('« pas encore » repousse la relance qui couvre le bien ; un refus sans motif est une erreur', async () => {
    const m = await mkMatch(s.agencyAId, lea, { annonce: await mkAnnonce('w2e') }, { status: 'sent', sent_at: ilYA(4), prix_propose: 1_200_000 })
    const rel = await mkRelance(s.agencyAId, lea, [m], ilYA(1))
    expect(await consigner(m, 'pas_encore')).toMatchObject({ ok: true, deja: false, relance_id: rel })
    const { data } = await svc.from('reminders').select('trigger_at').eq('id', rel).single()
    expect(Date.parse((data as { trigger_at: string }).trigger_at)).toBeGreaterThan(Date.now() + 2.9 * JOUR)
    expect(await lireMatch(m)).toMatchObject({ status: 'sent' })
    expect(await journal(lea, 'match_pas_encore')).toEqual([expect.objectContaining({
      actor_kind: 'ai', metadata: expect.objectContaining({ relance_id: rel }),
    })])
    await expect(consigner(m, 'pas_interesse')).rejects.toThrow(/motif/)

    // Sans relance existante : « pas encore » en pose une, avec la référence du fil (jamais le titre).
    const m2 = await mkMatch(s.agencyAId, lea, { annonce: await mkAnnonce('w2e2') }, { status: 'sent', sent_at: ilYA(4) })
    const posee = await consigner(m2, 'pas_encore')
    expect(posee).toMatchObject({ ok: true, deja: false })
    const { data: nouvelle } = await svc.from('reminders').select('message_template').eq('id', posee.relance_id!).single()
    expect((nouvelle as { message_template: string }).message_template).toContain(`MG-FL-d2-w2e2-${s.stamp}`)
    // Les deux branches (relance réutilisée ci-dessus, relance créée ici) journalisent le VRAI relance_id.
    expect(await journal(lea, 'match_pas_encore')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: expect.objectContaining({ bien_ref: `MG-FL-d2-w2e2-${s.stamp}`, relance_id: posee.relance_id }),
      }),
    ]))
  })

  it('« pas encore » sur un match déjà répondu (par un collègue) ne réécrit rien', async () => {
    const m = await mkMatch(s.agencyAId, lea, { annonce: await mkAnnonce('w2dej') }, { status: 'interested', sent_at: ilYA(4), prix_propose: 1_200_000 })
    const echeance = ilYA(1)
    const rel = await mkRelance(s.agencyAId, lea, [m], echeance)
    expect(await consigner(m, 'pas_encore')).toMatchObject({ ok: true, deja: true, statut: 'interested' })
    const { data } = await svc.from('reminders').select('trigger_at, status').eq('id', rel).single()
    expect(data).toMatchObject({ status: 'pending' })
    // L'INSTANT, pas la chaîne : Postgres sérialise un timestamptz en « +00:00 », `toISOString` en « Z ».
    expect(Date.parse((data as { trigger_at: string }).trigger_at)).toBe(Date.parse(echeance))
  })

  it('une réponse inconnue, ou un motif hors liste (dont recherche_ajustee, accepté par le CHECK de la table), lève une erreur', async () => {
    const m = await mkMatch(s.agencyAId, lea, { annonce: await mkAnnonce('w2trou1') }, { status: 'sent', sent_at: ilYA(4) })
    const { error: e1 } = await svc.rpc('wa_matching_consigner', {
      p_agency: s.agencyAId, p_profile: s.agentAId, p_match: m, p_reponse: 'nimporte_quoi', p_motif: null, p_note: null,
    })
    expect(e1?.code).toBe('22023')
    // `recherche_ajustee` est un motif RÉEL (matches_reaction_motif_check l'accepte, pour « Apprendre ») — mais
    // pas un motif de REFUS du fil (MOTIFS_REFUS) : la fonction le refuse quand même.
    const { error: e2 } = await svc.rpc('wa_matching_consigner', {
      p_agency: s.agencyAId, p_profile: s.agentAId, p_match: m, p_reponse: 'pas_interesse', p_motif: 'recherche_ajustee', p_note: null,
    })
    expect(e2?.code).toBe('22023')
    expect(await lireMatch(m)).toMatchObject({ status: 'sent' })
  })

  it('un acheteur hors de l’agence, ou un profil d’une autre agence : ok:false, rien n’est écrit', async () => {
    // Le match est de l'agence A, mais son acheteur (chezB) est de l'agence B — matches_insert (RLS) ne
    // vérifie que agency_id, jamais celui du contact : l'anomalie est possible, la fonction doit la refuser.
    const mAcheteurHorsAgence = await mkMatch(s.agencyAId, chezB, { annonce: await mkAnnonce('w2trou2') }, { status: 'sent', sent_at: ilYA(4) })
    expect(await consigner(mAcheteurHorsAgence, 'interesse')).toEqual({ ok: false })
    expect(await lireMatch(mAcheteurHorsAgence)).toMatchObject({ status: 'sent' })

    // Un match et un acheteur valides, mais un profil de l'agence B.
    const mProfilB = await mkMatch(s.agencyAId, lea, { annonce: await mkAnnonce('w2trou3') }, { status: 'sent', sent_at: ilYA(4) })
    const { data, error } = await svc.rpc('wa_matching_consigner', {
      p_agency: s.agencyAId, p_profile: s.agentBId, p_match: mProfilB, p_reponse: 'interesse', p_motif: null, p_note: null,
    })
    if (error) throw new Error(error.message)
    expect(data).toEqual({ ok: false })
    expect(await lireMatch(mProfilB)).toMatchObject({ status: 'sent' })
  })

  it('un match de l’agence qui pointe vers un mandat de l’agence B : ok:false, rien n’est écrit', async () => {
    const mandatB = await mkBien(s.agencyBId, 'w2trou4')
    const m = await mkMatch(s.agencyAId, lea, { bien: mandatB }, { status: 'suggested' })
    expect(await consigner(m, 'propose')).toEqual({ ok: false })
    expect(await lireMatch(m)).toMatchObject({ status: 'suggested' })
    expect((await svc.from('reminders').select('id').eq('match_id', m)).data).toHaveLength(0)
    // Sur le mandat de B précisément — pas « Léa n'a aucun deal », qui dépendrait de l'ordre des tests.
    expect((await svc.from('transactions').select('id').eq('property_id', mandatB)).data).toHaveLength(0)
    expect((await svc.from('reminders').select('id').eq('property_id', mandatB)).data).toHaveLength(0)
  })

  it('un match d’une autre agence est refusé ; un utilisateur ne peut pas appeler la fonction', async () => {
    const m = await mkMatch(s.agencyBId, chezB, { annonce: await mkAnnonce('w2b') }, { status: 'sent', sent_at: ilYA(4) })
    expect(await consigner(m, 'interesse')).toEqual({ ok: false })
    expect(await lireMatch(m)).toMatchObject({ status: 'sent' })
    const { error } = await s.clientA.rpc('wa_matching_consigner', { p_agency: s.agencyAId, p_profile: s.agentAId, p_match: m, p_reponse: 'interesse' })
    expect(error).not.toBeNull()
  })
})

const planifier = async (contact: string, cible: { bien?: string; annonce?: string }, debut: string) => {
  const { data, error } = await svc.rpc('wa_matching_visite', {
    p_agency: s.agencyAId, p_profile: s.agentAId, p_contact: contact, p_property: cible.bien ?? null,
    p_market_listing: cible.annonce ?? null, p_debut: debut, p_duree: 45, p_type: 'sur_place',
  })
  if (error) throw new Error(error.message)
  return data as {
    ok: boolean; raison?: string; visite_id: string | null; evenement_id: string | null; deal_id: string | null
    etape_avant: string | null; statut_match: string | null; match_avant: string | null; match_id: string | null
  }
}
const statutMatch = async (id: string) => ((await svc.from('matches').select('status').eq('id', id).single()).data as { status: string }).status

describe.skipIf(!HAS_KEYS)('W3 — la visite du copilote', () => {
  it('un intéressé passe visit_planned, la visite porte le deal, aucun rappel au client ; « /annuler » rend tout', async () => {
    // Contact NEUF (comme W3.5) : julie porterait, selon l'ordre des tests, un deal actif d'un autre test — le
    // « aucun deal actif au départ » que ce test suppose ne doit rien à l'ordre d'exécution.
    const acheteur = await mkContact(s.agencyAId, 'W3Interesse')
    const bien = await mkBien(s.agencyAId, 'w3m')
    const m = await mkMatch(s.agencyAId, acheteur, { bien }, { status: 'interested', sent_at: ilYA(6) })
    const r = await planifier(acheteur, { bien }, dans(5))
    if (r.visite_id) visites.push(r.visite_id)
    // match_id n'est rendu QUE si cet appel a fait bouger le match (statut de départ 'interested').
    expect(r).toMatchObject({ ok: true, match_id: m, match_avant: 'interested', etape_avant: 'new_lead' })
    expect(await statutMatch(m)).toBe('visit_planned')
    const { data: v } = await svc.from('visits').select('reminder_sent, transaction_id, status').eq('id', r.visite_id!).single()
    expect(v).toEqual({ reminder_sent: true, transaction_id: r.deal_id, status: 'planned' })
    expect((await svc.from('transactions').select('stage').eq('id', r.deal_id!).single()).data).toEqual({ stage: 'visit_planned' })
    // Le journal reprend le libellé du fil (prénom nom · titre du bien) et sa référence (refBienInterne).
    const nomAcheteur = `W3Interesse D2 ${s.stamp}`
    const titreBien = `D2 w3m ${s.stamp}`
    expect(await journal(acheteur, 'visit_scheduled')).toEqual([expect.objectContaining({
      actor_kind: 'ai', object_label: `${nomAcheteur} · ${titreBien}`,
      metadata: expect.objectContaining({
        bien_ref: `MG-IN-${bien.slice(0, 6).toUpperCase()}`, visit_id: r.visite_id, match_id: m, deal_id: r.deal_id,
      }),
    })])
    // stage_change (capture_transaction_lifecycle, 20260617090000) lit les mêmes trois réglages de transaction :
    // l'avancée du deal à visit_planned est, elle aussi, signée ai — pas seulement le journal propre à la visite.
    expect(
      (await svc.from('activity_events').select('actor_kind, actor_id').eq('entity_id', r.deal_id!).eq('action', 'stage_change')).data,
    ).toEqual([expect.objectContaining({ actor_kind: 'ai', actor_id: null })])

    const { data: annule } = await svc.rpc('wa_matching_visite_annuler', {
      p_agency: s.agencyAId, p_profile: s.agentAId,
      p_retour: { visite_id: r.visite_id, match_id: r.match_id, deal_id: r.deal_id, etape_avant: r.etape_avant },
    })
    expect(annule).toEqual({ ok: true })
    expect((await svc.from('visits').select('id').eq('id', r.visite_id!)).data).toEqual([])
    expect(await statutMatch(m)).toBe('interested')
    expect((await svc.from('transactions').select('stage').eq('id', r.deal_id!).single()).data).toEqual({ stage: 'new_lead' })
  })

  it('une annonce du marché devient un événement d’agenda ; un bien seulement proposé ne bouge pas', async () => {
    const annonce = await mkAnnonce('w3a')
    const m = await mkMatch(s.agencyAId, marc, { annonce }, { status: 'sent', sent_at: ilYA(3), prix_propose: 1_200_000 })
    const r = await planifier(marc, { annonce }, dans(4))
    if (r.evenement_id) evenements.push(r.evenement_id)
    // Le match n'a pas bougé (statut de départ 'sent') : match_id n'est pas rendu, contrairement à statut_match.
    expect(r).toMatchObject({ ok: true, visite_id: null, match_id: null, statut_match: 'sent', match_avant: null })
    const { data: e } = await svc.from('calendar_events').select('type, contact_id, location').eq('id', r.evenement_id!).single()
    // Le lieu, comme le fil (FilConclure.tsx) : adresse et ville jointes par une virgule (mkAnnonce('w3a') pose
    // address: 'Rue w3a 1', city: 'Genève').
    expect(e).toEqual({ type: 'visite', contact_id: marc, location: `Rue w3a 1, Genève` })
    expect(await statutMatch(m)).toBe('sent')
    // Sous le rôle de service, auth.uid() est nul : sans les trois réglages lus par calendar_events_journaliser,
    // ce chemin (majoritaire, une annonce du marché) signerait `system` au lieu de MEGGA AI.
    expect(await journal(marc, 'calendar_event_created')).toEqual([expect.objectContaining({
      actor_kind: 'ai', actor_id: null, metadata: expect.objectContaining({ via: 'whatsapp', event_id: r.evenement_id }),
    })])
  })

  it('un contact d’une autre agence n’a pas de visite ; un utilisateur ne peut pas appeler la fonction', async () => {
    const bien = await mkBien(s.agencyAId, 'w3b')
    expect(await planifier(chezB, { bien }, dans(4))).toEqual({ ok: false, raison: 'contact' })
    // La baseline du projet (ALTER DEFAULT PRIVILEGES … GRANT ALL ON FUNCTIONS TO authenticated) donne EXECUTE par
    // défaut à toute fonction neuve : sans le `revoke … from public, anon, authenticated` de cette migration,
    // authenticated l'appellerait. Le refus est de DROIT, retiré explicitement — jamais un accident de données —
    // même oracle que matching-boucle.spec.ts:370.
    const { error } = await s.clientA.rpc('wa_matching_visite', {
      p_agency: s.agencyAId, p_profile: s.agentAId, p_contact: julie, p_property: bien, p_market_listing: null, p_debut: dans(4),
    })
    expect(error?.code).toBe('42501')
  })

  it('un profil d’une autre agence : ok:false, raison "profil" ; aucune visite écrite', async () => {
    const bien = await mkBien(s.agencyAId, 'w3profil')
    const { data, error } = await svc.rpc('wa_matching_visite', {
      p_agency: s.agencyAId, p_profile: s.agentBId, p_contact: julie, p_property: bien, p_market_listing: null, p_debut: dans(4),
    })
    if (error) throw new Error(error.message)
    expect(data).toEqual({ ok: false, raison: 'profil' })
    expect((await svc.from('visits').select('id').eq('property_id', bien)).data).toEqual([])
  })

  it('« /annuler » avec un profil d’une autre agence : ok:false, avant toute écriture ; la visite existe toujours', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W3AnnulerProfil')
    const bien = await mkBien(s.agencyAId, 'w3annulerprofil')
    const m = await mkMatch(s.agencyAId, acheteur, { bien }, { status: 'interested', sent_at: ilYA(6) })
    const r = await planifier(acheteur, { bien }, dans(3))
    if (r.visite_id) visites.push(r.visite_id)
    expect(r).toMatchObject({ ok: true, match_id: m })

    const { data: annule, error } = await svc.rpc('wa_matching_visite_annuler', {
      p_agency: s.agencyAId, p_profile: s.agentBId,
      p_retour: { visite_id: r.visite_id, match_id: r.match_id, deal_id: r.deal_id, etape_avant: r.etape_avant },
    })
    if (error) throw new Error(error.message)
    expect(annule).toEqual({ ok: false })
    expect((await svc.from('visits').select('id').eq('id', r.visite_id!)).data).toHaveLength(1)
    expect(await statutMatch(m)).toBe('visit_planned')
  })

  it('un deal déjà à une étape postérieure (offer) ne recule pas ; « /annuler » ne le bouge pas non plus', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W3Recul')
    const bien = await mkBien(s.agencyAId, 'w3recul')
    const m = await mkMatch(s.agencyAId, acheteur, { bien }, { status: 'interested', sent_at: ilYA(6) })
    const { data: deal, error: eDeal } = await svc.from('transactions').insert({
      agency_id: s.agencyAId, contact_buyer_id: acheteur, assigned_to: s.agentAId, stage: 'offer', status: 'active', property_id: bien,
    }).select('id').single()
    if (eDeal) throw new Error(eDeal.message)
    const dealId = (deal as { id: string }).id

    const r = await planifier(acheteur, { bien }, dans(6))
    if (r.visite_id) visites.push(r.visite_id)
    expect(r).toMatchObject({ ok: true, match_avant: 'interested', deal_id: dealId })
    expect(r.etape_avant).toBeNull()
    expect(await statutMatch(m)).toBe('visit_planned')
    expect((await svc.from('transactions').select('stage').eq('id', dealId).single()).data).toEqual({ stage: 'offer' })

    const { data: annule } = await svc.rpc('wa_matching_visite_annuler', {
      p_agency: s.agencyAId, p_profile: s.agentAId,
      p_retour: { visite_id: r.visite_id, match_id: m, deal_id: r.deal_id, etape_avant: r.etape_avant },
    })
    expect(annule).toEqual({ ok: true })
    expect(await statutMatch(m)).toBe('interested')
    expect((await svc.from('transactions').select('stage').eq('id', dealId).single()).data).toEqual({ stage: 'offer' })
  })

  it('annonce + intéressé, sans deal existant : le deal porte market_listing_id ; « /annuler » par evenement_id journalise calendar_event_deleted signé ai', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W3AnnonceInteresse')
    const annonce = await mkAnnonce('w3ai')
    const m = await mkMatch(s.agencyAId, acheteur, { annonce }, { status: 'interested', sent_at: ilYA(5) })
    const r = await planifier(acheteur, { annonce }, dans(3))
    if (r.evenement_id) evenements.push(r.evenement_id)
    expect(r).toMatchObject({ ok: true, visite_id: null, match_id: m, match_avant: 'interested', etape_avant: 'new_lead' })
    expect(await statutMatch(m)).toBe('visit_planned')
    expect((await svc.from('transactions').select('stage, market_listing_id, property_id').eq('id', r.deal_id!).single()).data)
      .toEqual({ stage: 'visit_planned', market_listing_id: annonce, property_id: null })

    // « /annuler » avec exactement ce que la fonction a rendu (evenement_id, pas visite_id — c'est une annonce).
    const { data: annule } = await svc.rpc('wa_matching_visite_annuler', {
      p_agency: s.agencyAId, p_profile: s.agentAId,
      p_retour: { evenement_id: r.evenement_id, match_id: r.match_id, deal_id: r.deal_id, etape_avant: r.etape_avant },
    })
    expect(annule).toEqual({ ok: true })
    expect((await svc.from('calendar_events').select('id').eq('id', r.evenement_id!)).data).toEqual([])
    expect(await journal(acheteur, 'calendar_event_deleted')).toEqual([expect.objectContaining({
      actor_kind: 'ai', actor_id: null, metadata: expect.objectContaining({ via: 'whatsapp', event_id: r.evenement_id }),
    })])
    expect(await statutMatch(m)).toBe('interested')
    expect((await svc.from('transactions').select('stage').eq('id', r.deal_id!).single()).data).toEqual({ stage: 'new_lead' })
  })

  it('une visite sans match existant : la visite est posée, aucun deal, aucun mouvement', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W3SansMatch')
    const bien = await mkBien(s.agencyAId, 'w3sansmatch')
    const r = await planifier(acheteur, { bien }, dans(3))
    if (r.visite_id) visites.push(r.visite_id)
    expect(r).toMatchObject({ ok: true, deal_id: null, match_id: null, statut_match: null, match_avant: null, etape_avant: null })
    expect(r.visite_id).not.toBeNull()
    expect((await svc.from('visits').select('transaction_id, status').eq('id', r.visite_id!).single()).data)
      .toEqual({ transaction_id: null, status: 'planned' })
  })

  it('raison "bien" : un mandat supprimé, ou d’une autre agence', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W3Bien')
    const supprime = await mkBien(s.agencyAId, 'w3bien-supprime')
    await svc.from('properties').update({ deleted_at: new Date().toISOString() }).eq('id', supprime)
    expect(await planifier(acheteur, { bien: supprime }, dans(3))).toEqual({ ok: false, raison: 'bien' })

    const mandatB = await mkBien(s.agencyBId, 'w3bien-agenceB')
    expect(await planifier(acheteur, { bien: mandatB }, dans(3))).toEqual({ ok: false, raison: 'bien' })
  })
})

const designer = async (agency: string | null, mots: string[], limite = 50) => {
  const { data, error } = await svc.rpc('wa_matching_biens_designes', { p_agency: agency, p_mots: mots, p_limite: limite })
  if (error) throw new Error(error.message)
  return (data ?? []) as { genre: string; id: string; titre: string | null; adresse: string | null; ville: string | null }[]
}

describe.skipIf(!HAS_KEYS)('W4 — désigner un bien par un texte, en base', () => {
  it('un mandat et une annonce suivie sont désignés par un mot SANS accent (unaccent)', async () => {
    const bien = await mkBien(s.agencyAId, 'w4mandat')
    await svc.from('properties').update({ city: `Vésenaz-${s.stamp}` }).eq('id', bien)
    const annonce = await mkAnnonce('w4annonce')
    await svc.from('market_listings').update({ city: `Genève-${s.stamp}` }).eq('id', annonce)
    await mkMatch(s.agencyAId, julie, { annonce })

    expect((await designer(s.agencyAId, [`vesenaz-${s.stamp}`])).map((r) => [r.genre, r.id])).toEqual([['mandat', bien]])
    expect((await designer(s.agencyAId, [`geneve-${s.stamp}`])).map((r) => [r.genre, r.id])).toEqual([['annonce', annonce]])
  })

  it('une MAJUSCULE accentuée (« Écublens ») et une LIGATURE (« Vandœuvres ») se retrouvent par un mot sans accent ni ligature', async () => {
    const ecublens = await mkBien(s.agencyAId, 'w4ecublens')
    await svc.from('properties').update({ city: `Écublens-${s.stamp}` }).eq('id', ecublens)
    const vandoeuvres = await mkBien(s.agencyAId, 'w4vandoeuvres')
    await svc.from('properties').update({ city: `Vandœuvres-${s.stamp}` }).eq('id', vandoeuvres)

    expect((await designer(s.agencyAId, [`ecublens-${s.stamp}`])).map((r) => r.id)).toEqual([ecublens])
    expect((await designer(s.agencyAId, [`vandoeuvres-${s.stamp}`])).map((r) => r.id)).toEqual([vandoeuvres])
  })

  it('absents : un mandat d’une AUTRE agence, un mandat SUPPRIMÉ, une annonce SANS match compatible dans l’agence', async () => {
    const mandatB = await mkBien(s.agencyBId, 'w4horsagence')
    expect(await designer(s.agencyAId, ['w4horsagence'])).toEqual([])
    // Le mandat existe bien, chez SA propre agence — la fonction ne le cache pas, elle ne le rend simplement pas à A.
    expect(await designer(s.agencyBId, ['w4horsagence'])).toEqual([{ genre: 'mandat', id: mandatB, titre: expect.any(String), adresse: expect.any(String), ville: null }])

    const supprime = await mkBien(s.agencyAId, 'w4supprime')
    await svc.from('properties').update({ deleted_at: new Date().toISOString() }).eq('id', supprime)
    expect(await designer(s.agencyAId, ['w4supprime'])).toEqual([])

    // Existe, suivie par PERSONNE dans l'agence (aucun match) : un titre à elle seul ne « suit » pas une annonce.
    const sansMatch = await mkAnnonce('w4sansmatch')
    expect(await designer(s.agencyAId, ['w4sansmatch'])).toEqual([])
    // Elle existe pourtant bel et bien dans le marché (source de vérité indépendante de la fonction).
    expect((await svc.from('market_listings').select('id').eq('id', sansMatch)).data).toHaveLength(1)
  })

  it('un NOMBRE du TITRE désigne (« Attique 7 pièces ») : il se compare au titre comme à l’adresse, plus à l’adresse seule', async () => {
    // Un repère fait de LETTRES : le tampon du jeu d'essai porte des chiffres, qui répondraient eux aussi au nombre.
    const repere = `w${s.stamp.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]).replace(/[^a-z]/g, '')}nombre`
    const bien = await mkBien(s.agencyAId, 'w4nombre')
    await svc.from('properties').update({ title: 'Attique 7 pièces', address: 'Chemin des Oliviers', city: repere }).eq('id', bien)
    // Le « 7 » n'est que dans le titre : comparé à la seule adresse, il ne rendrait rien.
    expect((await designer(s.agencyAId, [repere, '7'])).map((r) => r.id)).toEqual([bien])
    expect(await designer(s.agencyAId, [repere, '9'])).toEqual([])
  })

  it('un utilisateur authentifié ne peut pas appeler la fonction (42501, même oracle que W3)', async () => {
    const { error } = await s.clientA.rpc('wa_matching_biens_designes', { p_agency: s.agencyAId, p_mots: ['x'] })
    expect(error?.code).toBe('42501')
  })
})

const biensDeLAcheteur = async (agency: string, contact: string, statuts: string[], mots: string[], limite = 50) => {
  const { data, error } = await svc.rpc('wa_matching_biens_de_l_acheteur', {
    p_agency: agency, p_contact: contact, p_statuts: statuts, p_mots: mots, p_limite: limite,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as { match_id: string; genre: string; id: string; titre: string | null; adresse: string | null; ville: string | null }[]
}

describe.skipIf(!HAS_KEYS)('W5 — désigner un bien parmi ceux d’UN acheteur, en base', () => {
  it('le mandat et les annonces de l’acheteur, désignés par un mot SANS accent, avec l’id de leur match — le meilleur score d’abord, p_limite respectée', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W5Acheteur')
    const lieu = `Vésenaz-w5a-${s.stamp}`
    const mot = `vesenaz-w5a-${s.stamp}`
    const mandat = await mkBien(s.agencyAId, 'w5a-mandat')
    await svc.from('properties').update({ city: lieu }).eq('id', mandat)
    const annonce = await mkAnnonce('w5a-annonce', { city: lieu })
    const annonce2 = await mkAnnonce('w5a-annonce2', { city: lieu })
    const mMandat = await mkMatch(s.agencyAId, acheteur, { bien: mandat }, { status: 'sent', sent_at: ilYA(3), score: 70 })
    const mAnnonce = await mkMatch(s.agencyAId, acheteur, { annonce }, { status: 'sent', sent_at: ilYA(3), score: 90 })
    const mAnnonce2 = await mkMatch(s.agencyAId, acheteur, { annonce: annonce2 }, { status: 'sent', sent_at: ilYA(3), score: 40 })

    const lignes = await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], [mot])
    expect(lignes.map((r) => [r.genre, r.id, r.match_id])).toEqual([
      ['annonce', annonce, mAnnonce], ['mandat', mandat, mMandat], ['annonce', annonce2, mAnnonce2],
    ])
    // La ligne porte le texte du bien lui-même : `candidats` l'affine ensuite, en TypeScript.
    expect(lignes[0]).toMatchObject({ titre: `D2 w5a-annonce ${s.stamp}`, adresse: 'Rue w5a-annonce 1', ville: lieu })
    expect((await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], [mot], 1)).map((r) => r.match_id)).toEqual([mAnnonce])
    // Aucun mot : aucune ligne.
    expect(await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], [])).toEqual([])
  })

  it('absents : le match d’un AUTRE acheteur, un statut hors p_statuts, une autre agence (son match, ou son mandat cité ici), un mandat supprimé', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W5Seul')
    const autre = await mkContact(s.agencyAId, 'W5Autre')
    const lieu = `Carouge-w5b-${s.stamp}`
    const mot = `carouge-w5b-${s.stamp}`
    const annonceIci = (tag: string) => mkAnnonce(tag, { city: lieu })
    // Le seul qui doit sortir.
    const garde = await mkMatch(s.agencyAId, acheteur, { annonce: await annonceIci('w5b-garde') }, { status: 'sent', sent_at: ilYA(2) })
    // Un autre acheteur de la MÊME agence, sur un bien qui porte le même mot.
    await mkMatch(s.agencyAId, autre, { annonce: await annonceIci('w5b-autre') }, { status: 'sent', sent_at: ilYA(2) })
    // Le bon acheteur, à un statut que la réponse ne suppose pas.
    await mkMatch(s.agencyAId, acheteur, { annonce: await annonceIci('w5b-statut') }, { status: 'suggested' })
    // Un match de l'agence B sur ce même acheteur : `matches_insert` (RLS) ne vérifie que agency_id.
    await mkMatch(s.agencyBId, acheteur, { annonce: await annonceIci('w5b-agenceb') }, { status: 'sent', sent_at: ilYA(2) })
    // Un match d'ici qui cite le mandat de l'agence B.
    const mandatB = await mkBien(s.agencyBId, 'w5b-mandatb')
    await svc.from('properties').update({ city: lieu }).eq('id', mandatB)
    await mkMatch(s.agencyAId, acheteur, { bien: mandatB }, { status: 'sent', sent_at: ilYA(2) })
    // Un mandat supprimé de l'agence.
    const supprime = await mkBien(s.agencyAId, 'w5b-supprime')
    await svc.from('properties').update({ city: lieu, deleted_at: new Date().toISOString() }).eq('id', supprime)
    await mkMatch(s.agencyAId, acheteur, { bien: supprime }, { status: 'sent', sent_at: ilYA(2) })

    expect((await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], [mot])).map((r) => r.match_id)).toEqual([garde])
    // Le statut écarté revient dès qu'on le demande : `p_statuts` seul l'écartait.
    expect(await biensDeLAcheteur(s.agencyAId, acheteur, ['sent', 'suggested'], [mot])).toHaveLength(2)
  })

  it('un match qui porte un mandat ET une annonce rend le MANDAT, et ne se désigne pas par le texte de l’annonce', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W5Double')
    const mandat = await mkBien(s.agencyAId, 'w5c-mandat')
    await svc.from('properties').update({ city: `Cologny-w5c-${s.stamp}` }).eq('id', mandat)
    const annonce = await mkAnnonce('w5c-annonce', { city: `Chêne-w5c-${s.stamp}` })
    const m = await mkMatch(s.agencyAId, acheteur, { bien: mandat, annonce }, { status: 'sent', sent_at: ilYA(2) })

    expect(await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], [`cologny-w5c-${s.stamp}`])).toEqual([{
      match_id: m, genre: 'mandat', id: mandat, titre: `D2 w5c-mandat ${s.stamp}`, adresse: 'Chemin w5c-mandat 2', ville: `Cologny-w5c-${s.stamp}`,
    }])
    expect(await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], [`chene-w5c-${s.stamp}`])).toEqual([])
  })

  it('un NOMBRE du TITRE désigne (« Attique 7 pièces »), comme au §5 : plus seulement celui de l’adresse', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W5Nombre')
    const bien = await mkBien(s.agencyAId, 'w5nombre')
    await svc.from('properties').update({ title: 'Attique 7 pièces', address: 'Chemin des Oliviers', city: 'Carouge' }).eq('id', bien)
    const m = await mkMatch(s.agencyAId, acheteur, { bien }, { status: 'sent', sent_at: ilYA(2) })
    // Le « 7 » n'est que dans le titre : comparé à la seule adresse, il ne rendrait rien.
    expect((await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], ['attique', '7'])).map((r) => r.match_id)).toEqual([m])
    expect(await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], ['attique', '9'])).toEqual([])
  })

  it('un « 4½ pièces » est gardé par les mots que `motsDe` envoie pour « 4.5 pièces » : la partie entière seule, sous le vrai `unaccent`', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W5Demi')
    const bien = await mkBien(s.agencyAId, 'w5demi')
    await svc.from('properties').update({ title: 'Appartement 4½ pièces', address: 'Rue des Moulins', city: 'Carouge' }).eq('id', bien)
    const m = await mkMatch(s.agencyAId, acheteur, { bien }, { status: 'sent', sent_at: ilYA(2) })
    expect(motsDe('4.5 pièces')).toEqual(['4', 'pieces'])
    expect((await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], motsDe('4.5 pièces'))).map((r) => r.match_id)).toEqual([m])
  })

  it('le plafond est 201 : les 200 biens d’un écho relu, et la ligne qui dit la coupe — jamais plus', async () => {
    // Plafonnée à 200, une demande de 201 rendrait 200 lignes : l'exécuteur lirait complète une lecture coupée.
    const acheteur = await mkContact(s.agencyAId, 'W5Plafond')
    const { data: lues, error: eA } = await svc.from('market_listings').insert(Array.from({ length: 202 }, (_, i) => ({
      source_id: `d2-w5plafond-${i}-${s.stamp}`, source_portal: 'flatfox', title: `D2 w5plafond ${i} ${s.stamp}`, address: `Rue w5plafond ${i}`,
      city: 'Genève', canton: 'GE', type: 'apartment', transaction_type: 'buy', quality_score: 70, status: 'active',
      price: 1_200_000, current_price: 1_200_000, price_at_first_seen: 1_200_000, first_seen_at: ilYA(60),
    }))).select('id')
    if (eA) throw new Error(`market_listings w5plafond: ${eA.message}`)
    const ids = (lues ?? []).map((r) => r.id as string)
    annonces.push(...ids)
    const { data: poses, error: eM } = await svc.from('matches').insert(ids.map((id) => ({
      agency_id: s.agencyAId, contact_id: acheteur, score: 80, status: 'sent', sent_at: ilYA(2), source: 'market', market_listing_id: id,
    }))).select('id')
    if (eM) throw new Error(`matches w5plafond: ${eM.message}`)
    matchs.push(...(poses ?? []).map((r) => r.id as string))
    expect(await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], ['w5plafond'], 201)).toHaveLength(201)
    expect(await biensDeLAcheteur(s.agencyAId, acheteur, ['sent'], ['w5plafond'], 1000)).toHaveLength(201)
  })

  it('un utilisateur authentifié ne peut pas appeler la fonction (42501, même oracle que W3)', async () => {
    const { error } = await s.clientA.rpc('wa_matching_biens_de_l_acheteur', {
      p_agency: s.agencyAId, p_contact: julie, p_statuts: ['sent'], p_mots: ['x'],
    })
    expect(error?.code).toBe('42501')
  })
})

describe.skipIf(!HAS_KEYS)('W6 — loadAgencyData contre une vraie base', () => {
  // DOIT être verte en CI avant toute fusion de ce lot : un faux client n'applique ni le schéma ni `!inner`, donc
  // une faute dans la chaîne du `.or` (ex. une colonne mal orthographiée) ou un alias embarqué invalide y restent
  // verts alors qu'un vrai PostgREST les rendrait en 400 — et un `loadAgencyData` qui échoue rend `null`, donc plus
  // aucun point du matin, pour aucune agence.
  it('la relance-retour échue est exclue et son acheteur est dans les actions « retour » de la RPC ; une relance chaude sans match, une relance sans acheteur et une relance d’un acheteur d’une autre agence restent toutes lues', async () => {
    const now = new Date()
    const startIso = new Date(now.getTime() - JOUR).toISOString()
    const endIso = new Date(now.getTime() + JOUR).toISOString()
    const avant = await loadAgencyData(svc, s.agencyAId, startIso, endIso, now)
    expect(avant).not.toBeNull()

    const w6r = await mkContact(s.agencyAId, 'W6Retour')
    const m = await mkMatch(s.agencyAId, w6r, { annonce: await mkAnnonce('w6-retour') }, { status: 'sent', sent_at: ilYA(5) })
    await mkRelance(s.agencyAId, w6r, [m], ilYA(1))

    const w6c = await mkContact(s.agencyAId, 'W6Chaud')
    const { data: chaud, error: eC } = await svc.from('reminders').insert({
      agency_id: s.agencyAId, contact_id: w6c, type: 'follow_up_sent_property', trigger_rule: 'manual', trigger_days: 3,
      trigger_at: ilYA(1), status: 'pending', channel: 'task', match_id: null, match_ids: null, message_template: 'W6 chaud (spec D2)',
    }).select('id').single()
    if (eC) throw new Error(`reminders w6 chaud: ${eC.message}`)
    relances.push(chaud!.id as string)

    const { data: sansContact, error: eS } = await svc.from('reminders').insert({
      agency_id: s.agencyAId, contact_id: null, type: 'custom', trigger_rule: 'manual', trigger_days: 3,
      trigger_at: ilYA(1), status: 'pending', channel: 'task', message_template: 'W6 rappeler le notaire (spec D2)',
    }).select('id').single()
    if (eS) throw new Error(`reminders w6 sans contact: ${eS.message}`)
    relances.push(sansContact!.id as string)

    const { data: autreAgence, error: eA } = await svc.from('reminders').insert({
      agency_id: s.agencyAId, contact_id: chezB, type: 'follow_up_sent_property', trigger_rule: 'manual', trigger_days: 3,
      trigger_at: ilYA(1), status: 'pending', channel: 'task', match_id: null, match_ids: null, message_template: 'W6 étranger (spec D2)',
    }).select('id').single()
    if (eA) throw new Error(`reminders w6 autre agence: ${eA.message}`)
    relances.push(autreAgence!.id as string)

    const apres = await loadAgencyData(svc, s.agencyAId, startIso, endIso, now)
    expect(apres).not.toBeNull()

    // Trois relances de plus dans la lecture UTILE — la quatrième (le retour) n'y entre jamais.
    expect(apres!.reminders.length - avant!.reminders.length).toBe(3)
    expect(apres!.reminders.some((r) => r.who?.startsWith('W6Chaud'))).toBe(true)
    expect(apres!.reminders.some((r) => r.who?.startsWith('W6Retour'))).toBe(false)
    // Sans acheteur, et acheteur d'une autre agence : deux `who: null` de plus (le nom disparaît, la ligne reste).
    const nullsAvant = avant!.reminders.filter((r) => r.who == null).length
    const nullsApres = apres!.reminders.filter((r) => r.who == null).length
    expect(nullsApres - nullsAvant).toBe(2)

    // Équivalence avec la RPC : elle voit le même acheteur comme un retour.
    const actions = await actionsAgence(s.agencyAId)
    expect(actions.some((x) => x.genre === 'retour' && x.contact_id === w6r)).toBe(true)
  })
})

describe.skipIf(!HAS_KEYS)('W7 — un deal perdu ne reçoit aucun geste neuf (lot E1)', () => {
  /** Un deal de l'acheteur, posé comme le Pipeline le laisse : « Marquer perdu » n'écrit que l'étape. */
  const mkDeal = async (acheteur: string, champs: Record<string, unknown>) => {
    const { data, error } = await svc.from('transactions').insert({
      agency_id: s.agencyAId, contact_buyer_id: acheteur, assigned_to: s.agentAId, ...champs,
    }).select('id').single()
    if (error) throw new Error(`transactions: ${error.message}`)
    return (data as { id: string }).id
  }
  const lireDeal = async (id: string) =>
    (await svc.from('transactions').select('stage, status, property_id').eq('id', id).single()).data as Record<string, unknown>

  it('« proposé » : un deal neuf s’ouvre et porte la relance ; le deal perdu ne reçoit rien', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W7Propose')
    const perdu = await mkDeal(acheteur, { stage: 'lost', status: 'active' })
    const bien = await mkBien(s.agencyAId, 'w7p')
    const m = await mkMatch(s.agencyAId, acheteur, { bien })
    const r = await consigner(m, 'propose')
    expect(r).toMatchObject({ ok: true, deja: false })
    expect(r.deal_id).not.toBe(perdu)
    expect(await lireDeal(r.deal_id!)).toEqual({ stage: 'new_lead', status: 'active', property_id: bien })
    expect((await svc.from('reminders').select('transaction_id').eq('id', r.relance_id!).single()).data)
      .toEqual({ transaction_id: r.deal_id })
    // Le perdu n'a pas reçu le mandat : il est resté tel que « Marquer perdu » l'a laissé.
    expect(await lireDeal(perdu)).toEqual({ stage: 'lost', status: 'active', property_id: null })
    expect((await svc.from('transactions').select('id').eq('contact_buyer_id', acheteur)).data).toHaveLength(2)
  })

  it('la visite d’un intéressé : un deal neuf s’ouvre, avance et porte la visite ; le deal perdu reste perdu', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W7Visite')
    const bien = await mkBien(s.agencyAId, 'w7v')
    const perdu = await mkDeal(acheteur, { stage: 'lost', status: 'active', property_id: bien })
    const m = await mkMatch(s.agencyAId, acheteur, { bien }, { status: 'interested', sent_at: ilYA(6) })
    const r = await planifier(acheteur, { bien }, dans(5))
    if (r.visite_id) visites.push(r.visite_id)
    expect(r).toMatchObject({ ok: true, match_id: m, etape_avant: 'new_lead' })
    expect(r.deal_id).not.toBe(perdu)
    expect(await lireDeal(r.deal_id!)).toEqual({ stage: 'visit_planned', status: 'active', property_id: bien })
    expect((await svc.from('visits').select('transaction_id').eq('id', r.visite_id!).single()).data)
      .toEqual({ transaction_id: r.deal_id })
    expect(await lireDeal(perdu)).toEqual({ stage: 'lost', status: 'active', property_id: bien })
  })

  it('un deal suspendu (`on_hold`) reste ouvert : « proposé » s’y rattache', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W7Suspendu')
    const suspendu = await mkDeal(acheteur, { stage: 'active_search', status: 'on_hold' })
    const m = await mkMatch(s.agencyAId, acheteur, { annonce: await mkAnnonce('w7s') })
    expect(await consigner(m, 'propose')).toMatchObject({ ok: true, deja: false, deal_id: suspendu })
  })

  it('un deal ouvert ANCIEN et un deal perdu plus RÉCENT : « proposé », puis la visite de l’intéressé, prennent l’ancien', async () => {
    const acheteur = await mkContact(s.agencyAId, 'W7Ancien')
    // Le perdu est le plus récent : lue sur le statut seul, la lecture le prendrait ; pris d'abord puis refusé parce
    // que perdu, il ferait ouvrir un troisième deal. Le plus récent se cherche parmi les ouverts.
    const ouvert = await mkDeal(acheteur, { stage: 'active_search', status: 'active', created_at: ilYA(30) })
    const perdu = await mkDeal(acheteur, { stage: 'lost', status: 'active', created_at: ilYA(2) })
    const bien = await mkBien(s.agencyAId, 'w7a')
    const m = await mkMatch(s.agencyAId, acheteur, { bien })
    expect(await consigner(m, 'propose')).toMatchObject({ ok: true, deja: false, deal_id: ouvert })
    expect(await consigner(m, 'interesse')).toMatchObject({ ok: true, deja: false })
    const r = await planifier(acheteur, { bien }, dans(5))
    if (r.visite_id) visites.push(r.visite_id)
    expect(r).toMatchObject({ ok: true, match_id: m, deal_id: ouvert, etape_avant: 'active_search' })
    // L'ancien reçoit le mandat, l'étape et la visite ; le perdu reste tel que « Marquer perdu » l'a laissé.
    expect(await lireDeal(ouvert)).toEqual({ stage: 'visit_planned', status: 'active', property_id: bien })
    expect((await svc.from('visits').select('transaction_id').eq('id', r.visite_id!).single()).data)
      .toEqual({ transaction_id: ouvert })
    expect(await lireDeal(perdu)).toEqual({ stage: 'lost', status: 'active', property_id: null })
    expect((await svc.from('transactions').select('id').eq('contact_buyer_id', acheteur)).data).toHaveLength(2)
  })
})
