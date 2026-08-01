// Backend integration spec (live CI) — les deux défauts trouvés en revue du Lot 1
// (migration 20260801100000).
//
// Ces deux tests N'EXISTAIENT PAS quand le code est parti en production, et c'est la seule
// raison pour laquelle les défauts ont survécu : les specs du Lot 1 vérifiaient que les
// fonctions RÉPONDENT et que leurs totaux s'accordent — jamais que les nombres affichés
// côte à côte portaient sur la même population, ni que le journal rendait bien ce qu'on lui
// demandait.
//
// ⚠ CE QUE LA REVUE A AUSSI MONTRÉ : sur les données de production (9 agences, ZÉRO
// abonnement), les contrôles de cohérence du MRR comparent 0 à 0. Ils passaient donc sans
// rien prouver. Les tests ci-dessous SÈMENT leurs propres cas — c'est la seule façon
// d'exercer une règle que la base réelle ne déclenche jamais.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const runSql = (body: string) => execSql(`do $$\n${body}\nend $$;`)

type Row = Record<string, unknown>

describe.skipIf(!HAS_KEYS)('revue du Lot 1 — correctifs (01.08)', () => {
  let setup: TwoAgenciesSetup
  let stamp = ''

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    stamp = setup.stamp
    const svc = serviceRoleClient()

    // Agence A : Pro, abonnement ACTIF → elle paie.
    // Agence B : Pro aussi, mais en ESSAI → elle ne paie pas.
    // C'est le cas que la production ne contient pas (zéro abonnement) et que l'ancien
    // code affichait « Pro · 2 · <le MRR d'une seule> ».
    // ⚠ stripe_customer_id est NOT NULL SANS défaut : l'omettre ferait échouer le beforeAll,
    // donc SKIPPER la suite — « N ignorés », pas « N échecs ».
    const { error } = await svc.from('subscriptions').insert([
      { agency_id: setup.agencyAId, plan: 'pro', billing_period: 'monthly',
        status: 'active', stripe_customer_id: `cus_revue_a_${stamp}` },
      { agency_id: setup.agencyBId, plan: 'pro', billing_period: 'monthly',
        status: 'trialing', stripe_customer_id: `cus_revue_b_${stamp}` },
    ])
    if (error) throw new Error(`abonnements: ${error.message}`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (setup) {
      await svc.from('subscriptions').delete()
        .in('agency_id', [setup.agencyAId, setup.agencyBId]).then(() => {}, () => {})
      await setup.cleanup()
    }
  })

  // ── Défaut 1 : count et mrr sur deux populations ───────────────────────────────

  it('LE COMPTE ET LE MRR portent sur la MÊME population', async () => {
    // Avant le correctif : `count` incluait l'agence en essai, `mrr` l'excluait — donc
    // « Pro · 2 · CHF 89 ». Un lecteur divise et conclut que Pro vaut 44,50 CHF.
    const { data, error } = await serviceRoleClient().rpc('get_admin_plans_board')
    expect(error).toBeNull()
    const b = data as Row
    const pro = (b.plans as Row[]).find((p) => p.plan === 'pro')
    expect(pro, 'le plan Pro doit apparaître : une agence active y est abonnée').toBeTruthy()

    // Les deux agences sont en Pro, une seule paie. Le compte doit dire UNE.
    expect(Number(pro!.count), 'l\'agence en ESSAI ne doit pas gonfler le compte').toBe(1)
    expect(Number(pro!.mrr), 'et le MRR reste celui de l\'agence qui paie').toBe(89)

    // L'invariant qui vaut pour tous les plans, et qui aurait attrapé le défaut sans
    // connaître les valeurs : un plan dont le compte est non nul doit avoir un MRR
    // cohérent avec lui — jamais un compte sans revenu.
    for (const p of (b.plans as Row[])) {
      if (Number(p.count) > 0 && p.plan !== 'starter') {
        expect(Number(p.mrr), `« ${p.plan} » : ${p.count} agence(s) comptée(s) pour ${p.mrr} de MRR`)
          .toBeGreaterThan(0)
      }
    }
  })

  it('l\'agence en essai reste VISIBLE au portefeuille et dans sa file', async () => {
    // Le correctif ne doit pas la faire disparaître : elle n'a simplement plus à gonfler
    // un compte adossé à un revenu qui l'exclut.
    const { data } = await serviceRoleClient().rpc('get_admin_plans_board')
    const b = data as Row
    const auPortefeuille = (b.portfolio as Row[]).some((p) => p.id === setup.agencyBId)
    expect(auPortefeuille, 'le portefeuille montre tout le monde').toBe(true)

    const dansLesEssais = ((b.queues as Row).trials as Row[]).some((p) => p.id === setup.agencyBId)
    expect(dansLesEssais, 'et la file des essais la porte').toBe(true)
  })

  // ── Défaut 2 : le journal filtrait après la limite ─────────────────────────────

  it('LE JOURNAL rend bien 40 lignes même quand le KYC en occupe la tête', async () => {
    // Avant le correctif : get_admin_live_feed(40) puis retrait du KYC → le journal
    // rendait 40 moins le nombre de KYC, silencieusement. On sème donc 45 événements KYC
    // TRÈS récents : ils occupent toute la tête du flux, et l'ancien code aurait rendu
    // un journal VIDE.
    const lignes = Array.from({ length: 45 }, (_, i) =>
      `('${setup.agencyAId}'::uuid, 'kyc_validated', 'contact', 'kyc', 'revue-kyc-${stamp}-${i}')`)
    runSql(`begin
      insert into public.activity_events (agency_id, action, entity_type, category, object_label)
      values ${lignes.join(',')};`)

    const { data, error } = await serviceRoleClient().rpc('admin_overview')
    expect(error).toBeNull()
    const journal = ((data as Row).journal) as Row[]

    // ⚠ Ne PAS affirmer « 40 » en dur : la base de CI n'en contient pas forcément autant,
    // et le test échouerait pour une raison qui n'est pas celle qu'il éprouve. On mesure
    // ce qui est disponible et on attend exactement ce qui devrait sortir.
    const { count: dispo } = await serviceRoleClient()
      .from('activity_events')
      .select('id', { count: 'estimated', head: true })
      .not('category', 'eq', 'kyc')
    const attendu = Math.min(40, Math.max(0, dispo ?? 0))

    expect(journal.length, `45 KYC en tête ne doivent pas raccourcir le journal (${dispo} non-KYC disponibles)`)
      .toBe(attendu)
    // Le cœur du défaut, indépendamment du volume : l'ancien code rendait au plus
    // 40 − (KYC en tête), donc ZÉRO avec 45 KYC. Toute valeur non nulle prouve la
    // sur-récupération.
    expect(journal.length, 'l\'ancien code aurait rendu un journal vide').toBeGreaterThan(0)

    // Et aucun KYC ne doit s'y trouver : c'est l'autre moitié du contrat (§5.1).
    for (const l of journal) {
      expect(l.category, 'la conformité d\'un client final n\'a rien à faire ici').not.toBe('kyc')
    }
  })

  it('le journal reste trié du plus récent au plus ancien', async () => {
    // La sur-récupération introduit un tri de plus : il ne doit pas dérégler l'ordre.
    const { data } = await serviceRoleClient().rpc('admin_overview')
    const journal = ((data as Row).journal) as Row[]
    for (let i = 1; i < journal.length; i++) {
      const avant = new Date(journal[i - 1].ts as string).getTime()
      const apres = new Date(journal[i].ts as string).getTime()
      expect(avant, `ligne ${i} : le journal doit rester décroissant`).toBeGreaterThanOrEqual(apres)
    }
  })
})
