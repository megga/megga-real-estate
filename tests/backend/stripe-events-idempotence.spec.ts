// Idempotence et ordre des événements Stripe (migration 20260804132741).
//
// Régression du §4.4 de l'audit des signatures de webhooks du 03.08.2026. Deux
// défauts distincts, tous deux en AVAL d'une vérification de signature qui,
// elle, était correcte :
//
//   1. aucun registre d'événements traités → chaque rejeu Stripe réinsérait les
//      `activity_events` déjà écrits avant l'échec, et le `catch` de la fonction
//      rend 500, donc le rejeu est le comportement NOMINAL en cas d'échec ;
//   2. aucune garde d'ordre → un `customer.subscription.updated` livré après un
//      `customer.subscription.deleted` réactivait un abonnement résilié.
//
// Ce fichier teste les DEUX garanties au niveau où l'edge function les consomme :
// PostgREST. La garde d'ordre en particulier est portée par un filtre `or=(...)`
// dont la syntaxe est fragile (un horodatage ISO contient des points, que
// PostgREST utilise comme séparateurs) — la tester ici, c'est tester ce que la
// fonction exécute réellement, pas une reformulation en SQL.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const AGENCY = '2b1e7c40-0000-4000-8000-00000000e44a'
const SLUG = 'spec-stripe-ordre-e44a'
const T_OLD = '2026-08-04T10:00:00+00:00'
const T_MID = '2026-08-04T12:00:00+00:00'
const T_NEW = '2026-08-04T14:00:00+00:00'

/** Le filtre exact que `applySubscriptionState` construit dans l'edge function. */
const orderGuard = (eventAt: string) =>
  `last_stripe_event_at.is.null,last_stripe_event_at.lte."${eventAt}"`

describe.skipIf(!HAS_KEYS)('stripe_events — idempotence', () => {
  const svc = () => serviceRoleClient()
  const eventId = `evt_spec_${Date.now()}`

  afterAll(async () => {
    await svc().from('stripe_events').delete().like('event_id', 'evt_spec_%')
  })

  it('le même event_id ne peut pas être réservé deux fois', async () => {
    const row = { event_id: eventId, event_type: 'invoice.paid', event_created: T_MID }

    const first = await svc().from('stripe_events')
      .upsert(row, { onConflict: 'event_id', ignoreDuplicates: true }).select('event_id')
    expect(first.error).toBeNull()
    expect(first.data ?? []).toHaveLength(1)

    // Exactement le motif de l'edge function : un tableau VIDE signifie « déjà
    // traité », et la fonction acquitte alors sans retraiter.
    const second = await svc().from('stripe_events')
      .upsert(row, { onConflict: 'event_id', ignoreDuplicates: true }).select('event_id')
    expect(second.error).toBeNull()
    expect(second.data ?? []).toHaveLength(0)
  })

  it('la réservation est LIBÉRABLE — sinon un échec deviendrait une perte définitive', async () => {
    // Le `catch` supprime la ligne pour que le rejeu Stripe puisse retraiter.
    const id = `evt_spec_release_${Date.now()}`
    await svc().from('stripe_events')
      .upsert({ event_id: id, event_type: 'invoice.paid', event_created: T_MID },
        { onConflict: 'event_id', ignoreDuplicates: true }).select('event_id')

    await svc().from('stripe_events').delete().eq('event_id', id)

    const retry = await svc().from('stripe_events')
      .upsert({ event_id: id, event_type: 'invoice.paid', event_created: T_MID },
        { onConflict: 'event_id', ignoreDuplicates: true }).select('event_id')
    expect(retry.data ?? []).toHaveLength(1)
  })

  it('anon ne peut ni lire ni écrire le registre', async () => {
    const { error: readErr, data } = await anonClient()
      .from('stripe_events').select('event_id').limit(1)
    if (!readErr) expect(data ?? []).toHaveLength(0)
    else expect(readErr).toBeTruthy()

    const { error: writeErr } = await anonClient().from('stripe_events')
      .insert({ event_id: 'evt_spec_anon', event_type: 'x', event_created: T_MID })
    expect(writeErr).toBeTruthy()
  })

  it('anon et authenticated n’ont aucun privilège de table — assertion de catalogue', () => {
    // Assertion directe sur les GRANTS, pas sur la capacité : une tentative
    // réelle échoue aussi bien par RLS que par privilège, et ne dirait donc pas
    // lequel des deux verrous tient.
    for (const role of ['anon', 'authenticated']) {
      expect(() =>
        execSql(`
          do $$
          begin
            if exists (
              select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'stripe_events'
                and grantee = '${role}'
            ) then
              raise exception '${role} garde un privilège sur stripe_events';
            end if;
          end $$;
        `),
      ).not.toThrow()
    }
  })
})

describe.skipIf(!HAS_KEYS)('subscriptions — garde d’ordre Stripe', () => {
  const svc = () => serviceRoleClient()

  beforeAll(async () => {
    await svc().from('agencies').upsert({ id: AGENCY, name: 'Spec Ordre Stripe', slug: SLUG })
    await svc().from('subscriptions').upsert({
      agency_id: AGENCY, stripe_customer_id: 'cus_spec_e44a',
      plan: 'pro', status: 'active', last_stripe_event_at: T_MID,
    }, { onConflict: 'agency_id' })
  })

  afterAll(async () => {
    await svc().from('subscriptions').delete().eq('agency_id', AGENCY)
    await svc().from('agencies').delete().eq('id', AGENCY)
  })

  it('un événement PLUS ANCIEN ne modifie rien — le cœur du §4.4', async () => {
    // Le scénario réel : `subscription.deleted` a résilié à T_MID, puis Stripe
    // rejoue un `subscription.updated` daté de T_OLD. Sans garde, l'abonnement
    // résilié redevient actif et récupère son mrr_chf.
    const { data, error } = await svc().from('subscriptions')
      .update({ status: 'active', mrr_chf: 99, last_stripe_event_at: T_OLD })
      .eq('agency_id', AGENCY)
      .or(orderGuard(T_OLD))
      .select('agency_id')

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)

    const { data: after } = await svc().from('subscriptions')
      .select('status, last_stripe_event_at').eq('agency_id', AGENCY).single()
    expect(after?.status).toBe('active')
    expect(new Date(after!.last_stripe_event_at as string).toISOString())
      .toBe(new Date(T_MID).toISOString())
  })

  it('un événement PLUS RÉCENT s’applique — contrôle positif', () => {
    // Sans ce contrôle, le test ci-dessus passerait tout aussi bien si le filtre
    // était malformé et ne matchait JAMAIS rien.
    return svc().from('subscriptions')
      .update({ status: 'canceled', last_stripe_event_at: T_NEW })
      .eq('agency_id', AGENCY)
      .or(orderGuard(T_NEW))
      .select('agency_id')
      .then(({ data, error }) => {
        expect(error).toBeNull()
        expect(data ?? []).toHaveLength(1)
      })
  })

  it('une ligne sans marqueur (antérieure au correctif) accepte le premier événement', async () => {
    await svc().from('subscriptions')
      .update({ last_stripe_event_at: null }).eq('agency_id', AGENCY)

    const { data, error } = await svc().from('subscriptions')
      .update({ status: 'active', last_stripe_event_at: T_OLD })
      .eq('agency_id', AGENCY)
      .or(orderGuard(T_OLD))
      .select('agency_id')

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  it('le filtre survit à un horodatage ISO avec millisecondes', async () => {
    // PostgREST découpe `or=(col.op.valeur)` sur les points : un horodatage
    // `…:00.000Z` en contient. C'est le guillemetage qui le sauve, et c'est la
    // forme que `new Date().toISOString()` produit dans l'edge function.
    const withMs = new Date(T_NEW).toISOString() // 2026-08-04T14:00:00.000Z
    expect(withMs).toContain('.')

    const { error } = await svc().from('subscriptions')
      .update({ last_stripe_event_at: withMs })
      .eq('agency_id', AGENCY)
      .or(orderGuard(withMs))
      .select('agency_id')

    expect(error).toBeNull()
  })
})
