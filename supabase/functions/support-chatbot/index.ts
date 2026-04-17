// supabase/functions/support-chatbot/index.ts
// MEGGA AI Support — DeepSeek V3 (fallback Claude Haiku 4.5)
// Tier-1 support chatbot: answers help questions, suggests articles, escalates to tickets

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { callPublicAI } from '../_shared/ai-provider.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SupportRequest {
  message: string
  history?: ChatMessage[]
  language?: 'fr' | 'de' | 'en' | 'it'
  articlesContext?: string
}

// ── System prompt ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es l'assistant support de MEGGA, une plateforme immobilière suisse AI-native.

RÔLE : Répondre aux questions des utilisateurs (agents immobiliers, vendeurs, acheteurs) sur la plateforme MEGGA. Tu es amical, concis et précis.

RÈGLES STRICTES :
- Réponds en 150 mots maximum
- Cite les articles pertinents avec des liens markdown : [Titre de l'article](/aide/category/slug)
- Si tu ne connais pas la réponse → dis "Je n'ai pas trouvé de réponse précise" et suggère d'envoyer un ticket
- Ne jamais inventer de fonctionnalités qui n'existent pas
- Ne jamais donner de conseils juridiques ou financiers
- Formater les prix en CHF avec apostrophe suisse : CHF 720'000
- Dates au format suisse : DD.MM.YYYY

FONCTIONNALITÉS MEGGA QUE TU CONNAIS :
- CRM : contacts, pipeline 14 étapes, matching acheteurs↔biens, timeline unifiée
- KYC : dossiers conformité LAB, screening PEP/Sanctions (dilisense), score de risque, human-in-the-loop
- IA : copilote MEGGA AI (résumé client, relance, analyse marché), scores buyer/seller intelligence, virtual staging
- Biens : création (4 méthodes : manuelle, duplication, URL, PDF), plan interactif, photos tagging par pièce
- Communication : messagerie interne, calendrier avec sync Google/Outlook, rappels J-1
- Portail vendeur : accès tokénisé sans login, suivi visites/offres/documents/messages/analyse marché
- Acheteurs : recherche 38K biens, 3 modes (grille/split/carte), filtres CECB, isochrone, calculateur accessibilité suisse, favoris, alertes email
- Page /vendre : wizard estimation IA → lead CRM agent
- Plans : Starter (gratuit), Pro (CHF 89/mois), Agency (CHF 249/mois)

CONTEXTE ARTICLES DISPONIBLES (slug → titre) :
{ARTICLES_CONTEXT}

Quand tu cites un article, utilise le format : [Titre](/aide/category/slug)

À la fin de ta réponse, ajoute une ligne JSON sur une nouvelle ligne (le frontend la parsera) :
SUGGESTED:[{"slug":"xxx","title":"xxx","category":"xxx"}]

Si la question nécessite un humain ou est hors scope, ajoute :
ESCALATE:true`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, history = [], language = 'fr', articlesContext = '' }: SupportRequest = await req.json()

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Missing message' }), { status: 400, headers: corsHeaders })
    }

    if (!Deno.env.get('DEEPSEEK_API_KEY') && !Deno.env.get('ANTHROPIC_API_KEY')) {
      return new Response(JSON.stringify({ error: 'AI provider not configured' }), { status: 500, headers: corsHeaders })
    }

    // Build system prompt with articles context
    const systemPrompt = SYSTEM_PROMPT.replace('{ARTICLES_CONTEXT}', articlesContext)

    // Build messages array
    const messages = [
      ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ]

    // Add language instruction if not French
    const langInstruction = language !== 'fr'
      ? `\n\nRéponds en ${language === 'de' ? 'allemand' : language === 'en' ? 'anglais' : language === 'it' ? 'italien' : 'français'}.`
      : ''

    let aiResult
    try {
      aiResult = await callPublicAI(messages, systemPrompt + langInstruction, { maxTokens: 500 })
    } catch (err) {
      console.error('AI provider error:', err)
      return new Response(JSON.stringify({ error: 'AI service error' }), { status: 502, headers: corsHeaders })
    }

    const rawResponse = aiResult.text || ''

    // Parse suggested articles
    let suggestedArticles: { slug: string; title: string; category: string }[] = []
    let shouldEscalate = false
    let cleanResponse = rawResponse

    // Extract SUGGESTED line (defensive: DeepSeek may omit the tags)
    try {
      const suggestedMatch = rawResponse.match(/SUGGESTED:\[.*\]/)
      if (suggestedMatch) {
        suggestedArticles = JSON.parse(suggestedMatch[0].replace('SUGGESTED:', ''))
        cleanResponse = cleanResponse.replace(/\nSUGGESTED:\[.*\]/, '').trim()
      }
    } catch { /* missing or malformed tag → empty suggestions, no crash */ }

    // Extract ESCALATE line
    if (rawResponse.includes('ESCALATE:true')) {
      shouldEscalate = true
      cleanResponse = cleanResponse.replace(/\nESCALATE:true/, '').trim()
    }

    return new Response(JSON.stringify({
      response: cleanResponse,
      suggestedArticles,
      shouldEscalate,
      provider: aiResult.provider,
      was_fallback: aiResult.was_fallback,
      usage: {
        input_tokens: aiResult.input_tokens,
        output_tokens: aiResult.output_tokens,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('support-chatbot error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
