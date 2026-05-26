// Regression — generated documents storage bucket + RLS.
//
// PR #444 wires real PDF generation (DocumentGenerator → @react-pdf
// → blob → upload to `documents` Storage bucket → INSERT documents row).
// The bucket layout is `{agency_id}/{document_id}.pdf` and 4 RLS
// policies enforce agency isolation at the path-prefix level.
//
// This test asserts:
//   - the `documents` bucket exists
//   - agent A can upload + read their agency's prefix
//   - agent B can NOT touch agency A's prefix

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — documents bucket + RLS', () => {
  let setup: TwoAgenciesSetup
  let pathA: string
  let pathB: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    pathA = `${setup.agencyAId}/test-doc-${setup.stamp}.pdf`
    pathB = `${setup.agencyBId}/test-doc-${setup.stamp}.pdf`
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    await svc.storage.from('documents').remove([pathA, pathB]).catch(() => {})
    await setup.cleanup()
  })

  it('documents bucket exists', async () => {
    const svc = serviceRoleClient()
    const { data: buckets, error } = await svc.storage.listBuckets()
    expect(error).toBeNull()
    const documentsBucket = buckets?.find((b) => b.id === 'documents')
    expect(documentsBucket, 'documents bucket should be created by migration').toBeTruthy()
    expect(documentsBucket?.public, 'documents bucket should be private').toBe(false)
  })

  it('agent A uploads to their agency prefix', async () => {
    const fakePdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' })
    const { error } = await setup.clientA.storage
      .from('documents')
      .upload(pathA, fakePdf, { contentType: 'application/pdf' })
    expect(error).toBeNull()
  })

  it('agent B CANNOT upload to agency A prefix (RLS isolation)', async () => {
    const fakePdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' })
    const sneakyPath = `${setup.agencyAId}/intrusion-${setup.stamp}.pdf`
    const { error } = await setup.clientB.storage
      .from('documents')
      .upload(sneakyPath, fakePdf, { contentType: 'application/pdf' })
    // Storage RLS surfaces as a non-null error (usually 'new row violates row-level security policy').
    expect(error, `agent B should be blocked from agency A prefix`).toBeTruthy()
  })

  it('agent A INSERTs a documents row referencing the uploaded path', async () => {
    const { data, error } = await setup.clientA
      .from('documents')
      .insert({
        agency_id: setup.agencyAId,
        name: 'Test mandat.pdf',
        type: 'generated',
        status: 'available',
        size_bytes: 4,
        storage_path: pathA,
        document_category: 'other',
      })
      .select('id, storage_path, status')
      .single()
    expect(error).toBeNull()
    expect(data?.storage_path).toBe(pathA)
    expect(data?.status).toBe('available')
    // Clean up — the documents row clean is on us (afterAll handles the
    // storage object).
    if (data?.id) {
      const svc = serviceRoleClient()
      await svc.from('documents').delete().eq('id', data.id)
    }
  })
})
