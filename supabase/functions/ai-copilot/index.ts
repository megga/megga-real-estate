// supabase/functions/ai-copilot/index.ts
// Copilote IA agent — chat libre + actions structurées

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { formatStyleBlock, formatVoiceExamples, fetchClientVoiceSamples, type LearnedStyle } from '../_shared/agent-style.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// LBA/IA compliance: log toute interaction IA liée à une entité CRM (contact, KYC,
// bien, deal) dans activity_events avec actor_id='ai'. Silencieux en cas d'échec
// (on ne veut pas bloquer la réponse IA si le log échoue).
async function logAiCopilotInteraction(params: {
  action: string
  context: Record<string, unknown>
  tokens: { input?: number; output?: number }
  success: boolean
}) {
  try {
    const { context } = params
    const contactId = context?.contact_id as string | undefined
    const kycCaseId = context?.kyc_case_id as string | undefined
    const propertyId = context?.property_id as string | undefined
    const transactionId = context?.transaction_id as string | undefined
    const agencyId = context?.agency_id as string | undefined

    // Only log if interaction is tied to a real CRM entity (otherwise free chat)
    const entityId = kycCaseId || contactId || propertyId || transactionId
    if (!entityId) return

    const entityType = kycCaseId
      ? 'kyc'
      : contactId
      ? 'contact'
      : propertyId
      ? 'property'
      : 'transaction'

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    await supabase.from('activity_events').insert({
      agency_id: agencyId ?? null,
      actor_id: null,
      actor_kind: 'ai',
      action: `MEGGA AI — ${params.action}`,
      entity_type: entityType,
      entity_id: entityId,
      metadata: {
        copilot_action: params.action,
        input_tokens: params.tokens.input,
        output_tokens: params.tokens.output,
        success: params.success,
      },
    })
  } catch {
    // Silent fail — ne jamais bloquer la réponse IA sur un échec de logging
  }
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
- Concis et actionnable — des réponses utiles, pas de remplissage
- Professionnel mais chaleureux — comme un collègue senior qui connaît le terrain
- Toujours en français sauf si on te demande autrement
- Vouvoiement systématique dans les textes destinés aux clients
- Tutoiement OK dans le chat agent (conversation interne)
- Utilise le format Markdown : **gras**, listes à puces
- Monnaie : CHF avec apostrophe suisse (CHF 720'000)
- Dates : format suisse (16.03.2026)

ÉCRITURE NATURELLE (anti-IA) :
Tes réponses doivent sonner comme un vrai courtier, pas comme une IA. Règles strictes :
- JAMAIS de "serves as", "stands as", "testament to", "showcasing", "fostering", "underscoring"
- JAMAIS de rule of three forcée ("innovation, collaboration, and excellence")
- JAMAIS de "Let's dive in", "Here's what you need to know", "Let me break this down"
- JAMAIS de hedging excessif ("it could potentially be argued that")
- JAMAIS de phrases vides ("It is important to note that", "In order to")
- JAMAIS de fausse profondeur ("At its core", "The real question is", "fundamentally")
- JAMAIS de conclusions génériques ("The future looks bright", "Exciting times ahead")
- JAMAIS de sycophanterie ("Great question!", "You're absolutely right!", "Excellent point!")
- Utilise "est/sont/a" au lieu de "represents/serves as/functions as"
- Varie la longueur des phrases. Courtes. Puis des plus longues qui prennent leur temps.
- Sois spécifique : pas "le marché est dynamique" mais "le prix médian à Carouge a baissé de 3% en 6 mois"
- Aie un avis. "Je recommanderais de baisser le prix de 5%" est mieux que "Plusieurs options s'offrent à vous"

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

const MEGGA_SEARCH_SYSTEM = `Tu es l'assistant de recherche immobilière de MEGGA, un portail immobilier suisse premium.

TON RÔLE :
Tu aides les ACHETEURS à trouver le bien idéal. Tu es expert du marché immobilier suisse.

TON STYLE :
- Chaleureux, concis, actionnable — maximum 150 mots
- Parle comme un ami qui connaît bien l'immobilier, pas comme un robot
- Toujours en français, Markdown (**gras**, listes)
- Vouvoiement avec les acheteurs
- Monnaie : CHF avec apostrophe suisse (CHF 720'000)
- Quand tu trouves des biens, dis pourquoi ils correspondent en étant spécifique
- Si le budget est serré, dis-le honnêtement et suggère des alternatives concrètes
- JAMAIS de phrases creuses ("vibrant", "nestled", "showcasing", "fostering")
- JAMAIS de "Great question!", "Here's what you need to know", "Let's explore"
- Varie tes phrases. Courtes parfois. Plus longues quand ça apporte quelque chose.
- Aie un avis : "Ce quartier est bruyant mais les prix sont 20% en dessous de Plainpalais" est mieux que "Ce quartier offre une expérience unique"

CAPACITÉS :
- Tu comprends le langage naturel ("lumineux près de Cornavin", "comme Champel mais moins cher")
- Tu extrais les filtres : ville, type, prix, pièces, surface, chambres
- Tu donnes des conseils sur les quartiers et les prix du marché suisse

PRIX MÉDIANS (approximatifs) :
- Genève centre : CHF 12'000-15'000/m², périphérie : CHF 9'000-12'000/m²
- Lausanne : CHF 10'000-13'000/m², Zurich : CHF 12'000-16'000/m²

RÈGLES :
- Tu es une aide, pas un agent. Tu informes, tu ne vends pas.
- Après 8 échanges, suggère de contacter un agent MEGGA
- IMPORTANT : Termine TOUJOURS ta réponse avec un bloc de filtres extraits sur une ligne séparée :
FILTERS:{"city":"Genève","rooms":"3","maxPrice":"800000","types":["apartment"]}
Clés possibles : city, canton, rooms, bedrooms, minPrice, maxPrice, minSurface, types (array), context ("buy"|"rent")
N'inclus que les filtres que tu as extraits de la demande.`

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

    // ── Auth check (skip for public buyer search) ───────────────────────────
    const isPublicSearch = context?.search_mode === 'public_buyer'
    if (!isPublicSearch) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (!message && action === 'chat') {
      return new Response(
        JSON.stringify({ error: 'message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Moteur DeepSeek (deepseek-chat) — décision coût : MEGGA AI tourne sur
    // DeepSeek (~16x moins cher que Claude). Claude reste réservé au KYC
    // (kyc-screening) pour la compliance. Le nom exposé reste "MEGGA AI".
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekApiKey) {
      return new Response(
        JSON.stringify({ error: 'DEEPSEEK_API_KEY non configurée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build system prompt — switch to buyer search mode if requested
    // (isPublicSearch déjà déclaré dans le bloc auth ci-dessus — réutilisé ici)
    let systemPrompt = isPublicSearch ? MEGGA_SEARCH_SYSTEM : MEGGA_SYSTEM
    if (language !== 'fr') {
      systemPrompt += `\n\nLangue de réponse : ${language}`
    }

    // Personnalisation agent (Day 0) : si l'agent connecté a un profil IA
    // provisionné (agent_ai_profiles.brief.system_addendum, généré par
    // day0-activation-setup à partir de son calibrage), on l'injecte dans le
    // system prompt pour adapter le copilote à sa spécialité / zones / priorité /
    // autonomie. Best-effort : jamais bloquant pour la réponse IA.
    if (!isPublicSearch) {
      try {
        const token = (req.headers.get('Authorization') || '')
          .replace(/^Bearer\s+/i, '')
          .trim()
        const sbUrl = Deno.env.get('SUPABASE_URL')
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (token && sbUrl && sbKey) {
          const sb = createClient(sbUrl, sbKey)
          const { data: u } = await sb.auth.getUser(token)
          if (u?.user) {
            const { data: aiProfile } = await sb
              .from('agent_ai_profiles')
              .select('brief, learned_style, agency_id')
              .eq('agent_id', u.user.id)
              .maybeSingle()
            const addendum = (aiProfile?.brief as { system_addendum?: string } | null)
              ?.system_addendum
            if (typeof addendum === 'string' && addendum.trim()) {
              systemPrompt += `\n\n--- Contexte de l'agent (calibrage Day 0) ---\n${addendum.trim()}`
            }
            const styleBlock = formatStyleBlock((aiProfile?.learned_style as LearnedStyle | null) ?? null)
            if (styleBlock) systemPrompt += styleBlock
            // Mimétisme de voix : vrais messages clients de l'agence (few-shot), pour les brouillons client.
            const agencyId = (aiProfile as { agency_id?: string | null } | null)?.agency_id ?? null
            const rawVoice = formatVoiceExamples(await fetchClientVoiceSamples(sb, agencyId), language === 'en' ? 'en' : 'fr')
            if (rawVoice) {
              systemPrompt += language === 'en'
                ? `\n\nWhen you draft a CLIENT-FACING message (email/listing), mirror this tone; for internal analysis keep your usual style.${rawVoice}`
                : `\n\nQuand tu rédiges un message DESTINÉ À UN CLIENT (email/annonce), copie ce ton ; pour l'analyse interne, garde ton style habituel.${rawVoice}`
            }
          }
        }
      } catch (_) {
        // personnalisation optionnelle — ne jamais bloquer la réponse IA
      }
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

    // Call DeepSeek API (OpenAI-compatible). Le system prompt est passé comme
    // 1er message role:'system' (DeepSeek n'a pas de champ `system` séparé).
    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 2000,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    })

    if (!deepseekResponse.ok) {
      const errText = await deepseekResponse.text()
      throw new Error(`DeepSeek API ${deepseekResponse.status}: ${errText}`)
    }

    const deepseekData = await deepseekResponse.json()
    const result = deepseekData.choices?.[0]?.message?.content || ''

    // LBA/IA audit trail — log toute interaction liée à une entité CRM
    await logAiCopilotInteraction({
      action,
      context: context ?? {},
      tokens: {
        input: deepseekData.usage?.prompt_tokens,
        output: deepseekData.usage?.completion_tokens,
      },
      success: true,
    })

    return new Response(
      JSON.stringify({
        result,
        action,
        usage: {
          input_tokens: deepseekData.usage?.prompt_tokens,
          output_tokens: deepseekData.usage?.completion_tokens,
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
