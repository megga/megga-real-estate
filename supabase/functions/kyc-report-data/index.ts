// supabase/functions/kyc-report-data/index.ts
// Matière du rapport KYC pour la route de rendu `/kyc-report/:token` (headless,
// sans session). Le jeton HMAC court (5 min, signé par kyc-report-pdf) désigne le
// dossier ; tout est relu en service-role et SCOPÉ à l'agence du dossier — jamais
// à un paramètre du corps.
//
// Renvoie la forme `BuildReportInput` (src/components/kyc-report/buildReportData.ts)
// moins l'empreinte SHA-256, que le navigateur qui rend calcule lui-même à partir
// de cette matière — la même règle que l'aperçu de l'agent.
//
// ⛔ SEUL UN JETON DE RENDU OUVRE CE RAPPORT (audit du 13.09.2026, point S10). Le même secret
// signe des jetons qui vivent des jours ou des mois (liens KYC, réception acheteur,
// désinscription) : n'importe lequel, s'il était accepté ici, désignerait un `kyc_cases.id`
// sans aucun jeton stocké à confronter — seule la non-collision des UUID protégeait le
// seul endpoint porteur qui serve de l'IDENTITÉ. `isReportTokenPayload` refuse tout `k` et
// toute échéance à plus de dix minutes (_shared/kyc-report-token.ts). Et le motif interne
// ne sort plus : `no_secret` / `malformed` renseignaient un appelant anonyme sur le
// déploiement et sur la grammaire du jeton ; seul « expiré » reste distingué.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'
import { isReportTokenPayload } from '../_shared/kyc-report-token.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // sentry-trace + baggage : la page de rendu /kyc-report/:token tourne dans l'app
  // (Sentry actif) → le SDK ajoute ces en-têtes au fetch. Sans eux dans l'allowlist,
  // le préflight CORS bloque le POST (vu en headless : "field baggage is not allowed")
  // → données jamais chargées → #pdf-ready jamais posé → Cloudflare timeout → 502.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface DecisionRow {
  id: string
  decision_target: 'pep' | 'sanctions'
  decision: string
  justification: string
  decided_by: string | null
  decided_at: string
  supersedes_id: string | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const { token } = (await req.json().catch(() => ({}))) as { token?: string }
    if (!token) return json({ error: 'token required' }, 400)

    const v = await verifyMagicLinkToken(token)
    if (!v.valid || !v.payload) {
      return json({ error: v.reason === 'expired' ? 'invalid token: expired' : 'invalid token' }, 401)
    }
    // Signature valide, mais un jeton d'une AUTRE famille (discriminant `k`) ou d'une autre
    // durée de vie qu'un rendu : même réponse qu'un jeton invalide, rien à distinguer.
    if (!isReportTokenPayload(v.payload, Math.floor(Date.now() / 1000))) {
      return json({ error: 'invalid token' }, 401)
    }
    const dossierId = v.payload.id
    const requesterProfileId = v.payload.p ?? null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Dossier + contact + checklist (mêmes selects que useKycCase)
    const { data: dossier, error: dErr } = await supabase
      .from('kyc_cases')
      .select('*, contact:contacts(first_name, last_name, nationality), checklist:kyc_checklist_items(*)')
      .eq('id', dossierId)
      .single()
    if (dErr || !dossier) return json({ error: 'dossier not found' }, 404)

    const agencyId = (dossier as { agency_id: string }).agency_id
    const validatedBy = (dossier as { validated_by: string | null }).validated_by

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

    // Décisions compliance (kyc_screening_decisions) : la plus récente NON supersédée
    // par cible — même règle que la RPC `kyc_latest_screening_decision`, réécrite ici
    // parce que la RPC lit `get_my_agency_id()`, vide en service-role.
    const { data: decisionRows } = await supabase
      .from('kyc_screening_decisions')
      .select('id, decision_target, decision, justification, decided_by, decided_at, supersedes_id')
      .eq('kyc_case_id', dossierId)
      .eq('agency_id', agencyId)
      .order('decided_at', { ascending: false })
    const rows = (decisionRows ?? []) as DecisionRow[]
    const superseded = new Set(rows.map((r) => r.supersedes_id).filter((id): id is string => Boolean(id)))
    const latestByTarget = new Map<DecisionRow['decision_target'], DecisionRow>()
    for (const r of rows) {
      if (superseded.has(r.id) || latestByTarget.has(r.decision_target)) continue
      latestByTarget.set(r.decision_target, r)
    }
    const decisions = [...latestByTarget.values()]

    // Agence (nom)
    const { data: agency } = await supabase
      .from('agencies').select('name').eq('id', agencyId).single()

    // Les personnes que le rapport NOMME (demandeur, validateur, décideurs) — scopées
    // agence : un profil d'une autre agence ne peut pas apparaître sur ce papier.
    const nameIds = [...new Set([requesterProfileId, validatedBy, ...decisions.map((d) => d.decided_by)]
      .filter((id): id is string => Boolean(id)))]
    const names = new Map<string, string>()
    if (nameIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles').select('id, full_name').in('id', nameIds).eq('agency_id', agencyId)
      for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) {
        if (p.full_name) names.set(p.id, p.full_name)
      }
    }
    const agentName = (requesterProfileId && names.get(requesterProfileId)) || 'Agent compliance'

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
    // dossier.transaction.stage est lu par le builder — on l'injecte.
    const report = {
      dossier: { ...dossier, transaction: { stage } },
      documents: documents ?? [],
      auditEvents: auditEvents ?? [],
      agentName,
      agencyName: agency?.name ?? 'MEGGA',
      transactionAmount,
      transactionRef: null,
      propertyLabel,
      validatedByName: validatedBy ? (names.get(validatedBy) ?? null) : null,
      screeningDecisions: decisions.map((d) => ({
        target: d.decision_target,
        decision: d.decision,
        justification: d.justification,
        decided_at: d.decided_at,
        decided_by_name: d.decided_by ? (names.get(d.decided_by) ?? null) : null,
      })),
    }
    return json({ ok: true, report })
  } catch (err) {
    // Le texte reste dans nos journaux (audit S14) : cet endpoint est public par jeton, et
    // le message d'une erreur Postgres nomme les colonnes et les contraintes du dossier KYC.
    // La page de rendu ne lit pas ce corps — elle pose #pdf-error sur tout échec.
    console.error('[kyc-report-data] échec inattendu :', redactedErrorMessage(err))
    return json({ error: 'internal_error' }, 500)
  }
})
