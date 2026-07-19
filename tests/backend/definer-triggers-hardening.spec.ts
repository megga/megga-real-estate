// Backend test (live CI) — durcissement des deux triggers SECURITY DEFINER qui
// écrivent dans le journal d'audit (migration 20260719140000_harden_definer_triggers).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : les tests s'exécutent contre un Supabase
// local seedé (jamais la prod) et DOIVENT réellement passer.
//
// Contexte (issue #891, suite de l'audit RLS anon #889) :
//   - notify_new_contact_message() recopiait `name` et `subject` TELS QUELS dans
//     activity_events.object_label et metadata. Ces valeurs viennent d'un formulaire
//     public et peuvent contenir des sauts de ligne / caractères de contrôle. La
//     table est IMMUABLE (rétention LBA 10 ans) : rien n'est purgeable ensuite.
//   - bump_contact_last_interaction() portait `(NEW.agency_id IS NULL OR ...)`, ce qui
//     DÉSACTIVAIT le filtre d'agence : un événement sans agence portant un contact_id
//     pouvait rafraîchir la recency d'un contact de n'importe quelle agence.
//
// Le pont anon est déjà fermé par #889 (contact_messages n'est plus insérable que par
// super_admin ou service_role) — ces tests gardent le MÉCANISME, pas la porte d'entrée.

import { describe, it, expect, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const STAMP = Date.now()
const createdMessageIds: string[] = []
const createdAgencyIds: string[] = []

describe.skipIf(!HAS_KEYS)('notify_new_contact_message — texte non authentifié borné et nettoyé', () => {
  afterAll(async () => {
    if (!HAS_KEYS) return
    const svc = serviceRoleClient()
    if (createdMessageIds.length) {
      await svc.from('contact_messages').delete().in('id', createdMessageIds)
    }
  })

  it("nettoie les caractères de contrôle et tronque avant d'écrire dans activity_events", async () => {
    const svc = serviceRoleClient()

    // Charge hostile DANS les limites des CHECK de la table (name <= 120, subject <= 200) :
    // la longueur est déjà bornée à l'insertion, ce sont les caractères de contrôle
    // qui passaient — ils cassent la lecture d'un journal qu'on ne peut plus purger.
    const nomHostile = `Attaquant\nFAUX evenement\r\tinjecte ${'X'.repeat(80)}`
    const sujetHostile = `Sujet\nmultiligne\rinjecte ${'Y'.repeat(170)}`

    const { data: msg, error } = await svc
      .from('contact_messages')
      .insert({
        name: nomHostile,
        email: `definer-guard-${STAMP}@megga-test.local`,
        message: 'message de sonde suffisamment long pour le CHECK',
        consent_privacy: true,
        status: 'new',
        // Le champ qui arme le trigger.
        source: 'storefront',
        subject: sujetHostile,
        lang: 'fr',
      })
      .select('id')
      .single()

    expect(error, `insert contact_message: ${error?.message}`).toBeNull()
    createdMessageIds.push(msg!.id)

    const { data: ev, error: evErr } = await svc
      .from('activity_events')
      .select('object_label, metadata')
      .eq('action', 'contact_message_received')
      .eq('entity_id', msg!.id)
      .single()

    expect(evErr, `event introuvable: ${evErr?.message}`).toBeNull()

    const label = ev!.object_label as string
    const meta = ev!.metadata as Record<string, string | null>

    // eslint-disable-next-line no-control-regex
    const CTRL = /[\u0000-\u001F\u007F]/

    expect(CTRL.test(label), `caractères de contrôle dans object_label: ${JSON.stringify(label)}`).toBe(false)
    expect(CTRL.test(meta.name ?? ''), 'caractères de contrôle dans metadata.name').toBe(false)
    expect(CTRL.test(meta.subject ?? ''), 'caractères de contrôle dans metadata.subject').toBe(false)

    // Bornes : nom <= 80, sujet <= 120 (et donc libellé <= ~233).
    expect((meta.name ?? '').length).toBeLessThanOrEqual(80)
    expect((meta.subject ?? '').length).toBeLessThanOrEqual(120)
    expect(label.length).toBeLessThanOrEqual(240)

    // Le libellé reste utile : il porte toujours le préfixe et le début du nom.
    expect(label).toContain('Nouveau message de contact')
    expect(label).toContain('Attaquant')
  })

  it("n'écrit aucun événement quand source n'est pas 'storefront'", async () => {
    const svc = serviceRoleClient()
    const { data: msg, error } = await svc
      .from('contact_messages')
      .insert({
        name: 'Sonde hors storefront',
        email: `definer-guard-nosource-${STAMP}@megga-test.local`,
        message: 'message de sonde suffisamment long pour le CHECK',
        consent_privacy: true,
        status: 'new',
        source: 'import',
        lang: 'fr',
      })
      .select('id')
      .single()

    expect(error, `insert: ${error?.message}`).toBeNull()
    createdMessageIds.push(msg!.id)

    const { count } = await svc
      .from('activity_events')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'contact_message_received')
      .eq('entity_id', msg!.id)

    expect(count ?? 0).toBe(0)
  })
})

describe.skipIf(!HAS_KEYS)('bump_contact_last_interaction — un bump doit être attribué à une agence', () => {
  afterAll(async () => {
    if (!HAS_KEYS) return
    const svc = serviceRoleClient()
    if (createdAgencyIds.length) {
      await svc.from('agencies').delete().in('id', createdAgencyIds)
    }
  })

  it("un événement SANS agency_id ne peut plus toucher le contact d'une agence", async () => {
    const svc = serviceRoleClient()

    const { data: ag, error: agErr } = await svc
      .from('agencies')
      .insert({ name: `Agence Definer ${STAMP}`, city: 'Genève', canton: 'GE' })
      .select('id')
      .single()
    expect(agErr, `agence: ${agErr?.message}`).toBeNull()
    createdAgencyIds.push(ag!.id)

    const { data: contact, error: cErr } = await svc
      .from('contacts')
      .insert({
        first_name: 'Cible',
        last_name: `Definer ${STAMP}`,
        email: `definer-target-${STAMP}@megga-test.local`,
        type: 'buyer',
        source: 'manual',
        agency_id: ag!.id,
      })
      .select('id, last_interaction_at')
      .single()
    expect(cErr, `contact: ${cErr?.message}`).toBeNull()

    const avant = contact!.last_interaction_at

    // Attaque : événement sans agence portant le contact_id d'une agence tierce.
    const { error: evErr } = await svc.from('activity_events').insert({
      agency_id: null,
      actor_kind: 'system',
      action: 'Note ajoutée',
      entity_type: 'note',
      category: 'contact',
      severity: 'info',
      metadata: { contact_id: contact!.id },
    })
    expect(evErr, `event sans agence: ${evErr?.message}`).toBeNull()

    const { data: apres } = await svc
      .from('contacts')
      .select('last_interaction_at')
      .eq('id', contact!.id)
      .single()

    expect(
      apres!.last_interaction_at,
      'un événement sans agency_id ne doit pas rafraîchir la recency'
    ).toBe(avant)
  })

  it('un événement AVEC la bonne agence bumpe toujours (pas de régression)', async () => {
    const svc = serviceRoleClient()

    const { data: ag } = await svc
      .from('agencies')
      .insert({ name: `Agence Definer OK ${STAMP}`, city: 'Genève', canton: 'GE' })
      .select('id')
      .single()
    createdAgencyIds.push(ag!.id)

    const { data: contact } = await svc
      .from('contacts')
      .insert({
        first_name: 'Legitime',
        last_name: `Definer ${STAMP}`,
        email: `definer-ok-${STAMP}@megga-test.local`,
        type: 'buyer',
        source: 'manual',
        agency_id: ag!.id,
      })
      .select('id, last_interaction_at')
      .single()

    const avant = contact!.last_interaction_at

    const { error: evErr } = await svc.from('activity_events').insert({
      agency_id: ag!.id,
      actor_kind: 'system',
      action: 'Note ajoutée',
      entity_type: 'note',
      category: 'contact',
      severity: 'info',
      metadata: { contact_id: contact!.id },
    })
    expect(evErr, `event avec agence: ${evErr?.message}`).toBeNull()

    const { data: apres } = await svc
      .from('contacts')
      .select('last_interaction_at')
      .eq('id', contact!.id)
      .single()

    expect(
      apres!.last_interaction_at,
      'un événement attribué à la bonne agence doit toujours bumper'
    ).not.toBe(avant)
  })
})
