import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScreeningRequest {
  kyc_case_id: string
  contact_name: string
  contact_nationality: string
  entity_type: 'individual' | 'entity'
}

interface DilisenseRecord {
  source_type: string
  name: string
  source_id: string
  [key: string]: unknown
}

interface DilisenseResponse {
  total_hits: number
  found_records: DilisenseRecord[]
}

interface RiskFactor {
  id: string
  label: string
  level: 'low' | 'medium' | 'high'
  detail: string
  points: number
}

// ── Sprint 4.5 — Analyse contextuelle Claude Sonnet 4 ────────────────────────

type SonnetQualitativeRisk = 'low' | 'medium' | 'high' | 'critical'
type SonnetVigilanceReco = 'standard' | 'renforced' | 'escalation_mlro'

interface SonnetAnalysisResult {
  provider: string
  analyzed_at: string
  qualitative_risk: SonnetQualitativeRisk
  vigilance_recommendation: SonnetVigilanceReco
  patterns_detected: string[]
  justification: string
  additional_checks_suggested: string[]
  // `null` si Sonnet n'a pas renvoyé un nombre exploitable —
  // évite l'affichage trompeur "Confiance IA: 50%" alors qu'elle est inconnue.
  confidence: number | null
  prompt_tokens?: number
  completion_tokens?: number
}

interface SonnetAnalysisInput {
  anthropicKey: string | undefined
  contactName: string
  contactNationality: string | null
  entityType: 'individual' | 'entity'
  kycType: string
  transactionAmount: number
  completionPct: number
  dilisenseResult: {
    totalHits: number
    pepHits: number
    sanctionsHits: number
    pepRecords: DilisenseRecord[]
    sanctionRecords: DilisenseRecord[]
  }
  quantScore: number
  quantLevel: 'low' | 'medium' | 'high'
}

/**
 * Appelle Claude Sonnet 4 pour produire une analyse contextuelle qualitative
 * en complément du screening factuel Dilisense.
 *
 * Graceful degradation : retourne `null` si :
 *  - ANTHROPIC_API_KEY n'est pas configuré (env var manquante)
 *  - L'API Anthropic est down / timeout / 5xx
 *  - La réponse n'est pas parsable en JSON structuré
 *
 * Dans tous ces cas, le screening Dilisense factuel continue normalement.
 * Sonnet ne BLOQUE jamais le pipeline KYC.
 */
async function analyzeWithSonnet(input: SonnetAnalysisInput): Promise<SonnetAnalysisResult | null> {
  if (!input.anthropicKey) {
    return null
  }

  const systemPrompt = `Tu es un compliance officer LBA Suisse expert en analyse de risque KYC immobilier.
Ton rôle est d'analyser un dossier KYC en complément du screening Dilisense (qui interroge les listes officielles OFAC/SECO/UE/ONU).

Tu produis une analyse CONTEXTUELLE qualitative qui complète (sans remplacer) la couche factuelle Dilisense.

Tu réponds STRICTEMENT en JSON, sans markdown, sans texte avant/après. Format :
{
  "qualitative_risk": "low" | "medium" | "high" | "critical",
  "vigilance_recommendation": "standard" | "renforced" | "escalation_mlro",
  "patterns_detected": ["pattern_id_1", "pattern_id_2"],
  "justification": "Texte 2-3 phrases en français expliquant la décision",
  "additional_checks_suggested": ["Check 1", "Check 2"],
  "confidence": 0.0 to 1.0
}

Patterns à détecter (liste non exhaustive) :
- structuring : tentative de fragmentation pour échapper aux seuils LBA
- unusual_pattern : profil/montant/nationalité incohérents
- high_risk_jurisdiction : pays GAFI haut risque ou sanctions
- pep_proxy : risque que la personne soit un proxy d'un PEP
- corporate_layering : structure entreprise opaque (PM avec UBO peu clairs)
- crypto_origin : origine crypto suspectée (si applicable au type immobilier)

Articles LBA pertinents : art. 3 (identification), art. 4 (UBO), art. 6 (vigilance renforcée),
art. 7 (documentation), art. 9 (signalement MROS).`

  const userPrompt = `Analyse ce dossier KYC :

CONTACT :
- Nom : ${input.contactName}
- Nationalité : ${input.contactNationality ?? 'non renseignée'}
- Type entité : ${input.entityType}
- Type KYC : ${input.kycType}

TRANSACTION :
- Montant : CHF ${input.transactionAmount.toLocaleString('fr-CH')}
- Complétude dossier : ${input.completionPct}%

SCREENING DILISENSE (factuel, listes officielles) :
- Hits total : ${input.dilisenseResult.totalHits}
- PEP hits : ${input.dilisenseResult.pepHits}
- Sanctions hits : ${input.dilisenseResult.sanctionsHits}
${input.dilisenseResult.pepRecords.length > 0
    ? `- PEP records :\n${input.dilisenseResult.pepRecords.map(r => `  - ${r.name} (${r.source_type}, id=${r.source_id})`).join('\n')}`
    : ''}
${input.dilisenseResult.sanctionRecords.length > 0
    ? `- Sanctions records :\n${input.dilisenseResult.sanctionRecords.map(r => `  - ${r.name} (${r.source_type}, id=${r.source_id})`).join('\n')}`
    : ''}

SCORE QUANTITATIF ALGO :
- Score : ${input.quantScore}/100
- Niveau : ${input.quantLevel}

Produis ton analyse JSON.`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': input.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    clearTimeout(timeoutId)

    if (!resp.ok) {
      console.error('Sonnet API error:', resp.status, await resp.text())
      return null
    }

    const data = await resp.json()
    const text: string = data?.content?.[0]?.text ?? ''
    const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, '')
    const parsed = JSON.parse(cleaned)

    // Validation minimale du shape retourné
    if (!parsed.qualitative_risk || !parsed.vigilance_recommendation) {
      console.error('Sonnet response missing required fields:', parsed)
      return null
    }

    return {
      provider: 'claude-sonnet-4-6',
      analyzed_at: new Date().toISOString(),
      qualitative_risk: parsed.qualitative_risk,
      vigilance_recommendation: parsed.vigilance_recommendation,
      patterns_detected: Array.isArray(parsed.patterns_detected) ? parsed.patterns_detected : [],
      justification: typeof parsed.justification === 'string' ? parsed.justification : '',
      additional_checks_suggested: Array.isArray(parsed.additional_checks_suggested)
        ? parsed.additional_checks_suggested
        : [],
      confidence:
        typeof parsed.confidence === 'number' &&
        parsed.confidence >= 0 &&
        parsed.confidence <= 1
          ? parsed.confidence
          : null,
      prompt_tokens: data?.usage?.input_tokens,
      completion_tokens: data?.usage?.output_tokens,
    }
  } catch (err) {
    console.error('Sonnet analysis failed:', err instanceof Error ? err.message : err)
    return null
  }
}

const FATF_HIGH_RISK_COUNTRIES = ['AF', 'KP', 'IR', 'MM', 'SY', 'YE', 'RU', 'BY']
const FATF_INCREASED_MONITORING = [
  'BF', 'CM', 'CD', 'HT', 'KE', 'ML', 'MZ', 'NG',
  'PH', 'SN', 'ZA', 'SS', 'TZ', 'VN',
]

function calculateRiskScore(input: {
  contactNationality: string
  pepMatch: boolean
  transactionAmount: number
  kycType: string
  completionPct: number
}): { score: number; level: 'low' | 'medium' | 'high'; factors: RiskFactor[] } {
  const factors: RiskFactor[] = []
  const nat = input.contactNationality.toUpperCase()

  // 1. Nationality (0-25 pts)
  if (FATF_HIGH_RISK_COUNTRIES.includes(nat)) {
    factors.push({ id: 'nationality', label: 'Nationalité', level: 'high', detail: `Pays à haut risque GAFI (${nat})`, points: 25 })
  } else if (FATF_INCREASED_MONITORING.includes(nat)) {
    factors.push({ id: 'nationality', label: 'Nationalité', level: 'medium', detail: `Pays sous surveillance renforcée GAFI (${nat})`, points: 15 })
  } else {
    factors.push({ id: 'nationality', label: 'Nationalité', level: 'low', detail: nat === 'CH' ? 'Suisse' : `Pays standard (${nat})`, points: 0 })
  }

  // 2. PEP (0-25 pts)
  if (input.pepMatch) {
    factors.push({ id: 'pep', label: 'Statut PEP', level: 'high', detail: 'Correspondance PEP détectée', points: 25 })
  } else {
    factors.push({ id: 'pep', label: 'Statut PEP', level: 'low', detail: 'Aucune correspondance PEP', points: 0 })
  }

  // 3. Amount (0-20 pts)
  if (input.transactionAmount > 5_000_000) {
    factors.push({ id: 'amount', label: 'Montant transaction', level: 'high', detail: `> CHF 5'000'000`, points: 20 })
  } else if (input.transactionAmount > 2_000_000) {
    factors.push({ id: 'amount', label: 'Montant transaction', level: 'medium', detail: `> CHF 2'000'000`, points: 10 })
  } else {
    factors.push({ id: 'amount', label: 'Montant transaction', level: 'low', detail: `< CHF 2'000'000`, points: 0 })
  }

  // 4. Entity type (0-15 pts)
  if (input.kycType.includes('_pm')) {
    factors.push({ id: 'entity', label: "Type d'entité", level: 'medium', detail: 'Personne morale — structure à vérifier (UBO)', points: 15 })
  } else {
    factors.push({ id: 'entity', label: "Type d'entité", level: 'low', detail: 'Personne physique', points: 0 })
  }

  // 5. Documents (0-15 pts)
  if (input.completionPct < 50) {
    factors.push({ id: 'docs', label: 'Documents', level: 'high', detail: `${input.completionPct}% complété`, points: 15 })
  } else if (input.completionPct < 80) {
    factors.push({ id: 'docs', label: 'Documents', level: 'medium', detail: `${input.completionPct}% complété`, points: 8 })
  } else {
    factors.push({ id: 'docs', label: 'Documents', level: 'low', detail: `${input.completionPct}% complété`, points: 0 })
  }

  const score = factors.reduce((sum, f) => sum + f.points, 0)
  const level = score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low'
  return { score, level, factors }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth check ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('DILISENSE_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'DILISENSE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    const { kyc_case_id, contact_name, contact_nationality, entity_type } =
      (await req.json()) as ScreeningRequest

    if (!kyc_case_id || !contact_name || !entity_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: kyc_case_id, contact_name, entity_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sauvegarde des statuts pré-screening pour rollback en cas d'échec Dilisense.
    // Sans cette sauvegarde, un crash Dilisense laisse le dossier figé en `pending`.
    const { data: preScreenCase } = await supabaseClient
      .from('kyc_cases')
      .select('pep_status, sanctions_status, last_screening_at')
      .eq('id', kyc_case_id)
      .single()

    // Idempotence : refuse un re-screening si l'agent a cliqué il y a moins de 60s.
    // Évite la double-facturation Dilisense / Anthropic sur clic spam.
    if (preScreenCase?.last_screening_at) {
      const lastMs = new Date(preScreenCase.last_screening_at).getTime()
      if (Date.now() - lastMs < 60_000) {
        return new Response(
          JSON.stringify({
            error: 'Screening déjà effectué il y a moins d\'une minute. Réessayez dans quelques secondes.',
            retry_after_ms: 60_000 - (Date.now() - lastMs),
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const previousPepStatus = preScreenCase?.pep_status ?? 'not_checked'
    const previousSanctionsStatus = preScreenCase?.sanctions_status ?? 'not_checked'

    // Set status to pending during screening
    await supabaseClient
      .from('kyc_cases')
      .update({ pep_status: 'pending', sanctions_status: 'pending' })
      .eq('id', kyc_case_id)

    // Call dilisense API avec timeout 15s (symétrie avec Sonnet 30s).
    // En cas de timeout, fetch lève une AbortError → catch → rollback.
    const endpoint = entity_type === 'individual' ? 'checkIndividual' : 'checkEntity'
    const encodedName = encodeURIComponent(contact_name)
    const dilisenseUrl = `https://api.dilisense.com/v1/${endpoint}?names=${encodedName}&fuzzy_search=1`

    let dilisenseData: DilisenseResponse
    try {
      const dilisenseController = new AbortController()
      const dilisenseTimeout = setTimeout(() => dilisenseController.abort(), 15_000)
      const dilisenseRes = await fetch(dilisenseUrl, {
        headers: { 'x-api-key': apiKey },
        signal: dilisenseController.signal,
      })
      clearTimeout(dilisenseTimeout)

      if (!dilisenseRes.ok) {
        const errText = await dilisenseRes.text()
        throw new Error(`Dilisense API error: ${dilisenseRes.status} ${errText}`)
      }
      dilisenseData = await dilisenseRes.json()
    } catch (dilisenseErr) {
      // Rollback : restaure les statuts précédents pour ne pas figer le dossier
      // en `pending` indéfiniment (l'agent peut alors retenter manuellement).
      await supabaseClient
        .from('kyc_cases')
        .update({
          pep_status: previousPepStatus,
          sanctions_status: previousSanctionsStatus,
        })
        .eq('id', kyc_case_id)
      throw dilisenseErr
    }

    // Separate PEP and Sanctions hits
    const pepRecords = dilisenseData.found_records.filter(
      (r) => r.source_type === 'PEP'
    )
    const sanctionRecords = dilisenseData.found_records.filter(
      (r) => r.source_type === 'SANCTION'
    )

    const pepStatus = pepRecords.length > 0 ? 'match' : 'clear'
    const sanctionsStatus = sanctionRecords.length > 0 ? 'match' : 'clear'

    const pepDetails = pepRecords.length > 0
      ? { total: pepRecords.length, records: pepRecords.slice(0, 5) }
      : null
    const sanctionsDetails = sanctionRecords.length > 0
      ? { total: sanctionRecords.length, records: sanctionRecords.slice(0, 5) }
      : null

    // Get current case for risk calculation
    const { data: currentCase } = await supabaseClient
      .from('kyc_cases')
      .select('type, completion_pct, transaction_amount')
      .eq('id', kyc_case_id)
      .single()

    const riskResult = calculateRiskScore({
      contactNationality: contact_nationality || 'CH',
      pepMatch: pepRecords.length > 0,
      transactionAmount: currentCase?.transaction_amount ?? 0,
      kycType: currentCase?.type ?? 'buyer_pp',
      completionPct: currentCase?.completion_pct ?? 0,
    })

    const riskLevel = riskResult.level

    // ── Sprint 4.5 — Couche IA Claude Sonnet 4 (analyse contextuelle) ───────
    // Optionnelle : si ANTHROPIC_API_KEY absent ou API plante, on continue
    // sans bloquer le screening Dilisense factuel.
    const aiAnalysis = await analyzeWithSonnet({
      anthropicKey: Deno.env.get('ANTHROPIC_API_KEY'),
      contactName: contact_name,
      contactNationality: contact_nationality || null,
      entityType: entity_type,
      kycType: currentCase?.type ?? 'buyer_pp',
      transactionAmount: currentCase?.transaction_amount ?? 0,
      completionPct: currentCase?.completion_pct ?? 0,
      dilisenseResult: {
        totalHits: dilisenseData.total_hits,
        pepHits: pepRecords.length,
        sanctionsHits: sanctionRecords.length,
        pepRecords: pepRecords.slice(0, 5),
        sanctionRecords: sanctionRecords.slice(0, 5),
      },
      quantScore: riskResult.score,
      quantLevel: riskResult.level,
    })

    // Update kyc_cases
    const { error: updateError } = await supabaseClient
      .from('kyc_cases')
      .update({
        pep_status: pepStatus,
        pep_details: pepDetails,
        sanctions_status: sanctionsStatus,
        sanctions_details: sanctionsDetails,
        last_screening_at: new Date().toISOString(),
        contact_nationality: contact_nationality || null,
        risk_score: riskResult.score,
        risk_factors: riskResult.factors,
        risk_level: riskLevel,
        ai_analysis: aiAnalysis,
      })
      .eq('id', kyc_case_id)

    if (updateError) throw updateError

    // Log activity event
    const { data: kycCase } = await supabaseClient
      .from('kyc_cases')
      .select('agency_id')
      .eq('id', kyc_case_id)
      .single()

    if (kycCase) {
      await supabaseClient.from('activity_events').insert({
        agency_id: kycCase.agency_id,
        actor_id: null,
        actor_kind: 'ai',
        action: 'kyc_screening',
        entity_type: 'kyc',
        entity_id: kyc_case_id,
        metadata: {
          providers: aiAnalysis ? ['dilisense', 'claude-sonnet-4-6'] : ['dilisense'],
          dilisense: {
            total_hits: dilisenseData.total_hits,
            pep_hits: pepRecords.length,
            sanctions_hits: sanctionRecords.length,
          },
          quant_risk_score: riskResult.score,
          quant_risk_level: riskLevel,
          ai_qualitative_risk: aiAnalysis?.qualitative_risk ?? null,
          ai_vigilance_reco: aiAnalysis?.vigilance_recommendation ?? null,
          ai_patterns_detected: aiAnalysis?.patterns_detected ?? null,
        },
      })
    }

    return new Response(
      JSON.stringify({
        pep_status: pepStatus,
        pep_hits: pepRecords.length,
        sanctions_status: sanctionsStatus,
        sanctions_hits: sanctionRecords.length,
        total_hits: dilisenseData.total_hits,
        risk_score: riskResult.score,
        risk_level: riskLevel,
        ai_analysis: aiAnalysis,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
