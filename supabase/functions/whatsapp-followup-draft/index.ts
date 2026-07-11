// supabase/functions/whatsapp-followup-draft/index.ts
// Brouillon de relance dans la VOIX de l'agent, généré À L'ACCEPTATION d'un suivi WhatsApp.
//
// Accepter un suivi (accept_followup_suggestion) crée un rappel « nu ». Cette fonction,
// appelée juste après par le front (best-effort), enrichit CE rappel d'un brouillon de
// message client — en réutilisant T1 (style appris), la voix (few-shot), les corrections
// (T2) et l'insight du fil, exactement comme ai-copilot / draftEmail.
//
// GATE = la métrique T1 : si learned_style.status ≠ 'active', on ne rédige RIEN (le rappel
// reste nu). Human-in-the-loop : le brouillon est une proposition, jamais envoyée sans l'agent.
//
// Auth : requireAgentAuth (JWT agent authentifié) → verify_jwt par défaut (pas d'entrée
// config.toml, comme ai-copilot). Le client rendu est service-role : on scope MANUELLEMENT
// chaque requête par agency_id / contact (jamais de fuite inter-agence).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { redactPII } from '../_shared/pii-redaction.ts'
import {
  formatStyleBlock, formatVoiceExamples, fetchClientVoiceSamples,
  fetchCorrectionExamples, formatCorrectionExamples, type LearnedStyle,
} from '../_shared/agent-style.ts'
import {
  isStyleActive, buildInsightContext, buildFollowupDraftSystemPrompt,
  buildFollowupDraftUserPrompt, parseDraftMessage,
  DRAFT_MAX_TOKENS, DRAFT_TEMPERATURE, DRAFT_TIMEOUT_MS, type DraftLang,
} from '../_shared/whatsapp-followup-draft.ts'
import { callDeepSeek } from '../_shared/ai-provider.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

interface SuggestionRow {
  id: string
  agency_id: string
  contact_id: string
  action: string
  status: string
  reminder_id: string | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const admin = auth.supabase // service-role → scoping MANUEL par agency_id ci-dessous
  const agencyId = auth.profile.agency_id
  const profileId = auth.user.id

  let suggestionId = ''
  let force = false
  try {
    const body = await req.json()
    suggestionId = typeof body?.suggestionId === 'string' ? body.suggestionId : ''
    force = body?.force === true   // régénérer même si un brouillon existe déjà
  } catch { /* body illisible → 400 ci-dessous */ }
  if (!suggestionId) return json({ error: 'suggestionId required' }, 400)

  // 1. Charger le suivi + VÉRIFIER l'agence (anti-fuite : service-role bypass RLS).
  const { data: sugData } = await admin
    .from('whatsapp_followup_suggestions')
    .select('id, agency_id, contact_id, action, status, reminder_id')
    .eq('id', suggestionId)
    .maybeSingle()
  const sug = sugData as SuggestionRow | null
  if (!sug) return json({ error: 'suggestion not found' }, 404)
  if (sug.agency_id !== agencyId) return json({ error: 'forbidden' }, 403)
  // Le brouillon n'a de sens qu'APRÈS l'accept (le rappel doit exister pour le porter).
  if (sug.status !== 'accepted' || !sug.reminder_id) {
    return json({ draft: null, gated: false, reason: 'not_accepted' })
  }

  // 2. GARDE anti-régénération : si le rappel porte DÉJÀ un brouillon, le renvoyer tel
  // quel sans rappeler DeepSeek (évite de brûler des tokens sur un double-invoke / retry).
  // `force: true` force la régénération. Scopé agence.
  if (!force) {
    const { data: remExisting } = await admin
      .from('reminders')
      .select('draft_message')
      .eq('id', sug.reminder_id)
      .eq('agency_id', agencyId)
      .maybeSingle()
    const existing = (remExisting as { draft_message: string | null } | null)?.draft_message
    if (existing && existing.trim()) {
      return json({ draft: existing, gated: false, reason: 'already_drafted' })
    }
  }

  // 3. GATE T1 : style appris ACTIVÉ par l'agent, sinon on laisse le rappel nu.
  const { data: prof } = await admin
    .from('agent_ai_profiles')
    .select('learned_style')
    .eq('agent_id', profileId)
    .maybeSingle()
  const learned = (prof?.learned_style as LearnedStyle | null) ?? null
  if (!isStyleActive(learned)) {
    return json({ draft: null, gated: true, reason: 'style_not_active' })
  }

  // 4. Contact (prénom) — scopé agence.
  const { data: cRow } = await admin
    .from('contacts')
    .select('first_name, last_name')
    .eq('id', sug.contact_id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  const contact = cRow as { first_name: string | null; last_name: string | null } | null
  const clientName = [contact?.first_name ?? '', contact?.last_name ?? ''].map((s) => s.trim()).filter(Boolean).join(' ')

  // 5. Insight du fil (dégrade proprement à null).
  const { data: insightRow } = await admin
    .from('whatsapp_conversation_insights')
    .select('summary, intent, next_action, commitments, language')
    .eq('contact_id', sug.contact_id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  const insight = insightRow as
    | { summary: string | null; intent: string | null; next_action: unknown; commitments: unknown; language: string | null }
    | null

  // Langue : celle du fil si détectée ('en' → anglais), sinon FR par défaut.
  const lang: DraftLang = (insight?.language ?? '').toLowerCase().startsWith('en') ? 'en' : 'fr'

  // 6. Blocs de personnalisation — T1 (déjà 'active'), voix, corrections. Voix +
  //    corrections proviennent de whatsapp_messages / corrections stockés BRUTS :
  //    rédigés (redactPII) AVANT injection dans le prompt LLM (même invariant que
  //    ai-copilot / whatsapp-agent : aucune PII sensible vers DeepSeek).
  const styleBlock = formatStyleBlock(learned)
  const voiceSamples = (await fetchClientVoiceSamples(admin, agencyId, { profileId }))
    .map((sVoice) => ({ body: redactPII(sVoice.body).redactedText }))
  const voiceBlock = formatVoiceExamples(voiceSamples, lang)
  const correctionExamples = (await fetchCorrectionExamples(admin, profileId))
    .map((c) => ({ draft: redactPII(c.draft).redactedText, final: redactPII(c.final).redactedText }))
  const correctionsBlock = formatCorrectionExamples(correctionExamples, lang)

  // 7. Assemblage PUR du prompt + appel DeepSeek (JSON strict).
  const systemPrompt = buildFollowupDraftSystemPrompt({ styleBlock, voiceBlock, correctionsBlock, lang })
  const userPrompt = buildFollowupDraftUserPrompt({
    clientName,
    action: sug.action,
    insightContext: buildInsightContext(insight, lang),
    lang,
  })

  let draft: string | null = null
  try {
    const res = await callDeepSeek(
      [{ role: 'user', content: userPrompt }],
      systemPrompt,
      {
        responseFormat: 'json_object',
        maxTokens: DRAFT_MAX_TOKENS,
        temperature: DRAFT_TEMPERATURE,
        timeoutMs: DRAFT_TIMEOUT_MS,
        agencyId,
        module: 'whatsapp-followup-draft',
      },
    )
    draft = parseDraftMessage(res.text)
  } catch (e) {
    console.error('followup draft deepseek failed:', String((e as Error)?.message ?? 'error').slice(0, 160))
    return json({ draft: null, gated: false, reason: 'draft_failed' })
  }

  if (!draft) return json({ draft: null, gated: false, reason: 'empty_draft' })

  // 8. Persister le brouillon SUR LE RAPPEL (artefact durable, revu à l'heure de relance).
  //    Re-scopé par agency_id : jamais d'écriture hors agence.
  const { error: upErr } = await admin
    .from('reminders')
    .update({ draft_message: draft })
    .eq('id', sug.reminder_id)
    .eq('agency_id', agencyId)
  if (upErr) {
    console.error('followup draft persist failed:', upErr.message.slice(0, 160))
    // Le brouillon est quand même renvoyé au front (best-effort) : la persistance a
    // échoué mais l'agent peut l'utiliser tout de suite. Rien de bloquant.
    return json({ draft, gated: false, reason: 'persist_failed' })
  }

  return json({ draft, gated: false })
})
