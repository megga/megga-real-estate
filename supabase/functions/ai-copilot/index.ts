// supabase/functions/ai-copilot/index.ts
// Copilote IA agent — chat libre + actions structurées

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CopilotAction =
  | 'chat'
  | 'summarize_contact'
  | 'suggest_next_action'
  | 'draft_email'
  | 'draft_description'
  | 'analyze_kyc'
  | 'score_lead'
  | 'analyze_market'
  | 'detect_intent'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface CopilotRequest {
  action: CopilotAction
  message: string
  context?: Record<string, unknown>
  history?: ChatMessage[]
  language?: 'fr' | 'de' | 'en' | 'it'
}

const MEGGA_SYSTEM = `Tu es MEGGA AI, le copilote intelligent de la plateforme MEGGA Real Estate — un CRM immobilier suisse.

TON RÔLE :
Tu assistes les agents immobiliers (courtiers) suisses dans leur quotidien. Tu es expert en :
- Transactions immobilières suisses (résidentiel, prestige, commercial)
- Conformité LAB/KYC (Loi sur le blanchiment d'argent)
- Rédaction immobilière professionnelle (annonces, emails, relances)
- Analyse de marché (prix au m², comparables, positionnement)
- Gestion de pipeline (qualification leads, next-best-action, relances)
- Négociation immobilière (stratégie de contre-offre, timing)

TON STYLE :
- Concis et actionnable — pas de blabla, des réponses utiles
- Professionnel mais chaleureux — comme un collègue senior
- Toujours en français sauf si on te demande autrement
- Utilise le format Markdown : **gras**, listes à puces, émojis sparingly
- Monnaie : CHF avec apostrophe suisse (CHF 720'000)
- Dates : format suisse (16.03.2026)

RÈGLES :
- Tu es une ASSISTANCE, pas une décision. L'agent décide toujours.
- Tu ne valides JAMAIS un dossier KYC — tu analyses et recommandes, l'humain valide.
- Tu ne contactes JAMAIS un client directement — tu prépares, l'agent envoie.
- Tes scores et estimations sont indicatifs — toujours mentionner "estimation IA".
- Si on te demande quelque chose hors immobilier suisse, tu restes poli mais tu recentres.

MÉMOIRE CONTEXTUELLE :
Tu reçois le contexte CRM complet du client actif (profil, interactions, biens envoyés, visites, feedbacks, transactions, notes).
- UTILISE ces données pour personnaliser chaque réponse. Mentionne des détails spécifiques (dates, biens, feedbacks).
- Pour un résumé : base-toi sur les VRAIES interactions, pas des généralités.
- Pour une relance : référence la dernière visite ou le dernier bien envoyé. Propose 1-2 biens du matching si disponibles.
- Pour une suggestion : prends en compte l'historique complet (refus, préférences implicites, timing).
- Si le contexte est vide ou absent, réponds de manière générale mais signale que tu manques de données.`

const ACTION_PROMPTS: Record<string, string> = {
  summarize_contact: `Résume le profil et l'historique de ce contact en 3-5 points clés basés sur les VRAIES données CRM fournies.
Mentionne : intérêt principal, budget (annoncé vs estimé), dernière interaction avec date, biens envoyés/visités, niveau d'engagement, action recommandée.
Si des visites ont eu des feedbacks négatifs, mentionne les objections. Si des biens ont été refusés, note les patterns.`,

  suggest_next_action: `Analyse le contexte CRM complet et suggère la prochaine action optimale.
Donne 1 action prioritaire + 2 alternatives. Base-toi sur : dernière interaction, biens envoyés non répondus, visites sans suite, deals en cours, timing du client.
Sois spécifique : mentionne le nom du bien, la date, le contexte.`,

  draft_email: `Rédige un email professionnel immobilier suisse PERSONNALISÉ basé sur l'historique CRM.
Ton : courtois, vouvoiement, formules suisses.
IMPORTANT : Référence la dernière interaction (visite, bien envoyé, appel) avec le détail exact (date, bien concerné).
Si des biens du matching sont disponibles, propose-en 1-2 avec prix et caractéristiques.
L'email doit donner l'impression que le courtier connaît parfaitement le dossier du client.`,

  draft_description: `Rédige une description d'annonce immobilière attractive et honnête.
2-3 paragraphes, 150-250 mots. Mets en avant les points forts sans exagérer.`,

  analyze_kyc: `Analyse ce dossier KYC et identifie : documents manquants, vérifications nécessaires, niveau de risque préliminaire.
IMPORTANT : Tu assistes l'agent, tu ne valides PAS. La validation finale est humaine.`,

  score_lead: `Évalue la qualité de ce lead : Chaud/Tiède/Froid avec score 0-100.
Critères : budget, timeline, engagement, correspondance offre/demande. Justifie en 2-3 phrases.`,

  analyze_market: `Analyse le positionnement du bien par rapport aux données marché fournies.
Structure ta réponse :
1. **Positionnement prix** : le bien est-il au-dessus, dans la moyenne, ou en-dessous du marché ? De combien en % ?
2. **Prix au m²** : compare avec la moyenne du quartier/canton.
3. **Concurrence** : combien de biens similaires sont actuellement en vente ? Le marché est-il saturé ou porteur ?
4. **Recommandation** : faut-il ajuster le prix ? Mettre en avant certains atouts ? Attendre ?
5. **Risque de stagnation** : basé sur le nombre de biens comparables et la fourchette de prix, estime le temps de vente probable.
Sois précis avec les chiffres fournis dans le contexte marché.`,

  detect_intent: `Analyse le message du client ci-dessous et détecte l'intention principale.
Réponds en JSON strict avec ce format :
{
  "intent": "strong_interest" | "objection" | "urgency" | "disinterest" | "question" | "neutral",
  "confidence": 0-100,
  "summary": "résumé en 1 phrase de l'intention détectée",
  "suggested_action": "action recommandée pour l'agent (appeler, relancer, proposer visite, ajuster prix, etc.)",
  "keywords": ["mots-clés détectés"]
}
Sois factuel et base-toi uniquement sur le contenu du message.`,
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: CopilotRequest = await req.json()
    const { action = 'chat', message, context, history = [], language = 'fr' } = body

    if (!message && action === 'chat') {
      return new Response(
        JSON.stringify({ error: 'message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY non configurée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build system prompt
    let systemPrompt = MEGGA_SYSTEM
    if (language !== 'fr') {
      systemPrompt += `\n\nLangue de réponse : ${language}`
    }

    // Build messages array
    const messages: { role: 'user' | 'assistant'; content: string }[] = []

    // Add conversation history (last 10 messages max)
    const recentHistory = history.slice(-10)
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content })
    }

    // Build the current user message
    let userContent = message || ''

    // Add action-specific instruction if not free chat
    if (action !== 'chat' && ACTION_PROMPTS[action]) {
      userContent = `**Instruction :** ${ACTION_PROMPTS[action]}\n\n**Message :** ${message || 'Exécute cette action.'}`
    }

    // Add context if available
    if (context && Object.keys(context).length > 0) {
      const contextStr = Object.entries(context)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n')
      if (contextStr) {
        userContent += `\n\n**Contexte CRM actuel :**\n${contextStr}`
      }
    }

    messages.push({ role: 'user', content: userContent })

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages,
      }),
    })

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text()
      throw new Error(`Claude API ${claudeResponse.status}: ${errText}`)
    }

    const claudeData = await claudeResponse.json()
    const result = claudeData.content?.[0]?.text || ''

    return new Response(
      JSON.stringify({
        result,
        action,
        usage: {
          input_tokens: claudeData.usage?.input_tokens,
          output_tokens: claudeData.usage?.output_tokens,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
