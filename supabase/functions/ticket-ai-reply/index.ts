import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Auth check — verify caller is super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'super_admin') throw new Error('Forbidden')

    const { ticket_id } = await req.json()
    if (!ticket_id) throw new Error('ticket_id required')
    if (typeof ticket_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket_id)) {
      throw new Error('Invalid ticket_id format')
    }

    // Fetch ticket + messages + canned responses
    const [ticketRes, messagesRes, cannedRes] = await Promise.all([
      supabaseAdmin.from('support_tickets')
        .select('id, ticket_number, subject, description, category, priority, status, submitter_name, submitter_email')
        .eq('id', ticket_id).single(),
      supabaseAdmin.from('ticket_messages')
        .select('author_type, author_name, body, is_internal_note, created_at')
        .eq('ticket_id', ticket_id)
        .eq('is_internal_note', false)
        .order('created_at', { ascending: true }),
      supabaseAdmin.from('ticket_canned_responses')
        .select('title, body, category')
        .eq('is_active', true),
    ])

    const ticket = ticketRes.data
    if (!ticket) throw new Error('Ticket not found')

    const messages = messagesRes.data ?? []
    const cannedResponses = cannedRes.data ?? []

    // Build conversation history
    const conversationHistory = messages.map(m =>
      `[${m.author_type === 'customer' ? m.author_name : 'Support MEGGA'}]: ${m.body}`
    ).join('\n\n')

    // Build canned responses context
    const cannedContext = cannedResponses.length > 0
      ? `\n\nReponses types disponibles (tu peux t'en inspirer mais adapte au contexte):\n${cannedResponses.map(c => `- ${c.title}: ${c.body.slice(0, 150)}`).join('\n')}`
      : ''

    const systemPrompt = `Tu es l'assistant support de MEGGA Real Estate, une plateforme SaaS immobiliere suisse.

REGLES ABSOLUES:
- Reponds en francais, ton professionnel mais chaleureux
- Sois concis (3-5 phrases max), pas de bavardage
- Ne commence JAMAIS par "Bonjour" ou "Cher" si le ticket est deja en conversation
- Utilise le prenom du client si disponible
- Pas de formules creuses ("Je comprends votre frustration", "N'hesitez pas")
- Pas de bullet points sauf si vraiment necessaire
- Donne une reponse actionnable, pas juste un "nous allons regarder"
- Si c'est un bug : confirme, donne un workaround si possible, timeline estimee
- Si c'est une question billing : reponds directement avec les faits
- Si c'est une demande de feature : acknowledge et donne le statut honnete
- Si c'est un onboarding : guide pas a pas, simple
- Signe avec "L'equipe MEGGA" en fin de message

CONTEXTE TICKET:
- Numero: ${ticket.ticket_number}
- Sujet: ${ticket.subject}
- Categorie: ${ticket.category}
- Priorite: ${ticket.priority}
- Client: ${ticket.submitter_name} (${ticket.submitter_email})
${ticket.description ? `- Description: ${ticket.description}` : ''}

HISTORIQUE CONVERSATION:
${conversationHistory || '(Premier message, pas encore de conversation)'}
${cannedContext}

Genere UNE reponse appropriee au dernier message du client. La reponse doit etre prete a envoyer — pas de placeholder, pas de [nom], pas de crochets.`

    // Call Claude API
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured')

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: 'Genere la reponse support pour ce ticket.',
        }],
        system: systemPrompt,
      }),
    })

    if (!claudeResponse.ok) {
      console.error('Claude API error:', claudeResponse.status, await claudeResponse.text())
      throw new Error('AI service temporarily unavailable')
    }

    const claudeData = await claudeResponse.json()
    const reply = claudeData.content?.[0]?.text ?? ''

    return new Response(JSON.stringify({ reply, ticket_number: ticket.ticket_number }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = (err as Error).message
    const status = msg === 'Forbidden' ? 403 : msg === 'Unauthorized' ? 401 : 500
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
