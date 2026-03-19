// supabase/functions/ai-copilot/index.ts
// Edge Function pour le copilote IA agent
// Résumés, suggestions, rédaction, next-best-action

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CopilotAction =
  | 'summarize_contact'
  | 'suggest_next_action'
  | 'draft_email'
  | 'draft_description'
  | 'analyze_kyc'
  | 'score_lead'

interface CopilotRequest {
  action: CopilotAction
  context: Record<string, unknown>
  language?: 'fr' | 'de' | 'en' | 'it'
}

const SYSTEM_PROMPTS: Record<CopilotAction, string> = {
  summarize_contact: `Tu es un assistant CRM immobilier. Résume le profil et l'historique d'un contact en 3-5 points clés.
Mentionne : intérêt principal, budget estimé, dernière interaction, niveau d'engagement, points d'attention.
Sois concis et actionnable. Langue : français.`,

  suggest_next_action: `Tu es un copilote CRM immobilier. Analyse le contexte d'un deal et suggère la prochaine action optimale.
Considère : étape du pipeline, dernière interaction, niveau d'intérêt, documents manquants, timing.
Donne 1 action prioritaire + 2 alternatives. Langue : français.`,

  draft_email: `Tu es un rédacteur immobilier professionnel suisse. Rédige un email professionnel et chaleureux.
Ton : courtois, professionnel mais pas froid. Vouvoiement. Formules de politesse suisses.
Adapte au contexte fourni. Langue : français.`,

  draft_description: `Tu es un rédacteur d'annonces immobilières suisses. Rédige une description attractive et honnête.
Mets en avant les points forts sans exagérer. Mentionne la localisation, les caractéristiques clés, les atouts du quartier.
Format : 2-3 paragraphes, 150-250 mots. Langue : français.`,

  analyze_kyc: `Tu es un assistant compliance LAB/KYC suisse. Analyse un dossier KYC et identifie :
- Documents manquants ou incomplets
- Éléments nécessitant une vérification approfondie
- Niveau de risque préliminaire (bas/moyen/élevé)
IMPORTANT : Tu assistes l'agent, tu ne valides PAS le dossier. La validation finale est humaine.
Langue : français.`,

  score_lead: `Tu es un analyste CRM immobilier. Évalue la qualité d'un lead sur une échelle Chaud/Tiède/Froid.
Critères : budget confirmé, timeline d'achat, engagement (visites, messages), correspondance offre/demande.
Donne un score + justification en 2 phrases. Langue : français.`,
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, context, language = 'fr' }: CopilotRequest = await req.json()

    if (!action || !SYSTEM_PROMPTS[action]) {
      return new Response(
        JSON.stringify({ error: `Action invalide : ${action}` }),
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

    // Verify auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Session invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build prompt
    const systemPrompt = SYSTEM_PROMPTS[action] + (language !== 'fr' ? `\nLangue de réponse : ${language}` : '')
    const contextStr = JSON.stringify(context, null, 2)

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
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Contexte :\n${contextStr}`,
          },
        ],
      }),
    })

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text()
      throw new Error(`Erreur Claude API : ${claudeResponse.status} — ${errText}`)
    }

    const claudeData = await claudeResponse.json()
    const result = claudeData.content?.[0]?.text || ''

    // Log activity
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabaseAdmin.from('activity_events').insert({
      actor_id: user.id,
      action: `ai_copilot_${action}`,
      entity_type: 'ai_copilot',
      metadata: { action, language },
    })

    return new Response(
      JSON.stringify({
        result,
        action,
        usage: {
          input_tokens: claudeData.usage?.input_tokens,
          output_tokens: claudeData.usage?.output_tokens,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne'
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
