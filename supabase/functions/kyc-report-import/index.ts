// supabase/functions/kyc-report-import/index.ts
// Voie « Importer un dossier externe » du wizard KYC : lit un rapport de
// vérification KYC/AML externe (PDF) via Gemini (lecture PDF native) et renvoie
// les contrôles couverts (identité / PEP / sanctions) PROPOSÉS.
//
// ⚠ Garde-fou MLRO : l'extraction est une PROPOSITION, jamais une vérité. Le
// client attache le PDF au dossier ; les contrôles restent À VALIDER par l'agent.
// Agents authentifiés uniquement (consomme des crédits IA) — anon bloqué.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { readDocument } from '../_shared/vision.ts'
import { KYC_REPORT_PROMPT, normalizeKycReport, parseKycOcr } from '../_shared/kyc-extract.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

// 10 Mo cap sur le payload base64 (aligné extract-property-pdf).
const MAX_PDF_BASE64_BYTES = 10 * 1024 * 1024

// Quotas mensuels par agence (même forme que extract-property-pdf).
const PLAN_QUOTAS: Record<string, number> = {
  starter: 5,
  pro: 100,
  entreprise: 500,
  agency: 500,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth
    const { profile, supabase } = auth

    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY')
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Quota mensuel ──────────────────────────────────────────────────
    const { data: agency } = await supabase
      .from('agencies')
      .select('plan')
      .eq('id', profile.agency_id)
      .single()
    const plan = (agency?.plan as string) || 'starter'
    const quota = PLAN_QUOTAS[plan] ?? 0

    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)

    const { count: usageCount } = await supabase
      .from('activity_events')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', profile.agency_id)
      .eq('action', 'kyc_report_import')
      .gte('created_at', startOfMonth.toISOString())

    const currentUsage = usageCount ?? 0
    if (currentUsage >= quota) {
      return new Response(
        JSON.stringify({
          error: `Quota mensuel atteint (${currentUsage}/${quota} rapports importés ce mois)`,
          quota_exceeded: true,
          current_usage: currentUsage,
          quota,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { pdf_base64, filename } = await req.json()

    if (!pdf_base64 || typeof pdf_base64 !== 'string') {
      return new Response(JSON.stringify({ error: 'pdf_base64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (pdf_base64.length > MAX_PDF_BASE64_BYTES) {
      return new Response(JSON.stringify({ error: 'PDF trop volumineux (max 10 Mo)' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Extraction Gemini (lecture PDF native), JSON strict.
    const pdfBytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0))
    const gemini = await readDocument(pdfBytes, 'application/pdf', geminiKey, {
      prompt: KYC_REPORT_PROMPT,
      json: true,
    })
    if (!gemini.ok) {
      console.error('Gemini KYC report extraction error:', gemini.error ?? 'unknown')
      return new Response(JSON.stringify({ error: 'AI extraction error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parser tolérant → normalisation (jamais de throw ; {} si inexploitable).
    const raw = parseKycOcr(gemini.text)
    const extract = normalizeKycReport(raw)

    if (extract.checks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Aucun contrôle exploitable dans ce rapport.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Log APRÈS succès (quota + audit ; un 502/422 ne compte pas). PII non loggée.
    await supabase.from('activity_events').insert({
      agency_id: profile.agency_id,
      actor_id: profile.id,
      actor_kind: 'ai',
      action: 'kyc_report_import',
      entity_type: 'kyc_case',
      severity: 'info',
      category: 'ai',
      metadata: {
        filename: filename ?? 'rapport.pdf',
        provider: extract.provider,
        checks_count: extract.checks.length,
        usage_count: currentUsage + 1,
        quota,
      },
    })

    // Corps = la forme consommée directement par le wizard (KwStepImport).
    return new Response(JSON.stringify(extract), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('kyc-report-import error:', err)
    return new Response(JSON.stringify({ error: 'Internal error', message: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
