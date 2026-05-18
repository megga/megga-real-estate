// supabase/functions/email-classifier/index.ts
// Tier 3 mail/calendar — classification IA d'un email entrant.
//
// Reçoit le metadata + body d'un email, demande à Claude :
//   - classification : lead_chaud | lead_tiede | question_simple | spam | interne
//   - priority : 0-100 (urgence + valeur business)
//   - intents : array d'intentions détectées
//   - suggested_replies : 2-3 brouillons de réponse adaptés au contexte
//
// Persiste le résultat dans email_messages_cache pour éviter de re-classifier.
// Coût indicatif : ~500-800 tokens input + 400 output par message.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor } from '../_shared/integration-helpers.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

interface RequestBody {
  /** Provider du message (gmail | outlook) — pour identifier la ligne cache */
  provider: 'gmail' | 'outlook'
  /** ID externe du message (Gmail messages.id ou Graph message.id) */
  external_message_id: string
  /** Métadonnées du message à classifier */
  from_address: string
  from_name?: string
  subject: string
  snippet: string
  body_text?: string
}

interface ClassifierResult {
  classification: 'lead_chaud' | 'lead_tiede' | 'question_simple' | 'spam' | 'interne'
  priority: number
  intents: string[]
  suggested_replies: Array<{ label: string; body: string }>
}

const SYSTEM_PROMPT = `Tu es l'assistant IA de MEGGA Real Estate, un CRM transactionnel suisse pour agents immobiliers.

Tu reçois un email entrant. Tu dois :
1. **Classer** le message dans EXACTEMENT une des 5 catégories :
   - lead_chaud : intérêt confirmé (visite demandée, offre exprimée, prix discuté)
   - lead_tiede : intérêt initial (renseignements, première prise de contact)
   - question_simple : question administrative, demande d'info pratique
   - spam : démarchage commercial non sollicité, phishing, hors sujet immobilier
   - interne : email entre membres de l'agence ou administration interne MEGGA

2. **Scorer** la priorité de 0 à 100. Un lead chaud avec offre concrète = 85-100. Un spam = 0-10.

3. **Détecter les intentions** parmi : request_visit, ask_price, ask_documents, negative_signal,
   reschedule, accept_offer, decline_offer, propose_counter_offer, ask_features, general_inquiry.

4. **Proposer 2 brouillons de réponse** courts (4-6 lignes max chacun), en français, ton professionnel
   et chaleureux suisse. Pas de signature (l'agent l'ajoutera automatiquement).

Réponds UNIQUEMENT en JSON valide selon ce schéma exact, sans backticks ni explication :
{
  "classification": "lead_chaud|lead_tiede|question_simple|spam|interne",
  "priority": <0-100>,
  "intents": ["intent1", "intent2"],
  "suggested_replies": [
    { "label": "Réponse 1 — courte description", "body": "Bonjour..." },
    { "label": "Réponse 2 — courte description", "body": "Bonjour..." }
  ]
}`

serve(async (req: Request) => {
  const corsHeaders = corsHeadersFor(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY non configurée')
    }

    const body: RequestBody = await req.json()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    // Récup user pour scope du cache
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Si déjà classifié dans les 24h, on retourne le cache sans re-spend des tokens
    const { data: cached } = await db
      .from('email_messages_cache')
      .select('ai_classification, ai_priority, ai_intents, ai_suggested_replies, ai_classified_at')
      .eq('user_id', user.id)
      .eq('provider', body.provider)
      .eq('external_message_id', body.external_message_id)
      .single()

    if (cached?.ai_classified_at) {
      const ageMs = Date.now() - new Date(cached.ai_classified_at).getTime()
      if (ageMs < 24 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({
          classification: cached.ai_classification,
          priority: cached.ai_priority,
          intents: cached.ai_intents ?? [],
          suggested_replies: cached.ai_suggested_replies ?? [],
          cached: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Préparation du prompt — on tronque le body pour limiter les tokens
    const truncatedBody = (body.body_text ?? body.snippet ?? '').slice(0, 3000)
    const userContent = `From: ${body.from_name ?? ''} <${body.from_address}>
Subject: ${body.subject}

${truncatedBody}`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      throw new Error(`Claude API ${claudeRes.status}: ${err}`)
    }

    const claudeData = await claudeRes.json()
    const rawText: string = claudeData.content?.[0]?.text ?? ''

    // Parse le JSON renvoyé par Claude. Tolère un éventuel wrapping ```json ... ```
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    let parsed: ClassifierResult
    try {
      parsed = JSON.parse(cleaned)
    } catch (e) {
      throw new Error(`Claude returned non-JSON: ${cleaned.slice(0, 200)}`)
    }

    // Validation rudimentaire
    const validClasses = ['lead_chaud', 'lead_tiede', 'question_simple', 'spam', 'interne']
    if (!validClasses.includes(parsed.classification)) {
      parsed.classification = 'question_simple'
    }
    if (typeof parsed.priority !== 'number' || parsed.priority < 0 || parsed.priority > 100) {
      parsed.priority = 50
    }
    if (!Array.isArray(parsed.intents)) parsed.intents = []
    if (!Array.isArray(parsed.suggested_replies)) parsed.suggested_replies = []

    // Persiste dans email_messages_cache (si la ligne existe — sinon skip silencieux)
    await db.from('email_messages_cache')
      .update({
        ai_classification: parsed.classification,
        ai_priority: parsed.priority,
        ai_intents: parsed.intents,
        ai_suggested_replies: parsed.suggested_replies,
        ai_classified_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provider', body.provider)
      .eq('external_message_id', body.external_message_id)

    return new Response(JSON.stringify({ ...parsed, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' } },
    )
  }
})
