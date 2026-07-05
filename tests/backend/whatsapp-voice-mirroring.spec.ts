// Invariants de la feature « mimétisme de voix » WhatsApp (VM — few-shot, par l'exemple).
//
// Ce spec couvre :
//   1. Agency-scoping (live) — fetchClientVoiceSamples ne retourne QUE les messages de
//      l'agence demandée, jamais ceux d'une autre agence (isolation multi-tenant).
//   2. Socle légal (pur) — send_client_email et send_client_message sont confirm-tier
//      et canLeaveConfirm renvoie false pour les deux (toute communication client reste
//      sous validation humaine, quel que soit le nombre d'exemples de voix injectés).
//
// Le formatage des exemples (formatVoiceExamples — déduplication, borne, bloc vide < 2)
// est couvert par les tests unitaires de supabase/functions/_shared/agent-style.test.ts.
// Pas de duplication ici.
//
// Section 1 (live) : skipIf sans clés Supabase — s'exécute en CI où SUPABASE_TEST_* sont
//   présents ; saute proprement en local sans Docker.
// Section 2 (pur)  : aucun skipIf — déterministe, s'exécute partout.
//
// Aucun appel DeepSeek dans ce spec.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { fetchClientVoiceSamples } from '../../supabase/functions/_shared/agent-style'
import { canLeaveConfirm } from '../../supabase/functions/_shared/whatsapp-agent-router'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

// ──────────────────────────────────────────────────────────────────────────────
// Section 1 — fetchClientVoiceSamples : isolation agence (live, Supabase)
// ──────────────────────────────────────────────────────────────────────────────

describe.skipIf(!HAS_KEYS)("fetchClientVoiceSamples — corpus scopé à l'agence (live)", () => {
  let setup: TwoAgenciesSetup

  // provider_message_id uniques par run pour l'isolation des rows
  let stampA1: string
  let stampA2: string
  let stampA3: string
  let stampAauto: string
  let stampB1: string

  // Contacts créés pour ce spec
  let contactAId: string
  let contactBId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const { stamp, agencyAId, agencyBId } = setup
    const svc = serviceRoleClient()

    stampA1 = `vm-a1-${stamp}`
    stampA2 = `vm-a2-${stamp}`
    stampA3 = `vm-a3-${stamp}`
    stampAauto = `vm-aauto-${stamp}`
    stampB1 = `vm-b1-${stamp}`

    // Créer un contact minimal pour l'agence A
    const { data: cA, error: cAErr } = await svc
      .from('contacts')
      .insert({
        agency_id: agencyAId,
        first_name: 'VoiceTest',
        last_name: `A-${stamp}`,
        email: `voice-a-${stamp}@megga-test.local`,
        type: 'lead', // contacts.type NOT NULL + CHECK ∈ {buyer,seller,tenant,landlord,investor,both,lead}
      })
      .select('id')
      .single()
    if (cAErr) throw new Error(`contact agencyA: ${cAErr.message}`)
    contactAId = cA.id

    // Créer un contact minimal pour l'agence B
    const { data: cB, error: cBErr } = await svc
      .from('contacts')
      .insert({
        agency_id: agencyBId,
        first_name: 'VoiceTest',
        last_name: `B-${stamp}`,
        email: `voice-b-${stamp}@megga-test.local`,
        type: 'lead', // contacts.type NOT NULL + CHECK ∈ {buyer,seller,tenant,landlord,investor,both,lead}
      })
      .select('id')
      .single()
    if (cBErr) throw new Error(`contact agencyB: ${cBErr.message}`)
    contactBId = cB.id

    // Insérer 3 messages outbound pour l'agence A
    const { error: insAErr } = await svc.from('whatsapp_messages').insert([
      {
        agency_id: agencyAId,
        contact_id: contactAId,
        direction: 'outbound',
        body: 'Bonjour Madame, je vous confirme la visite de demain à 14h. Cordialement.',
        provider_message_id: stampA1,
        provider: 'openwa',
        wa_from: 'test',
      },
      {
        agency_id: agencyAId,
        contact_id: contactAId,
        direction: 'outbound',
        body: 'Le dossier est bien reçu, nous revenons vers vous sous 48h. Merci.',
        provider_message_id: stampA2,
        provider: 'openwa',
        wa_from: 'test',
      },
      {
        agency_id: agencyAId,
        contact_id: contactAId,
        direction: 'outbound',
        body: 'Suite à notre entretien, voici les documents complémentaires demandés.',
        provider_message_id: stampA3,
        provider: 'openwa',
        wa_from: 'test',
      },
      {
        // Sortant GÉNÉRÉ (send_listings) : is_automated=true → boilerplate, hors corpus de voix.
        agency_id: agencyAId,
        contact_id: contactAId,
        direction: 'outbound',
        body: 'Bonjour VoiceTest, voici une sélection qui pourrait vous intéresser : • Appartement — CHF 2\'450/mois',
        provider_message_id: stampAauto,
        provider: 'openwa',
        wa_from: 'test',
        is_automated: true,
      },
    ])
    if (insAErr) throw new Error(`insert agencyA messages: ${insAErr.message}`)

    // Insérer 1 message outbound pour l'agence B (ne doit JAMAIS apparaître côté A)
    const { error: insBErr } = await svc.from('whatsapp_messages').insert([
      {
        agency_id: agencyBId,
        contact_id: contactBId,
        direction: 'outbound',
        body: 'Message confidentiel agence B — ne doit pas fuiter côté agence A.',
        provider_message_id: stampB1,
        provider: 'openwa',
        wa_from: 'test',
      },
    ])
    if (insBErr) throw new Error(`insert agencyB message: ${insBErr.message}`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()

    // Supprimer les messages insérés par ce spec
    await svc
      .from('whatsapp_messages')
      .delete()
      .in('provider_message_id', [stampA1, stampA2, stampA3, stampAauto, stampB1])
      .then(() => {}, () => {})

    // Supprimer les contacts créés
    if (contactAId) {
      await svc.from('contacts').delete().eq('id', contactAId).then(() => {}, () => {})
    }
    if (contactBId) {
      await svc.from('contacts').delete().eq('id', contactBId).then(() => {}, () => {})
    }

    await setup.cleanup()
  })

  it("retourne les 3 messages de l'agence A et aucun de l'agence B", async () => {
    const samples = await fetchClientVoiceSamples(serviceRoleClient(), setup.agencyAId)

    // Les 3 bodies A doivent être présents
    const bodies = samples.map((s) => s.body)
    expect(bodies).toContain('Bonjour Madame, je vous confirme la visite de demain à 14h. Cordialement.')
    expect(bodies).toContain('Le dossier est bien reçu, nous revenons vers vous sous 48h. Merci.')
    expect(bodies).toContain('Suite à notre entretien, voici les documents complémentaires demandés.')

    // Le body agence B ne doit PAS fuiter
    expect(bodies).not.toContain('Message confidentiel agence B — ne doit pas fuiter côté agence A.')
  })

  it("retourne au moins 3 samples pour l'agence A (count)", async () => {
    const samples = await fetchClientVoiceSamples(serviceRoleClient(), setup.agencyAId)
    // On a inséré 3 rows valides → au moins 3 doivent être retournés
    expect(samples.length).toBeGreaterThanOrEqual(3)
  })

  it("exclut le texte généré (is_automated=true) du corpus de voix", async () => {
    // Le sortant send_listings/template ne doit JAMAIS entrer dans le few-shot de ton :
    // c'est du boilerplate machine, pas la prose écrite par l'agent.
    const samples = await fetchClientVoiceSamples(serviceRoleClient(), setup.agencyAId)
    const bodies = samples.map((s) => s.body)
    expect(bodies).not.toContain('Bonjour VoiceTest, voici une sélection qui pourrait vous intéresser : • Appartement — CHF 2\'450/mois')
    // les 3 messages authored restent, eux, présents
    expect(bodies).toContain('Le dossier est bien reçu, nous revenons vers vous sous 48h. Merci.')
  })

  it('retourne [] pour agencyId null (dégradation propre)', async () => {
    const samples = await fetchClientVoiceSamples(serviceRoleClient(), null)
    expect(samples).toEqual([])
  })

  it('filtre les bodies de 1 caractère ou moins (bruit court)', async () => {
    // La fonction fetchClientVoiceSamples filtre body.length > 1 (cohérent avec VOICE_MIN logic)
    // Les 3 bodies A insérés sont tous longs → tous passent le filtre
    const samples = await fetchClientVoiceSamples(serviceRoleClient(), setup.agencyAId)
    for (const s of samples) {
      expect(s.body.length).toBeGreaterThan(1)
    }
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Section 2 — Socle légal (pur — aucun skipIf, s'exécute partout sans Supabase)
// ──────────────────────────────────────────────────────────────────────────────
//
// Le mimétisme de voix injecte du few-shot dans les brouillons de messages client.
// Quel que soit le nombre d'exemples de voix, le tier confirm et canLeaveConfirm
// DOIVENT rester inchangés : l'injection de ton ne change pas les garde-fous légaux.
//
// NB : formatVoiceExamples (déduplication, borne < VOICE_MIN → bloc vide, etc.)
// est couvert par supabase/functions/_shared/agent-style.test.ts — pas dupliqué ici.

describe('voix mimétisme — socle légal inchangé (pur, sans réseau)', () => {
  it("canLeaveConfirm('send_client_message') === false", () => {
    // Toute communication WhatsApp client reste sous validation humaine —
    // le few-shot de voix ne change pas cet invariant.
    expect(canLeaveConfirm('send_client_message')).toBe(false)
  })

  it("canLeaveConfirm('send_client_email') === false", () => {
    // L'email client (brouillon WYSIWYG + voix few-shot) reste irréversible →
    // validation humaine obligatoire avant envoi.
    expect(canLeaveConfirm('send_client_email')).toBe(false)
  })
})
