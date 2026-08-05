import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { requireAgencyLabCleared } from '../_shared/agency-lab-guard.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  partitionDilisenseHits,
  calculateRiskScore,
  type DilisenseRecord,
} from '../_shared/kyc-screening-core.ts'
import { reportEdgeError } from '../_shared/audit-edge-error.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface ScreeningRequest {
  kyc_case_id: string
  // contact_name et contact_nationality NE SONT PLUS LUS depuis le body.
  // Ils sont dérivés serveur-side de kyc_cases.contact_id pour empêcher
  // l'empoisonnement d'un dossier avec un nom arbitraire (red-team finding
  // A4 — voir audit 2026-05-19).
}

interface DilisenseResponse {
  total_hits: number
  found_records: DilisenseRecord[]
}

// Analyse KYC = screening déterministe Dilisense uniquement (aucune IA/Claude).

// FATF_HIGH_RISK_COUNTRIES / FATF_INCREASED_MONITORING / calculateRiskScore :
// déplacés VERBATIM dans ../_shared/kyc-screening-core.ts (helper pur, importé
// ci-dessus + figé par _shared/kyc-screening-core.test.ts). Comportement
// inchangé — surface compliance LBA.

// Comparaison à temps constant du secret service-role (anti timing-attack).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startedAt = Date.now()
  try {
    // ── Auth + agency check (red-team P0 — voir audit 2026-05-19) ─────────
    // Avant : `if (authHeader?.startsWith('Bearer '))` — string-match seul,
    // sans JWT verify. Combiné avec `--no-verify-jwt` global et un body
    // client-controlled, n'importe quel attaquant pouvait empoisonner un
    // dossier KYC arbitraire (BOLA + IDOR).
    // Maintenant : JWT vérifié + profile.agency_id chargé + vérification
    // que le kyc_case appartient bien à l'agence du caller.
    // Auth à deux chemins (D6) :
    //  - service-à-service (whatsapp-agent) : Authorization = clé service-role (comparée à
    //    temps constant) → agency depuis le body (fiable : seul notre backend a la clé).
    //  - utilisateur (CRM) : requireAgentAuth (JWT vérifié).
    // La garde cross-agency plus bas (preScreenCase.agency_id !== callerAgencyId) protège
    // les DEUX chemins contre l'accès au dossier d'une autre agence (BOLA/IDOR).
    // ⚠️ DÉPLOIEMENT : cette fonction DOIT rester déployée en --no-verify-jwt (cf.
    // deploy.yml). Le chemin service compare la clé lui-même ; activer verify_jwt
    // (ou ajouter kyc-screening à JWT_PROTECTED) ferait rejeter la clé service-role
    // (UNAUTHORIZED_LEGACY_JWT) et casserait le screening par WhatsApp — sans gain de
    // sécurité (les deux chemins s'auto-authentifient déjà).
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const providedKey = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const isServiceCall = serviceKey !== '' && safeEqual(providedKey, serviceKey)

    const { kyc_case_id, entity_type, agency_id: bodyAgencyId } = (await req.json()) as ScreeningRequest & {
      entity_type: 'individual' | 'entity'
      agency_id?: string
    }

    let supabaseClient: SupabaseClient
    let callerAgencyId: string
    if (isServiceCall) {
      if (!bodyAgencyId) {
        return new Response(
          JSON.stringify({ error: 'agency_id required for service call' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)
      callerAgencyId = bodyAgencyId
    } else {
      const auth = await requireAgentAuth(req, corsHeaders)
      if (auth instanceof Response) return auth
      supabaseClient = auth.supabase
      callerAgencyId = auth.profile.agency_id
    }

    // Garde LAB plein (étape 5, tâche 4) — voir _shared/agency-lab-guard.ts.
    // Placé AVANT même la vérification de configuration (DILISENSE_API_KEY,
    // plus bas) : une agence bloquée n'a pas à apprendre si le service est
    // correctement configuré ni si kyc_case_id existe. Vaut pour les DEUX
    // chemins (service-role compris) : un screening déclenché automatiquement
    // par whatsapp-agent reste une analyse PEP/sanctions réelle sur une
    // personne réelle, tout autant soumise à la posture de conformité que ce
    // garde porte qu'un clic agent.
    const labBlocked = await requireAgencyLabCleared(supabaseClient, callerAgencyId, corsHeaders)
    if (labBlocked) return labBlocked

    // La vérification de configuration ci-dessous est APRÈS l'authentification,
    // délibérément. Elle passait avant, et elle répond 500 : un appelant anonyme
    // obtenait donc « DILISENSE_API_KEY not configured » sans jamais
    // s'authentifier — l'état de configuration d'un service de conformité n'a pas
    // à fuiter, et un refus d'accès doit se lire 401. Personne ne s'en
    // apercevait : sous la passerelle locale l'appel n'arrivait pas jusqu'ici, et
    // en production la clé est présente. Le garde LAB s'insère encore avant elle,
    // pour la raison distincte donnée juste au-dessus.
    const apiKey = Deno.env.get('DILISENSE_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'DILISENSE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!kyc_case_id || !entity_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: kyc_case_id, entity_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (entity_type !== 'individual' && entity_type !== 'entity') {
      return new Response(
        JSON.stringify({ error: 'entity_type must be individual or entity' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sauvegarde des statuts pré-screening pour rollback en cas d'échec Dilisense.
    // En même temps : vérifie l'ownership cross-agency + dérive contact_name
    // et contact_nationality côté serveur (red-team finding A4 — empêche
    // l'agent d'écraser un dossier avec un nom arbitraire comme « Putin »).
    const { data: preScreenCase, error: preScreenErr } = await supabaseClient
      .from('kyc_cases')
      .select(
        'agency_id, contact_id, pep_status, sanctions_status, last_screening_at, contact_nationality, contact:contacts(first_name, last_name)',
      )
      .eq('id', kyc_case_id)
      .single<{
        agency_id: string
        contact_id: string
        pep_status: string | null
        sanctions_status: string | null
        last_screening_at: string | null
        contact_nationality: string | null
        contact: { first_name: string | null; last_name: string | null } | null
      }>()

    if (preScreenErr || !preScreenCase) {
      return new Response(
        JSON.stringify({ error: 'kyc_case_id not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (preScreenCase.agency_id !== callerAgencyId) {
      return new Response(
        JSON.stringify({ error: 'forbidden: cross-agency access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const contact_name = [
      preScreenCase.contact?.first_name?.trim() ?? '',
      preScreenCase.contact?.last_name?.trim() ?? '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
    if (!contact_name) {
      return new Response(
        JSON.stringify({ error: 'Contact name missing on this kyc_case' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Nationalité stockée sur le kyc_case (peut être null si l'agent ne l'a
    // pas encore renseignée dans le wizard — fallback CH par défaut).
    const contact_nationality = preScreenCase.contact_nationality ?? 'CH'

    // Idempotence : refuse un re-screening si l'agent a cliqué il y a moins de 60s.
    // Évite la double-facturation Dilisense sur clic spam.
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
      .eq('agency_id', callerAgencyId)

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
        .eq('agency_id', callerAgencyId)
      throw dilisenseErr
    }

    // Partition PEP / Sanctions + dérivation statut/détails (helper pur testé).
    const { pepRecords, sanctionRecords, pepStatus, sanctionsStatus, pepDetails, sanctionsDetails } =
      partitionDilisenseHits(dilisenseData.found_records)

    // Get current case for risk calculation
    const { data: currentCase } = await supabaseClient
      .from('kyc_cases')
      .select('type, completion_pct, transaction_amount')
      .eq('id', kyc_case_id)
      .eq('agency_id', callerAgencyId)
      .single()

    const riskResult = calculateRiskScore({
      contactNationality: contact_nationality || 'CH',
      pepMatch: pepRecords.length > 0,
      transactionAmount: currentCase?.transaction_amount ?? 0,
      kycType: currentCase?.type ?? 'buyer_pp',
      completionPct: currentCase?.completion_pct ?? 0,
    })

    const riskLevel = riskResult.level

    // Screening KYC = Dilisense déterministe uniquement. La couche d'analyse IA
    // contextuelle (anciennement Claude Sonnet) a été RETIRÉE : Claude est banni
    // (résidence nLPD + décision « DeepSeek texte / Gemini vision de bout en bout »).
    // Le rapport masque déjà la section « Analyse de risque » quand ai_analysis
    // est null (buildReportData.ts / PdfPage2.tsx) : aucune régression, le
    // screening factuel + la revue humaine MLRO sont inchangés.
    const aiAnalysis = null

    // Update kyc_cases
    const { error: updateError } = await supabaseClient
      .from('kyc_cases')
      .update({
        pep_status: pepStatus,
        pep_details: pepDetails,
        sanctions_status: sanctionsStatus,
        sanctions_details: sanctionsDetails,
        last_screening_at: new Date().toISOString(),
        // NE JAMAIS persister la nationalité DÉFAUT-ÉE : `contact_nationality` vaut
        // déjà `?? 'CH'` (fallback local pour le calcul de risque). L'écrire en base
        // inventerait une nationalité suisse pour un contact dont elle est inconnue —
        // ça corrompt le dossier LBA et le rapport. On réécrit l'ORIGINAL (null compris).
        contact_nationality: preScreenCase.contact_nationality,
        risk_score: riskResult.score,
        risk_factors: riskResult.factors,
        risk_level: riskLevel,
        ai_analysis: aiAnalysis,
      })
      .eq('id', kyc_case_id)
      .eq('agency_id', callerAgencyId)

    if (updateError) throw updateError

    // Log activity event
    const { data: kycCase } = await supabaseClient
      .from('kyc_cases')
      .select('agency_id')
      .eq('id', kyc_case_id)
      .eq('agency_id', callerAgencyId)
      .single()

    if (kycCase) {
      await supabaseClient.from('activity_events').insert({
        agency_id: kycCase.agency_id,
        actor_id: null,
        actor_kind: 'ai',
        action: 'kyc_screening',
        // `category` manquait : la ligne sortait donc des puces du Live et des filtres
        // de la console, alors qu'un screening est précisément ce qu'on veut y retrouver.
        category: 'kyc',
        entity_type: 'kyc',
        entity_id: kyc_case_id,
        metadata: {
          providers: ['dilisense'],
          dilisense: {
            total_hits: dilisenseData.total_hits,
            pep_hits: pepRecords.length,
            sanctions_hits: sanctionRecords.length,
          },
          quant_risk_score: riskResult.score,
          quant_risk_level: riskLevel,
          ai_qualitative_risk: null,
          ai_vigilance_reco: null,
          ai_patterns_detected: null,
        },
      })

      // Un screening qui trouve quelque chose n'est pas le même événement qu'un
      // screening qui tourne. `kyc_screening` reste la trace « ça a tourné »
      // (gravité info, complétude de la piste LBA) ; le match sort à part, en
      // `critical`, parce que c'est lui qu'un super-admin doit voir sans le
      // chercher — la console le connaît depuis toujours sous ce nom mais rien
      // ne l'émettait.
      //
      // Aucune décision n'est prise ici : un match Dilisense est un signalement
      // à réviser par le MLRO, pas un verdict. Le screening reste facultatif et
      // non bloquant.
      const hits = pepRecords.length + sanctionRecords.length
      if (hits > 0) {
        await supabaseClient.from('activity_events').insert({
          agency_id: kycCase.agency_id,
          actor_id: null,
          actor_kind: 'ai',
          action: 'kyc_screening_match',
          entity_type: 'kyc',
          entity_id: kyc_case_id,
          category: 'kyc',
          severity: 'critical',
          metadata: {
            pep_hits: pepRecords.length,
            sanctions_hits: sanctionRecords.length,
            pep_status: pepStatus,
            sanctions_status: sanctionsStatus,
            quant_risk_level: riskLevel,
          },
        })
      }
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

    // Les deux chemins d'authentification sortent en `return` (clé service
    // comparée à temps constant, ou requireAgentAuth qui RENVOIE sa Response) :
    // un appelant non autorisé n'atteint jamais ce catch et ne peut donc pas
    // faire écrire de ligne d'audit. `supabaseClient` est déclaré dans le try,
    // hors de portée ici — on rouvre un client service-role.
    await reportEdgeError(
      createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
      'kyc-screening',
      err,
      { startedAt },
    )

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
