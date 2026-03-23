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

    // Set status to pending during screening
    await supabaseClient
      .from('kyc_cases')
      .update({ pep_status: 'pending', sanctions_status: 'pending' })
      .eq('id', kyc_case_id)

    // Call dilisense API
    const endpoint = entity_type === 'individual' ? 'checkIndividual' : 'checkEntity'
    const encodedName = encodeURIComponent(contact_name)
    const dilisenseUrl = `https://api.dilisense.com/v1/${endpoint}?names=${encodedName}&fuzzy_search=1`

    const dilisenseRes = await fetch(dilisenseUrl, {
      headers: { 'x-api-key': apiKey },
    })

    if (!dilisenseRes.ok) {
      const errText = await dilisenseRes.text()
      throw new Error(`Dilisense API error: ${dilisenseRes.status} ${errText}`)
    }

    const dilisenseData: DilisenseResponse = await dilisenseRes.json()

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
        actor_id: 'ai',
        action: 'kyc_screening',
        entity_type: 'kyc',
        entity_id: kyc_case_id,
        metadata: {
          provider: 'dilisense',
          total_hits: dilisenseData.total_hits,
          pep_hits: pepRecords.length,
          sanctions_hits: sanctionRecords.length,
          risk_score: riskResult.score,
          risk_level: riskLevel,
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
