// Backend integration spec (live CI) — les « vues » de lecture de la console
// (migration 20260731280000, étape 9 du plan, spec §4.3/§5.1/§5.3/§5.4/§5.7).
//
// Ce que ce fichier cherche à faire échouer, par ordre d'importance :
//
//   1. LA RÈGLE DE MRR. §4.3 la donne en une phrase — « essai, impayé, suspendu, Starter
//      ⇒ 0 » — et c'est la seule ligne de la console qui produise un CHIFFRE FAUX plutôt
//      qu'un écran vide quand elle se trompe. Elle est éprouvée exhaustivement, branche par
//      branche, sur la fonction pure qui la porte.
//   2. LES PRIX DE DÉMONSTRATION. La maquette porte PLN_PRICE (390/1190/2340/4600), que
//      §5.7 proscrit nommément au profit du catalogue C2 (0/89/249). Un test qui vérifie
//      « le MRR est un nombre » laisserait passer les prix de démo ; celui-ci les nomme.
//   3. LA NON-FUITE. Aucune de ces six fonctions ne doit répondre à un JWT agent, et la
//      fiche agence ne doit porter ni jeton d'invitation, ni identifiant Stripe, ni donnée
//      de client final (§5.3 : « JAMAIS : contacts, leads, dossiers KYC »).
//
// ⚠ CLIENT CHOISI D'APRÈS LA GARDE. Les six gardes sont `is_super_admin() OR
// is_service_role()`, sans branche `session_user` : elles ne s'éprouvent donc PAS depuis
// psql, où session_user vaut toujours `postgres`. Tous les appels passent par
// serviceRoleClient() ou par un client authentifié. `execSql` ne sert ici qu'à SEMER.
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

/** Catalogue C2 (src/lib/plans.ts), miroir d'app_config.plan_pricing semé en 20260726003000. */
const C2 = { pro_monthly: 89, pro_yearly: 71, entreprise_monthly: 249, starter_monthly: 0 }
/** Prix de DÉMONSTRATION de la maquette (PLN_PRICE) — aucun ne doit jamais sortir de la base. */
const PRIX_DE_DEMO = [390, 1190, 2340, 4600]

const runSql = (body: string) => execSql(`do $$\n${body}\nend $$;`)

type Row = Record<string, unknown>

describe.skipIf(!HAS_KEYS)('vues de lecture de la console (étape 9)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []
  /** Identifiant Stripe reconnaissable : sa PRÉSENCE dans une réponse est la fuite. */
  const STRIPE_CUS = `cus_ne_doit_jamais_sortir_${Date.now()}`

  /** Applique la règle de MRR à des arguments nus, sans toucher à la moindre table. */
  const rule = async (
    plan: string | null, period: string | null, subStatus: string | null, agencyStatus: string
  ): Promise<number> => {
    const { data, error } = await serviceRoleClient().rpc('agency_mrr_rule', {
      p_plan: plan, p_billing_period: period, p_sub_status: subStatus,
      p_agency_status: agencyStatus,
      p_pricing: { starter: { monthly: 0, yearly: 0 }, pro: { monthly: 89, yearly: 71 },
                   entreprise: { monthly: 249, yearly: 199 } },
    })
    if (error) throw new Error(`agency_mrr_rule: ${error.message}`)
    return Number(data)
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    const email = `views-super-${setup.stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super Views ${setup.stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: data.user!.id, email, full_name: `Super Views ${setup.stamp}`, role: 'super_admin', agency_id: null },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`profile: ${pErr.message}`)
    superClient = anonClient()
    const { error: sErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin: ${sErr.message}`)

    // Agence A : abonnement Pro mensuel actif → 89 attendus de bout en bout.
    // Agence B : aucun abonnement → 0, et c'est le cas le plus fréquent en production
    // (la table `subscriptions` y est vide).
    //
    // ⚠ `stripe_customer_id` est NOT NULL SANS défaut : l'omettre fait échouer l'insert,
    // donc le beforeAll, donc toute la suite — qui se lirait « N ignorés ». La valeur est
    // rendue reconnaissable à dessein : le test de non-fuite cherche la VALEUR, pas
    // seulement le nom de colonne.
    const { error: subErr } = await svc.from('subscriptions').insert({
      agency_id: setup.agencyAId, plan: 'pro', billing_period: 'monthly', status: 'active',
      stripe_customer_id: STRIPE_CUS,
    })
    if (subErr) throw new Error(`subscription: ${subErr.message}`)

    // Un événement ANCIEN pour l'agent A : c'est lui qui donne un `stale_days` mesurable.
    // Semé en psql : activity_events refuse l'UPDATE comme le DELETE (append-only), on ne
    // pourra donc pas le retoucher ensuite — d'où une date posée juste une fois.
    // ⚠ `category` est sous CHECK : kyc|deal|contact|bien|doc|auth|settings|ai. La maquette
    // du Live parle de « contacts » au pluriel — la base veut le SINGULIER, et un insert
    // invalide ici ferait échouer le beforeAll, donc SKIPPER toute la suite : « N ignorés »
    // au lieu de « N échecs ».
    runSql(`begin
      insert into public.activity_events (agency_id, actor_id, action, entity_type, category, created_at)
        values ('${setup.agencyAId}'::uuid, '${setup.agentAId}'::uuid, 'contact_created',
                'contact', 'contact', now() - interval '45 days');
      insert into public.team_invitations (agency_id, email, role, status, expires_at, invited_by)
        values ('${setup.agencyBId}'::uuid, 'agent-b-${setup.stamp}@megga-test.local',
                'agent', 'pending', now() + interval '7 days', '${setup.agentAId}'::uuid);`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (setup) {
      await svc.from('subscriptions').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
      await svc.from('team_invitations').delete().eq('agency_id', setup.agencyBId).then(() => {}, () => {})
      await setup.cleanup()
    }
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 1. La règle de MRR, branche par branche ────────────────────────────────────

  it('LA RÈGLE — essai, impayé et agence suspendue comptent zéro', async () => {
    expect(await rule('pro', 'monthly', 'active', 'active'), 'actif = le prix du plan').toBe(C2.pro_monthly)
    expect(await rule('pro', 'monthly', 'trialing', 'active'), 'un essai ne rapporte rien').toBe(0)
    expect(await rule('pro', 'monthly', 'past_due', 'active'), 'un impayé ne rapporte rien').toBe(0)
    expect(await rule('pro', 'monthly', 'canceled', 'active'), 'un abonnement résilié ne rapporte rien').toBe(0)
    expect(await rule('pro', 'monthly', 'unpaid', 'active'), 'un abonnement impayé ne rapporte rien').toBe(0)
    expect(await rule('pro', 'monthly', 'incomplete', 'active'), 'un abonnement incomplet ne rapporte rien').toBe(0)
    // Le cas qui distingue vraiment cette règle : abonnement PARFAITEMENT actif, mais
    // agence suspendue. Facturer une agence à qui on a coupé l'accès serait le pire des
    // deux mondes, et c'est l'oubli le plus facile.
    expect(await rule('pro', 'monthly', 'active', 'suspended'), 'agence suspendue = zéro malgré un abonnement actif').toBe(0)
  })

  it('LA RÈGLE — Starter tombe à zéro par son PRIX, jamais par une mention en dur', async () => {
    expect(await rule('starter', 'monthly', 'active', 'active')).toBe(C2.starter_monthly)
    // La preuve que ce zéro vient du catalogue et non d'un `if plan = starter` : en
    // donnant un prix à Starter, le MRR doit suivre. Un test qui se contenterait de
    // `toBe(0)` resterait vert sur une règle qui code le nom du plan en dur — et le jour
    // où Starter devient payant, le revenu disparaîtrait en silence.
    const { data } = await serviceRoleClient().rpc('agency_mrr_rule', {
      p_plan: 'starter', p_billing_period: 'monthly', p_sub_status: 'active',
      p_agency_status: 'active', p_pricing: { starter: { monthly: 42, yearly: 42 } },
    })
    expect(Number(data), 'Starter payant doit rapporter — sinon son nom est codé en dur').toBe(42)
  })

  it('LA RÈGLE — la facturation annuelle prend le prix annuel', async () => {
    expect(await rule('pro', 'yearly', 'active', 'active')).toBe(C2.pro_yearly)
    expect(await rule('entreprise', 'monthly', 'active', 'active')).toBe(C2.entreprise_monthly)
    // Période inconnue ou nulle : on retombe sur le mensuel plutôt que sur NULL. Un NULL
    // ici se propagerait en « CHF —  » sur toute la colonne du registre.
    expect(await rule('pro', null, 'active', 'active')).toBe(C2.pro_monthly)
  })

  it('LA RÈGLE — un plan absent du catalogue vaut zéro, pas NULL', async () => {
    // `agencies.plan` porte un enum à QUATRE valeurs (starter|pro|agency|enterprise) dont
    // deux n'ont aucun prix — décision PO n° 3, ouverte. Le MRR lit `subscriptions`, dont
    // le CHECK coïncide avec le catalogue, mais la règle doit tenir même si un jour on lui
    // passe l'autre vocabulaire.
    expect(await rule('agency', 'monthly', 'active', 'active')).toBe(0)
    expect(await rule('enterprise', 'monthly', 'active', 'active')).toBe(0)
    expect(await rule(null, 'monthly', 'active', 'active'), 'aucun plan = zéro').toBe(0)
  })

  it('agency_mrr() câble la règle sur les vraies tables', async () => {
    const svc = serviceRoleClient()
    const { data: a, error } = await svc.rpc('agency_mrr', { p_agency_id: setup.agencyAId })
    expect(error).toBeNull()
    expect(Number(a), 'agence A : Pro mensuel actif').toBe(C2.pro_monthly)

    const { data: b } = await svc.rpc('agency_mrr', { p_agency_id: setup.agencyBId })
    expect(Number(b), 'agence B : aucun abonnement').toBe(0)

    const { data: inconnue } = await svc.rpc('agency_mrr', {
      p_agency_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(Number(inconnue), 'agence inconnue = 0, jamais NULL').toBe(0)
  })

  // ── 2. Le registre des agences ─────────────────────────────────────────────────

  it('get_admin_agencies() sert les colonnes de la maquette en un seul appel', async () => {
    const { data, error } = await serviceRoleClient().rpc('get_admin_agencies', {
      p_agency_id: setup.agencyAId,
    })
    expect(error).toBeNull()
    const rows = data as Row[]
    expect(rows.length, 'le filtre par agence rend une ligne').toBe(1)
    const r = rows[0]

    // Les seize colonnes d'ADMIN_AGENCIES, plus les quatre que l'écran RÉEL affiche
    // (étape 15 : slug, logo, téléphone, échéance). Les nommer une par une plutôt que
    // compter : une colonne renommée casserait l'écran sans changer le total.
    for (const k of ['id', 'name', 'email', 'city', 'canton', 'plan', 'agents', 'properties',
                     'deals', 'mrr', 'status', 'sub', 'score', 'since', 'last', 'verification_status',
                     'slug', 'logo_url', 'phone', 'current_period_end']) {
      expect(Object.keys(r), `colonne « ${k} » attendue par l'écran`).toContain(k)
    }
    expect(Number(r.mrr), 'le MRR de la ligne = celui d\'agency_mrr()').toBe(C2.pro_monthly)
    expect(r.sub, 'le statut d\'abonnement vient du miroir').toBe('active')
    expect(Number(r.agents), 'un agent dans l\'agence A').toBeGreaterThanOrEqual(1)
    expect(r.last, 'l\'agence a une activité (l\'événement semé)').not.toBeNull()
  })

  it('AUCUN prix de démonstration ne sort de la base', async () => {
    // §5.7 : « plus jamais en dur dans la console, plus jamais les prix de démo ».
    // La maquette porte 390 / 1190 / 2340 / 4600 ; le catalogue dit 0 / 89 / 249.
    const { data } = await serviceRoleClient().rpc('get_admin_agencies', {})
    for (const r of (data as Row[])) {
      expect(PRIX_DE_DEMO, `l'agence « ${r.name} » sort un prix de démonstration`)
        .not.toContain(Number(r.mrr))
    }
  })

  it('le registre est borné, même si on lui demande tout', async () => {
    const { data } = await serviceRoleClient().rpc('get_admin_agencies', { p_limit: 1_000_000 })
    expect((data as unknown[]).length, 'plafond à 2000').toBeLessThanOrEqual(2000)
  })

  // ── 3. La fiche agence ─────────────────────────────────────────────────────────

  it('get_admin_agency_detail() assemble la fiche en un objet', async () => {
    const { data, error } = await serviceRoleClient().rpc('get_admin_agency_detail', {
      p_agency_id: setup.agencyAId,
    })
    expect(error).toBeNull()
    const d = data as Row
    expect(d.found).toBe(true)
    expect((d.agency as Row).id).toBe(setup.agencyAId)
    expect(Array.isArray(d.team), 'l\'équipe est une liste').toBe(true)
    expect((d.team as Row[]).length, 'l\'agent A est dans l\'équipe').toBeGreaterThanOrEqual(1)
    expect(d.usage, 'l\'usage consolidé est embarqué (get_admin_agency_usage)').toBeTruthy()
    expect((d.subscription as Row).plan).toBe('pro')
  })

  it('une agence inconnue rend un verdict, pas un objet vide', async () => {
    // La fiche doit distinguer « agence inconnue » de « agence sans équipe » : les deux
    // s'afficheraient identiquement si la réponse était `{}`.
    const { data } = await serviceRoleClient().rpc('get_admin_agency_detail', {
      p_agency_id: '00000000-0000-0000-0000-000000000000',
    })
    expect((data as Row).found).toBe(false)
  })

  it('LA NON-FUITE — ni jeton d\'invitation, ni identifiant Stripe, ni client final', async () => {
    const { data } = await serviceRoleClient().rpc('get_admin_agency_detail', {
      p_agency_id: setup.agencyAId,
    })
    const brut = JSON.stringify(data).toLowerCase()

    // Le jeton d'invitation est un secret de porteur : le rendre, c'est permettre de
    // rejoindre l'agence depuis la console.
    expect(brut, 'aucun jeton d\'invitation dans la fiche').not.toContain('"token"')
    // §5.7 : la console constate le paiement, elle ne le manipule pas. On cherche le nom de
    // colonne ET la valeur : une projection qui renommerait la colonne en « customer »
    // passerait le premier contrôle tout en fuyant l'identifiant.
    for (const k of ['stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id']) {
      expect(brut, `« ${k} » n'a rien à faire dans la fiche agence`).not.toContain(k)
    }
    expect(brut, 'l\'identifiant client Stripe a fuité sous un autre nom')
      .not.toContain(STRIPE_CUS.toLowerCase())
    // §5.3 : « JAMAIS : contacts, leads, dossiers KYC clients finaux ». La fiche parle de
    // l'agence cliente, pas des clients de l'agence.
    for (const k of ['kyc_case', 'contact_id', 'lead_id', 'risk_level']) {
      expect(brut, `« ${k} » est une donnée de client final`).not.toContain(k)
    }
  })

  // ── 4. Le registre des comptes ─────────────────────────────────────────────────

  it('get_admin_users() rend l\'ancienneté d\'inactivité et les consentements', async () => {
    const { data, error } = await serviceRoleClient().rpc('get_admin_users', { p_limit: 2000 })
    expect(error).toBeNull()
    const rows = data as Row[]
    const a = rows.find((r) => r.id === setup.agentAId)
    expect(a, 'l\'agent A est au registre').toBeTruthy()
    expect(a!.agency, 'le nom de l\'agence est joint').toContain('Agency A')
    expect(Array.isArray(a!.consents), 'les consentements sont une liste, même vide').toBe(true)
    // `avatar_url` est servie ici (étape 15) pour que le registre n'ait pas à relire
    // `profiles` une seconde fois juste pour une vignette.
    expect(Object.keys(a!), 'la vignette est servie par la RPC').toContain('avatar_url')

    // `stale_days` est éprouvé comme DÉRIVÉE de `last`, jamais contre une valeur attendue.
    // Première version de ce test : semer un événement de 45 jours et attendre 45. Faux —
    // `last` est un MAXIMUM, et se connecter écrit un événement de catégorie `auth`. Le
    // simple fait que le harnais authentifie l'agent rendait son activité fraîche. La
    // fonction avait raison ; l'assertion avait tort. Une connexion EST une activité, et
    // c'est précisément ce que la colonne « Dernière activité » de la maquette affiche.
    //
    // Reformulé sur le contrat, le test attrape ce qu'il doit attraper : une unité fausse
    // (heures prises pour des jours), un signe inversé, un décalage d'ordre de grandeur.
    // Tolérance d'UN jour, et pas moins : `now()` est l'horloge de la base, `Date.now()`
    // celle du runner, et un franchissement de minuit entre les deux décalerait le plancher
    // d'une unité. Une tolérance plus large ne prouverait plus rien sur l'unité.
    for (const r of rows) {
      if (r.last === null) continue
      const attendu = Math.floor((Date.now() - new Date(r.last as string).getTime()) / 86_400_000)
      const mesure = Number(r.stale_days)
      expect(mesure, `stale_days (${mesure}) incohérent avec last sur ${r.email}`)
        .toBeGreaterThanOrEqual(attendu - 1)
      expect(mesure, `stale_days (${mesure}) incohérent avec last sur ${r.email}`)
        .toBeLessThanOrEqual(attendu + 1)
    }
  })

  it('« jamais connecté » vaut exactement « invité ET aucune activité »', async () => {
    // Le drapeau est asserté comme INVARIANT sur toutes les lignes plutôt que sur une
    // valeur attendue : une seule ligne testée en dur deviendrait fausse dès qu'un autre
    // test du dépôt émettrait un événement pour ce compte.
    const { data } = await serviceRoleClient().rpc('get_admin_users', { p_limit: 2000 })
    for (const r of (data as Row[])) {
      expect(r.never, `« never » incohérent sur ${r.email}`)
        .toBe(r.invited_at !== null && r.last === null)
      expect(r.stale_days === null, `« stale_days » doit être NULL sans activité (${r.email})`)
        .toBe(r.last === null)
    }
    // L'invitation semée sur l'agent B est bien vue par le registre (§5.4, C3).
    const b = (data as Row[]).find((r) => r.id === setup.agentBId)
    expect(b?.invited_at, 'l\'invitation en attente de l\'agent B est vue').not.toBeNull()
  })

  it('un compte supprimé reste au registre — sinon la Vue d\'ensemble se contredit', async () => {
    // Critère de sortie du gate G1 : « compteurs Vue d'ensemble = sommes des tables, zéro
    // contradiction ». get_admin_dashboard_stats().total_users compte `profiles` SANS
    // filtre ; masquer les supprimés ici ferait diverger les deux écrans.
    //
    // Éprouvé en supprimant VRAIMENT un compte, plutôt qu'en comparant les deux compteurs :
    // cette suite tourne en parallèle d'autres specs qui créent des comptes, et une égalité
    // entre deux appels successifs serait un flake, pas une preuve. Ici il n'y a pas de
    // course : on connaît la ligne qu'on vient de marquer.
    const svc = serviceRoleClient()
    const { error: delErr } = await svc.from('profiles')
      .update({ deleted_at: new Date().toISOString() }).eq('id', setup.agentBId)
    if (delErr) throw new Error(`soft delete: ${delErr.message}`)

    try {
      const { data } = await svc.rpc('get_admin_users', { p_limit: 2000 })
      const b = (data as Row[]).find((r) => r.id === setup.agentBId)
      expect(b, 'un compte supprimé DOIT rester au registre').toBeTruthy()
      expect(b!.deleted_at, 'sa date de suppression est exposée, pour que l\'écran filtre')
        .not.toBeNull()

      // Le pendant : le REGISTRE des agences, lui, ne compte pas les sièges supprimés.
      // Les deux sont volontairement différents — l'un réconcilie un total, l'autre
      // mesure une équipe réelle.
      const { data: ag } = await svc.rpc('get_admin_agencies', { p_agency_id: setup.agencyBId })
      expect(Number((ag as Row[])[0].agents), 'un compte supprimé n\'occupe plus de siège').toBe(0)
    } finally {
      await svc.from('profiles').update({ deleted_at: null }).eq('id', setup.agentBId)
    }
  })

  it('get_admin_user_activity() rend des CLÉS techniques, jamais du français', async () => {
    const { data, error } = await serviceRoleClient().rpc('get_admin_user_activity', {
      p_user_id: setup.agentAId,
    })
    expect(error).toBeNull()
    const rows = data as Row[]
    expect(rows.length, 'l\'événement semé remonte').toBeGreaterThanOrEqual(1)
    // La base ne stocke pas de FR (20260729100000 fait foi) : la traduction est le mapping
    // i18n `audit.action.*` côté écran. Une action en clair ici signifierait que quelqu'un
    // a écrit du libellé en base.
    for (const r of rows) {
      expect(String(r.action), `action « ${r.action} » : clé technique snake_case attendue`)
        .toMatch(/^[a-z0-9_]+$/)
    }
    const { data: borne } = await serviceRoleClient().rpc('get_admin_user_activity', {
      p_user_id: setup.agentAId, p_limit: 1_000_000,
    })
    expect((borne as unknown[]).length, 'plafond à 200').toBeLessThanOrEqual(200)
  })

  // ── 5. Le poste de triage des abonnements ──────────────────────────────────────

  it('get_admin_plans_board() somme le MRR réel et nomme ce qui manque', async () => {
    const { data, error } = await serviceRoleClient().rpc('get_admin_plans_board')
    expect(error).toBeNull()
    const b = data as Row
    expect(Number(b.mrr), 'l\'agence A pèse dans le MRR de la plateforme')
      .toBeGreaterThanOrEqual(C2.pro_monthly)
    expect(Number(b.subscriptions), 'au moins un abonnement actif').toBeGreaterThanOrEqual(1)
    expect(Array.isArray(b.portfolio)).toBe(true)

    // L'amendement de spec, en test : trois chiffres de la maquette n'ont AUCUNE source
    // (le dépôt ne garde aucun historique de MRR) et la file des sièges attend la décision
    // PO n° 4. Ils sont NOMMÉS plutôt que tus — un champ absent se lit « bug », un champ
    // qui se nomme se lit « pas encore ». Si quelqu'un les implémente, ce test le lui
    // rappelle ici.
    expect(b.unavailable, 'ce qui manque doit rester déclaré')
      .toEqual(expect.arrayContaining(['mrr_trend', 'revenue_30d', 'churn', 'seats_saturated']))

    // Les sièges sont mesurés même si la file ne l'est pas : le jour de l'arbitrage,
    // il n'y aura rien à re-mesurer.
    const a = (b.portfolio as Row[]).find((r) => r.id === setup.agencyAId)
    expect(a, 'l\'agence A est au portefeuille').toBeTruthy()
    expect(Number(a!.seats_used), 'les sièges occupés sont comptés').toBeGreaterThanOrEqual(1)
    expect(a!.state, 'Pro actif → état actif').toBe('active')
  })

  it('l\'ARPU se divise par les abonnements comptés, pas par les agences', async () => {
    // Diviser par l'ensemble des agences ferait BAISSER le revenu moyen à chaque essai
    // ouvert — un indicateur qui empire quand l'acquisition marche.
    const { data } = await serviceRoleClient().rpc('get_admin_plans_board')
    const b = data as Row
    const n = Number(b.subscriptions)
    if (n > 0) {
      expect(Number(b.arpu)).toBeCloseTo(Number(b.mrr) / n, 1)
    } else {
      expect(Number(b.arpu), 'aucun abonnement : zéro, jamais une division par zéro').toBe(0)
    }
  })

  // ── 6. La porte ────────────────────────────────────────────────────────────────

  it('LA NON-FUITE — un JWT agent est refusé sur les six fonctions', async () => {
    // Comportemental, avec un VRAI jeton d'agent : c'est la position exacte d'un client
    // d'agence qui appellerait la console. Une garde présente dans le source n'est pas une
    // garde qui refuse.
    const appels: Array<[string, Record<string, unknown>]> = [
      ['agency_mrr', { p_agency_id: setup.agencyAId }],
      ['get_admin_agencies', {}],
      ['get_admin_agency_detail', { p_agency_id: setup.agencyAId }],
      ['get_admin_users', {}],
      ['get_admin_user_activity', { p_user_id: setup.agentAId }],
      ['get_admin_plans_board', {}],
    ]
    for (const [fn, args] of appels) {
      const { error } = await setup.clientA.rpc(fn, args)
      expect(error?.code, `${fn} doit refuser un JWT agent`).toBe(DENIED)
    }
  })

  it('un super-admin allowlisté, lui, passe partout', async () => {
    // Le pendant du test précédent : une garde qui refuse TOUT le monde serait verte
    // au-dessus et inutile en production.
    for (const [fn, args] of [
      ['get_admin_agencies', {}],
      ['get_admin_users', {}],
      ['get_admin_plans_board', {}],
    ] as Array<[string, Record<string, unknown>]>) {
      const { error } = await superClient.rpc(fn, args)
      expect(error, `${fn} doit répondre à un super-admin`).toBeNull()
    }
  })
})
