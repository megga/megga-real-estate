// Palier 3b — rollbacks d'undo auto (live Supabase, skipIf sans clés).
//
// Couvre les DB-ops que rollbackAutoAction effectue dans whatsapp-webhook/index.ts :
//
//  Test 1  — create_contact rollback : delete scoped par agency_id, vérifie 1 ligne
//            affectée et que le contact a disparu.
//
//  Test 2  — create_contact rollback sur id périmé (row-count honesty) : le même delete
//            re-tenté sur la ligne déjà supprimée renvoie 0 lignes → rollbackAutoAction
//            retourne null et relâche le verrou au lieu de confirmer faussement.
//
//  Test 3  — qualify_lead rollback cohérent : la recherche (client_searches) est supprimée
//            EN PREMIER, puis le contact est restauré (tags + search_criteria).
//            Vérifie que les deux assertions passent (ordre + valeurs).
//
//  Test 4  — (documente le design) add_note undo est légalement impossible :
//            activity_events a un trigger BEFORE DELETE (enforce_activity_events_immutability)
//            qui lève une exception pour toute suppression < 10 ans (LBA art. 7 al. 3).
//            Le delete doit renvoyer une erreur non-null — c'est pourquoi add_note a été
//            exclu de l'ensemble des outils annulables (Palier 3b).
//
// Runs live in CI (SUPABASE_TEST_* keys present).
// Skips cleanly locally when keys are absent (no Docker required for unit runs).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)("Palier 3b — rollbacks d'undo auto", () => {
  let setup: TwoAgenciesSetup

  // IDs seeded per-test — cleanup() only removes users+agencies.
  let contactIdForRollback: string | null = null   // Test 1 + 2
  let qualifyContactId: string | null = null        // Test 3
  let qualifySearchId: string | null = null         // Test 3
  let activityEventId: string | null = null         // Test 4

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    const svc = serviceRoleClient()

    // Test 1+2: contact may or may not still exist (deleted by rollback test, but guard anyway)
    if (contactIdForRollback) {
      await svc.from('contacts').delete().eq('id', contactIdForRollback).then(() => {}, () => {})
    }

    // Test 3: search may have been deleted by the rollback test; contact may still exist
    if (qualifySearchId) {
      await svc.from('client_searches').delete().eq('id', qualifySearchId).then(() => {}, () => {})
    }
    if (qualifyContactId) {
      await svc.from('contacts').delete().eq('id', qualifyContactId).then(() => {}, () => {})
    }

    // Test 4: activity_events immutability trigger will block the delete — try anyway (best-effort)
    if (activityEventId) {
      await svc.from('activity_events').delete().eq('id', activityEventId).then(() => {}, () => {})
    }

    await setup.cleanup()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1 — create_contact rollback
  // Mirrors: rollbackAutoAction → contacts.delete().eq('id', id).eq('agency_id', agencyId).select('id')
  // ──────────────────────────────────────────────────────────────────────────

  it('create_contact rollback: delete affects 1 row and the contact is gone', async () => {
    const svc = serviceRoleClient()

    // Seed a contact to be "undone"
    const { data: contact, error: insertErr } = await svc
      .from('contacts')
      .insert({
        agency_id: setup.agencyAId,
        first_name: 'Undo',
        last_name: `Contact ${setup.stamp}`,
        email: `undo-contact-${setup.stamp}@megga-test.local`,
        type: 'buyer',
      })
      .select('id')
      .single()
    if (insertErr) throw new Error(`seed contact: ${insertErr.message}`)
    contactIdForRollback = contact.id

    // Replicate the rollback in rollbackAutoAction (create_contact branch)
    const { data: deleted, error: deleteErr } = await svc
      .from('contacts')
      .delete()
      .eq('id', contactIdForRollback)
      .eq('agency_id', setup.agencyAId)
      .select('id')
    expect(deleteErr).toBeNull()
    // Exactly 1 row must have been affected — rollbackAutoAction checks this (returns null if 0)
    expect(deleted).toHaveLength(1)
    expect(deleted![0].id).toBe(contactIdForRollback)

    // The contact must no longer exist
    const { data: gone } = await svc
      .from('contacts')
      .select('id')
      .eq('id', contactIdForRollback)
      .maybeSingle()
    expect(gone).toBeNull()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2 — stale-id re-delete returns 0 rows (row-count honesty)
  // This is what makes rollbackAutoAction return null and release the undo
  // claim instead of sending a false "undone" confirmation.
  // ──────────────────────────────────────────────────────────────────────────

  it('create_contact rollback on stale id returns 0 rows (no false confirmation)', async () => {
    // contactIdForRollback was already deleted in Test 1 above
    if (!contactIdForRollback) throw new Error('Test 1 did not set contactIdForRollback')
    const svc = serviceRoleClient()

    const { data: deleted, error: deleteErr } = await svc
      .from('contacts')
      .delete()
      .eq('id', contactIdForRollback)
      .eq('agency_id', setup.agencyAId)
      .select('id')
    expect(deleteErr).toBeNull()
    // 0 rows → rollbackAutoAction returns null → handler releases the undo claim
    expect(deleted).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3 — qualify_lead coherent rollback
  // Mirrors rollbackAutoAction → qualify_lead branch:
  //   1. client_searches.delete first
  //   2. contacts.update (restore tags + search_criteria) second
  // ──────────────────────────────────────────────────────────────────────────

  it('qualify_lead rollback: search deleted first, then contact tags+criteria restored', async () => {
    const svc = serviceRoleClient()

    const originalTags = ['x']
    const originalSearchCriteria = { transaction_type: 'rent' }
    const postQualifyTags = ['x', 'lead_qualifié']
    const postQualifySearchCriteria = { transaction_type: 'rent', budget_max: 3000 }

    // Seed a contact already in its "post-qualify" state (simulate what qualify_lead wrote)
    const { data: contact, error: cErr } = await svc
      .from('contacts')
      .insert({
        agency_id: setup.agencyAId,
        first_name: 'Lead',
        last_name: `Qualify ${setup.stamp}`,
        email: `qualify-${setup.stamp}@megga-test.local`,
        type: 'buyer',
        tags: postQualifyTags,
        search_criteria: postQualifySearchCriteria,
      })
      .select('id')
      .single()
    if (cErr) throw new Error(`seed qualify contact: ${cErr.message}`)
    qualifyContactId = contact.id

    // Seed the client_searches row that qualify_lead created (criteria is NOT NULL).
    // is_active=false À DESSEIN : le trigger AFTER INSERT on_new_client_search ne fait son
    // net.http_post vers matching-engine que si is_active=true, et get_app_config('supabase_url')
    // est null en CI → violation NOT NULL sur http_request_queue. Le rollback teste le DELETE par
    // id, identique quel que soit is_active.
    const { data: search, error: sErr } = await svc
      .from('client_searches')
      .insert({
        agency_id: setup.agencyAId,
        contact_id: qualifyContactId,
        criteria: postQualifySearchCriteria,
        is_active: false,
      })
      .select('id')
      .single()
    if (sErr) throw new Error(`seed client_searches: ${sErr.message}`)
    qualifySearchId = search.id

    // ── Replicate rollbackAutoAction qualify_lead branch ──

    // Step 1: delete client_searches FIRST (coherence: mirror dispatcher order)
    const { error: searchDelErr } = await svc
      .from('client_searches')
      .delete()
      .eq('id', qualifySearchId)
      .eq('agency_id', setup.agencyAId)
    expect(searchDelErr).toBeNull()

    // Step 2: restore contact (tags + search_criteria)
    const { data: restored, error: updateErr } = await svc
      .from('contacts')
      .update({
        tags: originalTags,
        search_criteria: originalSearchCriteria,
      })
      .eq('id', qualifyContactId)
      .eq('agency_id', setup.agencyAId)
      .select('id')
    expect(updateErr).toBeNull()
    // Must affect exactly 1 row — rollbackAutoAction checks this (returns null if 0)
    expect(restored).toHaveLength(1)

    // Verify restored state
    const { data: row, error: selectErr } = await svc
      .from('contacts')
      .select('tags, search_criteria')
      .eq('id', qualifyContactId)
      .single()
    if (selectErr) throw new Error(`re-select contact: ${selectErr.message}`)
    expect(row.tags).toEqual(originalTags)
    expect(row.search_criteria).toEqual(originalSearchCriteria)

    // Verify the client_searches row is gone
    const { data: searchGone } = await svc
      .from('client_searches')
      .select('id')
      .eq('id', qualifySearchId)
      .maybeSingle()
    expect(searchGone).toBeNull()

    // Mark as cleaned up so afterAll doesn't double-attempt
    qualifySearchId = null
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4 — add_note undo is legally impossible (documents the design)
  // The trigger enforce_activity_events_immutability (BEFORE DELETE) raises
  // an exception for any row < 10 years old, even with service_role.
  // This is why add_note was excluded from the undoable tool set (Palier 3b).
  // ──────────────────────────────────────────────────────────────────────────

  it('add_note undo is blocked: activity_events delete errors (immutability trigger)', async () => {
    const svc = serviceRoleClient()

    // Seed an activity_events row as the "add_note" tool would create
    const { data: event, error: insertErr } = await svc
      .from('activity_events')
      .insert({
        agency_id: setup.agencyAId,
        actor_id: null,
        actor_kind: 'ai',
        action: 'Note test',
        entity_type: 'contact',
        category: 'contact',
        severity: 'info',
        metadata: {},
      })
      .select('id')
      .single()
    if (insertErr) throw new Error(`seed activity_events: ${insertErr.message}`)
    activityEventId = event.id

    // Attempt to delete the row — the trigger must block it
    const { error: deleteErr } = await svc
      .from('activity_events')
      .delete()
      .eq('id', activityEventId)

    // Le trigger d'immutabilité (LBA art.7) DOIT rejeter ce DELETE — c'est précisément
    // pourquoi add_note n'est pas annulable. Assertion inconditionnelle (le trigger est
    // dans le baseline, donc toujours présent en CI).
    expect(deleteErr).not.toBeNull()
    expect(deleteErr!.message).toMatch(/10 ans|10 years|immutabilit|append-only/i)
  })
})
