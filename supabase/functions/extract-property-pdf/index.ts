// supabase/functions/extract-property-pdf/index.ts
// Extracts structured property data from a PDF using Gemini Vision (native PDF).
// Authenticated agents only — uses AI credits, so anon access is blocked.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { readDocument } from '../_shared/vision.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

// 10 MB cap on base64 payload (Gemini inline PDF tops out around there too,
// and prevents a single agent from running up the AI bill on one call).
const MAX_PDF_BASE64_BYTES = 10 * 1024 * 1024

// Per-agency monthly quotas — mirror virtual-staging shape. PDF extraction
// costs ~CHF 0.03 per call, so worst-case Pro = CHF 3/month/agent.
const PLAN_QUOTAS: Record<string, number> = {
  starter: 5,
  pro: 100,
  entreprise: 500,
  agency: 500,
}

const EXTRACTION_PROMPT = `Tu es un expert immobilier suisse. Analyse ce document PDF et extrais TOUTES les informations du bien immobilier.

Retourne un JSON strict avec ces champs (utilise null si l'info n'est pas trouvée) :

{
  "title": "string — titre ou description courte du bien",
  "description": "string — description complète du bien",
  "type": "apartment | house | villa | commercial | land",
  "price": number,
  "charges_monthly": number | null,
  "rooms": number,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "surface_m2": number,
  "floor": number | null,
  "total_floors": number | null,
  "year_built": number | null,
  "condition": "new | renovated | good | to_renovate | null",
  "address": "string — adresse complète (rue + numéro)",
  "city": "string — ville",
  "canton": "string — code canton 2 lettres (GE, VD, ZH...)",
  "postal_code": "string — NPA",
  "features": ["string — liste des caractéristiques : parking, balcon, terrasse, cave, ascenseur, vue lac, etc."],
  "mandate_type": "simple | exclusive | null",
  "confidence": number de 0 à 100 — ta confiance globale dans l'extraction
}

Règles :
- Prix en CHF, sans apostrophes, juste le nombre
- Surface en m² (nombre seul)
- Si le document mentionne "PPE" ou "copropriété", type = "apartment"
- Si le document mentionne "maison individuelle" ou "villa", type = "house" ou "villa"
- Extrait l'adresse la plus précise possible
- Déduis le canton depuis le NPA ou la ville si non mentionné
- Pour les features, normalise : "place de parc" → "parking", "balcon/loggia" → "balcon"
- Retourne UNIQUEMENT le JSON, pas de texte avant ou après`

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
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Monthly quota check ────────────────────────────────────────────
    // Same shape as virtual-staging: read agency.plan, look up the cap,
    // count this-month's calls from activity_events. 429 if over.
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
      .eq('action', 'extract_property_pdf')
      .gte('created_at', startOfMonth.toISOString())

    const currentUsage = usageCount ?? 0
    if (currentUsage >= quota) {
      return new Response(
        JSON.stringify({
          error: `Quota mensuel atteint (${currentUsage}/${quota} PDF extraits ce mois)`,
          quota_exceeded: true,
          current_usage: currentUsage,
          quota,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { pdf_base64, filename } = await req.json()

    if (!pdf_base64 || typeof pdf_base64 !== 'string') {
      return new Response(
        JSON.stringify({ error: 'pdf_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (pdf_base64.length > MAX_PDF_BASE64_BYTES) {
      return new Response(
        JSON.stringify({ error: 'PDF trop volumineux (max 10 Mo)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extraction via Gemini Vision (lecture PDF native), JSON strict.
    const pdfBytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0))
    const gemini = await readDocument(pdfBytes, 'application/pdf', geminiKey, { prompt: EXTRACTION_PROMPT, json: true })
    if (!gemini.ok) {
      console.error('Gemini PDF extraction error:', gemini.error ?? 'unknown')
      return new Response(
        JSON.stringify({ error: 'AI extraction error' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const text = gemini.text

    // Parse the JSON from the model's response
    let extracted
    try {
      // Find JSON in the response (the model sometimes wraps it in ```json blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')
      extracted = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw text:', text)
      return new Response(
        JSON.stringify({ error: 'Failed to parse extraction result', raw: text }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log successful extraction for quota accounting and audit trail. We do
    // this AFTER the model returns so a 502/422 doesn't count against the cap.
    await supabase.from('activity_events').insert({
      agency_id: profile.agency_id,
      actor_id: profile.id,
      actor_kind: 'ai',
      action: 'extract_property_pdf',
      entity_type: 'property',
      severity: 'info',
      category: 'ai',
      metadata: {
        filename: filename ?? 'document.pdf',
        usage: null,
        usage_count: currentUsage + 1,
        quota,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: extracted,
        filename: filename ?? 'document.pdf',
        usage: null,
        quota: { current: currentUsage + 1, limit: quota, remaining: quota - currentUsage - 1 },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
