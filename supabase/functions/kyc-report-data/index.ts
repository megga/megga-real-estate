import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const { token } = (await req.json().catch(() => ({}))) as { token?: string }
    if (!token) return json({ error: 'token required' }, 400)

    const v = await verifyMagicLinkToken(token)
    if (!v.valid || !v.payload) return json({ error: `invalid token: ${v.reason ?? 'unknown'}` }, 401)
    const dossierId = v.payload.id
    const requesterProfileId = v.payload.p ?? null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Dossier + contact + checklist (mêmes selects que useKycCase)
    const { data: dossier, error: dErr } = await supabase
      .from('kyc_cases')
      .select('*, contact:contacts(first_name, last_name), checklist:kyc_checklist_items(*)')
      .eq('id', dossierId)
      .single()
    if (dErr || !dossier) return json({ error: 'dossier not found' }, 404)

    const agencyId = (dossier as { agency_id: string }).agency_id

    // Documents (mêmes colonnes que useKycDocuments)
    const { data: documents } = await supabase
      .from('documents')
      .select('id, kyc_case_id, name, type, storage_path, size_bytes, status, document_category, issued_at, expires_at, uploaded_by, created_at, sha256_hash')
      .eq('kyc_case_id', dossierId)
      .order('created_at', { ascending: false })

    // Audit (mêmes filtres que useKycAuditEvents)
    const { data: auditEvents } = await supabase
      .from('activity_events')
      .select('id, agency_id, actor_id, actor_kind, action, entity_type, entity_id, metadata, created_at, actor:profiles!actor_id(full_name)')
      .in('entity_type', ['kyc', 'kyc_case', 'kyc_check'])
      .eq('entity_id', dossierId)
      .order('created_at', { ascending: false })

    // Agence (nom)
    const { data: agency } = await supabase
      .from('agencies').select('name').eq('id', agencyId).single()

    // Agent demandeur (nom) — scopé agence par sécurité
    let agentName = 'Agent compliance'
    if (requesterProfileId) {
      const { data: prof } = await supabase
        .from('profiles').select('full_name').eq('id', requesterProfileId).eq('agency_id', agencyId).maybeSingle()
      if (prof?.full_name) agentName = prof.full_name
    }

    // Transaction (montant + libellé bien + stage) — mirroir KycExportPage/useTransaction
    let transactionAmount: number | null = null
    let propertyLabel: string | null = null
    let stage: string | null = null
    const txId = (dossier as { transaction_id: string | null }).transaction_id
    if (txId) {
      const { data: tx } = await supabase
        .from('transactions')
        .select('stage, price_final, price_offered, property:properties(title, city)')
        .eq('id', txId)
        .maybeSingle<{ stage: string | null; price_final: number | null; price_offered: number | null; property: { title: string | null; city: string | null } | null }>()
      if (tx) {
        transactionAmount = tx.price_final ?? tx.price_offered ?? null
        stage = tx.stage ?? null
        const title = tx.property?.title ?? null
        const city = tx.property?.city ?? null
        propertyLabel = title ? (city ? `${title} · ${city}` : title) : null
      }
    }

    // Shape consommée par buildPdfReportData (BuildReportInput, côté route).
    // dossier.transaction.stage est lu par buildVerdict — on l'injecte.
    const report = {
      dossier: { ...dossier, transaction: { stage } },
      documents: documents ?? [],
      auditEvents: auditEvents ?? [],
      agentName,
      agencyName: agency?.name ?? 'MEGGA',
      transactionAmount,
      transactionRef: null,
      propertyLabel,
    }
    return json({ ok: true, report })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
