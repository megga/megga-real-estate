// Non-régression du verrou de concurrence de reconcileSignatureRequest.
// Skribble envoie success + update quasi-simultanément → deux callbacks
// concurrents. Le claim doit verrouiller sur completed_at (colonne qu'il écrit),
// sinon les deux callbacks téléchargent le PDF et écrivent chacun un événement
// d'audit `signature.signed` (trail de conformité pollué).
//
// reconcileSignatureRequest n'utilise que crypto.subtle + fetch (aucun Deno.*) →
// testable sous Node avec un supabase mocké et fetch stubbé.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { reconcileSignatureRequest, isRequestSettled, type SigRequestRow } from './esign-finalize.ts'
import { getEsignProvider, type StatusResult } from './esign-gateway.ts'

// Mock minimal du client Supabase : enregistre updates / inserts / uploads et
// renvoie `claimData` pour le SELECT du claim (simule gagné=[{id}] / perdu=[]).
function createSupabaseMock(claimData: unknown[]) {
  const calls = {
    updates: [] as { table: string; payload: Record<string, unknown>; select: boolean }[],
    inserts: [] as { table: string; payload: Record<string, unknown> }[],
    uploads: [] as { bucket: string; path: string }[],
  }

  function updateBuilder(table: string, payload: Record<string, unknown>) {
    const builder: Record<string, unknown> = {
      eq() { return builder },
      is() { return builder },
      select() {
        calls.updates.push({ table, payload, select: true })
        return Promise.resolve({ data: claimData, error: null })
      },
      // await direct (updates sans .select) → thenable
      then(onFulfilled: (v: unknown) => unknown) {
        calls.updates.push({ table, payload, select: false })
        return Promise.resolve({ data: null, error: null }).then(onFulfilled)
      },
    }
    return builder
  }

  const supabase = {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) { return updateBuilder(table, payload) },
        insert(payload: Record<string, unknown>) {
          calls.inserts.push({ table, payload })
          return Promise.resolve({ error: null })
        },
      }
    },
    storage: {
      from(bucket: string) {
        return {
          upload(path: string) {
            calls.uploads.push({ bucket, path })
            return Promise.resolve({ error: null })
          },
        }
      },
    },
  }
  return { supabase, calls }
}

const SR: SigRequestRow = {
  id: 'sr1',
  agency_id: 'a1',
  provider: 'skribble',
  provider_document_id: 'doc1',
  document_id: null,
  status: 'sent',
  signed_document_path: null,
}

const SIGNED: StatusResult = {
  ok: true,
  status: 'signed',
  providerDocumentId: 'doc1',
  signers: [],
}

const provider = getEsignProvider('skribble')

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reconcileSignatureRequest — verrou de concurrence', () => {
  it('callback perdant (claim = 0 ligne) : ni download ni audit', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { supabase, calls } = createSupabaseMock([]) // personne réclamé → perdu

    const out = await reconcileSignatureRequest({
      supabase, provider, creds: {}, token: 't', sr: SR, statusResult: SIGNED, actor: { kind: 'system' },
    })

    expect(out).toEqual({ status: 'signed', finalized: false })
    expect(fetchSpy).not.toHaveBeenCalled() // pas de download
    expect(calls.uploads).toHaveLength(0)
    expect(calls.inserts).toHaveLength(0) // PAS de double audit
  })

  it('le claim verrouille sur completed_at (pas signed_document_path)', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { supabase, calls } = createSupabaseMock([])
    await reconcileSignatureRequest({
      supabase, provider, creds: {}, token: 't', sr: SR, statusResult: SIGNED, actor: { kind: 'system' },
    })
    const claim = calls.updates.find((u) => u.select)
    expect(claim).toBeDefined()
    // Le claim DOIT écrire completed_at (colonne du verrou) — sinon le WHERE
    // completed_at IS NULL ne serait jamais un vrai mutex.
    expect(claim?.payload.completed_at).toBeTruthy()
  })

  it('callback gagnant (claim = 1 ligne) : un seul download + un seul audit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(16),
    })))
    const { supabase, calls } = createSupabaseMock([{ id: 'sr1' }]) // réclamé → gagné

    const out = await reconcileSignatureRequest({
      supabase, provider, creds: {}, token: 't', sr: SR, statusResult: SIGNED, actor: { kind: 'system' },
    })

    expect(out.finalized).toBe(true)
    expect(calls.uploads).toHaveLength(1) // un seul archivage
    expect(calls.inserts).toHaveLength(1) // un seul audit signature.signed
    const pathUpdate = calls.updates.find((u) => 'signed_document_path' in u.payload)
    expect(pathUpdate?.payload.signed_document_path).toBe('a1/sr1.pdf')
  })

  it('échec download : relâche le verrou (completed_at=null) pour retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0) })))
    const { supabase, calls } = createSupabaseMock([{ id: 'sr1' }])

    const out = await reconcileSignatureRequest({
      supabase, provider, creds: {}, token: 't', sr: SR, statusResult: SIGNED, actor: { kind: 'system' },
    })

    expect(out.finalized).toBe(false)
    expect(calls.uploads).toHaveLength(0)
    const release = calls.updates.find((u) => 'last_error' in u.payload)
    expect(release?.payload.completed_at).toBeNull() // verrou relâché
  })
})

// ── Cycle de vie du jeton de callback (audit du 03.08.2026 §4.3) ─────────────
//
// `webhook_token` voyage dans la query string — ni Skribble ni DocuSign
// n'acceptent d'en-tête sur leurs URL de notification — donc il survit dans les
// journaux d'accès de tout le trajet. Il n'expirait jamais et n'était jamais
// nettoyé : un identifiant valide à vie pour une demande signée il y a des mois.
//
// Ce qui suit verrouille les deux moitiés du correctif : effacer quand c'est
// clos, et surtout NE PAS effacer tant que ça peut encore servir.

describe('isRequestSettled', () => {
  it('clos : PDF archivé, demande retirée, demande refusée', () => {
    expect(isRequestSettled({ status: 'signed', signed_document_path: 'a1/sr1.pdf' })).toBe(true)
    expect(isRequestSettled({ status: 'withdrawn', signed_document_path: null })).toBe(true)
    expect(isRequestSettled({ status: 'declined', signed_document_path: null })).toBe(true)
  })

  it('PAS clos : signé mais pas encore archivé — le download doit rester re-tentable', () => {
    // Le piège du dossier. `signed` sans signed_document_path = le
    // téléchargement précédent a échoué ; reconcile relâche son verrou pour
    // re-tenter au prochain callback. Effacer le jeton ici condamnerait la
    // demande : le callback suivant tomberait en 401 et le PDF ne serait jamais
    // archivé.
    expect(isRequestSettled({ status: 'signed', signed_document_path: null })).toBe(false)
  })

  it('PAS clos : expired et error restent réconciliables', () => {
    // Terminaux au sens du STATUT, mais un callback ultérieur peut encore
    // corriger. Plus étroit que TERMINAL, délibérément.
    expect(isRequestSettled({ status: 'expired', signed_document_path: null })).toBe(false)
    expect(isRequestSettled({ status: 'error', signed_document_path: null })).toBe(false)
  })

  it('PAS clos : statuts en cours', () => {
    for (const status of ['draft', 'sent', 'opened']) {
      expect(isRequestSettled({ status, signed_document_path: null })).toBe(false)
    }
  })
})

describe('reconcileSignatureRequest — effacement du jeton', () => {
  it('archivage réussi : le jeton est effacé dans la MÊME écriture que le chemin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(16),
    })))
    const { supabase, calls } = createSupabaseMock([{ id: 'sr1' }])

    await reconcileSignatureRequest({
      supabase, provider, creds: {}, token: 't', sr: SR, statusResult: SIGNED, actor: { kind: 'system' },
    })

    const pathUpdate = calls.updates.find((u) => 'signed_document_path' in u.payload)
    expect(pathUpdate?.payload.webhook_token).toBeNull()
  })

  it('échec download : le jeton SURVIT — sinon le retry serait condamné', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0),
    })))
    const { supabase, calls } = createSupabaseMock([{ id: 'sr1' }])

    await reconcileSignatureRequest({
      supabase, provider, creds: {}, token: 't', sr: SR, statusResult: SIGNED, actor: { kind: 'system' },
    })

    // Aucune écriture ne doit toucher au jeton sur ce chemin.
    for (const u of calls.updates) {
      expect(u.payload).not.toHaveProperty('webhook_token')
    }
  })

  it('demande refusée : jeton effacé', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { supabase, calls } = createSupabaseMock([{ id: 'sr1' }])

    await reconcileSignatureRequest({
      supabase, provider, creds: {}, token: 't', sr: SR,
      statusResult: { ok: true, status: 'declined', signers: [] },
      actor: { kind: 'system' },
    })

    const update = calls.updates.find((u) => u.payload.status === 'declined')
    expect(update?.payload.webhook_token).toBeNull()
  })

  it('demande expirée : jeton CONSERVÉ', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { supabase, calls } = createSupabaseMock([{ id: 'sr1' }])

    await reconcileSignatureRequest({
      supabase, provider, creds: {}, token: 't', sr: SR,
      statusResult: { ok: true, status: 'expired', signers: [] },
      actor: { kind: 'system' },
    })

    const update = calls.updates.find((u) => u.payload.status === 'expired')
    expect(update).toBeDefined()
    expect(update?.payload).not.toHaveProperty('webhook_token')
  })
})
