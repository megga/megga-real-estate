// supabase/functions/day0-activation-setup/index.ts
// Day 0 — provisioning RÉEL du contexte IA de l'agent (Phase 2+4).
//
// Appelée par l'écran d'activation « atterrissage » (D0Activation) pendant
// l'animation. Fait un vrai setup en arrière-plan à partir des réponses du
// calibrage Premier jour, puis renvoie le signal « prêt » qui pilote la fin de
// l'écran (durée = init réel, plus un simple timer).
//
// Étapes :
//   1. Auth agent (requireAgentAuth).
//   2. Persiste les réponses (profiles.day0_payload) — elles sont finales ici.
//   3. Dérive les préférences déterministes (compute_agent_preferences) — déjà
//      consommées par score-engine / matching-engine / automation-engine.
//   4. Génère via LLM (DeepSeek) un BRIEF de personnalisation (system_addendum +
//      3 priorités du jour + axes de focus) → adapte MEGGA AI à l'agent.
//   5. Upsert agent_ai_profiles (status 'ready') + audit activity_events.
//
// Robustesse : si le LLM échoue, on retombe sur un brief déterministe (le setup
// reste réel via les préférences). L'agent n'est JAMAIS bloqué : la fonction
// répond toujours 200 avec un status, et l'écran a son propre fallback temporisé.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { callDeepSeek } from '../_shared/ai-provider.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SPECIALITES = ['vente', 'location', 'commercial', 'terrain'] as const
const DISPOS = ['office', 'wide', '247'] as const
const PRIORITES = ['acquisition', 'closing', 'fidelisation'] as const
const AUTONOMIES = ['suggest', 'notify', 'resume'] as const

type Specialite = (typeof SPECIALITES)[number]
type Dispo = (typeof DISPOS)[number]
type Priorite = (typeof PRIORITES)[number]
type Autonomy = (typeof AUTONOMIES)[number]

interface Answers {
  specialite: Specialite
  zone: string[]
  dispo: Dispo
  priorite: Priorite
  autonomy: Autonomy
}

interface Brief {
  summary: string
  focus: string[]
  tone: string
  priorities: { title: string; why: string }[]
  system_addendum: string
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isAnswers(a: unknown): a is Answers {
  if (!a || typeof a !== 'object') return false
  const o = a as Record<string, unknown>
  return (
    SPECIALITES.includes(o.specialite as Specialite) &&
    Array.isArray(o.zone) &&
    o.zone.every((z) => typeof z === 'string') &&
    DISPOS.includes(o.dispo as Dispo) &&
    PRIORITES.includes(o.priorite as Priorite) &&
    AUTONOMIES.includes(o.autonomy as Autonomy)
  )
}

// ─── Libellés lisibles pour le prompt (et le brief de secours) ─────────
const SPECIALITE_LABEL: Record<Specialite, string> = {
  vente: 'vente résidentielle',
  location: 'location / gérance',
  commercial: 'commercial & investissement',
  terrain: 'terrain & foncier',
}
const DISPO_LABEL: Record<Dispo, string> = {
  office: 'heures de bureau (9h–18h, lun–ven)',
  wide: 'planning élargi (8h–20h, lun–sam)',
  '247': 'sans limite horaire',
}
const PRIORITE_LABEL: Record<Priorite, string> = {
  acquisition: 'trouver de nouveaux mandats',
  closing: 'faire avancer ses mandats vers le closing',
  fidelisation: 'améliorer le suivi de ses clients',
}
const AUTONOMY_LABEL: Record<Autonomy, string> = {
  suggest: 'tout en brouillon (validation systématique)',
  notify: 'relances simples automatiques, le reste en brouillon',
  resume: 'relances et emails de suivi automatiques, propositions toujours validées',
}

// ─── Brief de secours déterministe (jamais d'échec côté agent) ─────────
function fallbackBrief(answers: Answers, zoneLabels: string[]): Brief {
  const zones = zoneLabels.length > 0 ? zoneLabels.join(', ') : 'vos zones'
  const prioMap: Record<Priorite, { title: string; why: string }[]> = {
    acquisition: [
      { title: 'Activer le matching IA sur vos mandats', why: 'pour faire remonter les acheteurs qui correspondent dès aujourd’hui' },
      { title: 'Importer vos contacts acheteurs', why: 'plus de profils = un matching plus pertinent' },
      { title: 'Créer votre premier mandat', why: 'pour alimenter votre pipeline de conquête' },
    ],
    closing: [
      { title: 'Revoir vos deals actifs', why: 'identifier ceux qui sont prêts à avancer vers la signature' },
      { title: 'Préparer les relances des dossiers en attente', why: 'maintenir l’élan jusqu’au closing' },
      { title: 'Vérifier les KYC en cours', why: 'lever les blocages compliance avant la signature' },
    ],
    fidelisation: [
      { title: 'Identifier vos clients dormants', why: 'renouer le contact avant qu’ils ne partent ailleurs' },
      { title: 'Configurer vos templates de suivi', why: 'des relances à votre voix, en un clic' },
      { title: 'Connecter votre boîte mail', why: 'suivre automatiquement chaque échange client' },
    ],
  }
  return {
    summary: `MEGGA AI est calibré pour un agent ${SPECIALITE_LABEL[answers.specialite]} sur ${zones}, dont la priorité est de ${PRIORITE_LABEL[answers.priorite]}.`,
    focus: [
      SPECIALITE_LABEL[answers.specialite],
      `objectif : ${PRIORITE_LABEL[answers.priorite]}`,
      `disponibilité : ${DISPO_LABEL[answers.dispo]}`,
    ],
    tone: 'concis, direct, professionnel',
    priorities: prioMap[answers.priorite],
    system_addendum:
      `Contexte de l'agent (calibrage Day 0) : spécialité ${SPECIALITE_LABEL[answers.specialite]} ; ` +
      `zones couvertes ${zones} ; disponibilité ${DISPO_LABEL[answers.dispo]} ; ` +
      `priorité des 30 prochains jours : ${PRIORITE_LABEL[answers.priorite]} ; ` +
      `niveau d'autonomie : ${AUTONOMY_LABEL[answers.autonomy]}. ` +
      `Adapte tes suggestions à cette spécialité, ces zones et cette priorité. Respecte le niveau d'autonomie : ne propose jamais d'envoyer au client sans validation si l'autonomie ne l'autorise pas.`,
  }
}

const BRIEF_SYSTEM = `Tu configures MEGGA AI, le copilote d'un CRM immobilier suisse, pour un nouvel agent.
À partir de son calibrage (spécialité, zones, disponibilité, priorité, autonomie), tu produis un BRIEF de personnalisation.

Réponds UNIQUEMENT par un objet JSON valide (aucun texte autour), avec ce schéma exact :
{
  "summary": "1 phrase: comment MEGGA AI va assister cet agent (français, concret)",
  "focus": ["2 à 3 axes courts"],
  "tone": "1 expression courte décrivant le ton à adopter avec cet agent",
  "priorities": [
    {"title": "priorité 1 du jour", "why": "pourquoi, en une demi-phrase"},
    {"title": "priorité 2 du jour", "why": "..."},
    {"title": "priorité 3 du jour", "why": "..."}
  ],
  "system_addendum": "Un paragraphe à injecter dans le system prompt du copilote pour adapter ses réponses à cet agent (spécialité, zones, priorité, autonomie). Impératif: 2e personne, factuel, sans bla-bla."
}

Règles de style MEGGA : français, suisse (CHF avec apostrophe), pas de phrases creuses ("dynamique", "unique", "vibrant"), pas d'anglicismes marketing. L'IA est une ASSISTANCE, jamais une décision : ne jamais suggérer d'agir au nom de l'agent sans validation si l'autonomie ne l'autorise pas.`

function buildPrompt(answers: Answers, zoneLabels: string[], prenom: string | null, preferences: unknown): string {
  const zones = zoneLabels.length > 0 ? zoneLabels.join(', ') : answers.zone.join(', ')
  return [
    prenom ? `Prénom de l'agent : ${prenom}` : null,
    `Spécialité : ${SPECIALITE_LABEL[answers.specialite]}`,
    `Zones couvertes : ${zones}`,
    `Disponibilité : ${DISPO_LABEL[answers.dispo]}`,
    `Priorité (30 prochains jours) : ${PRIORITE_LABEL[answers.priorite]}`,
    `Niveau d'autonomie : ${AUTONOMY_LABEL[answers.autonomy]}`,
    '',
    `Préférences dérivées (SLA, gate d'autonomie, poids de priorité) : ${JSON.stringify(preferences)}`,
    '',
    'Génère le brief JSON de personnalisation pour cet agent.',
  ]
    .filter((l) => l !== null)
    .join('\n')
}

// Parse défensif : extrait le premier bloc {...} et valide la forme.
function parseBrief(text: string): Brief | null {
  try {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    const summary = typeof parsed.summary === 'string' ? parsed.summary : ''
    const tone = typeof parsed.tone === 'string' ? parsed.tone : 'concis, professionnel'
    const system_addendum = typeof parsed.system_addendum === 'string' ? parsed.system_addendum : ''
    const focus = Array.isArray(parsed.focus)
      ? parsed.focus.filter((f): f is string => typeof f === 'string').slice(0, 4)
      : []
    const priorities = Array.isArray(parsed.priorities)
      ? parsed.priorities
          .filter((p): p is { title: string; why: string } =>
            !!p && typeof p === 'object' &&
            typeof (p as Record<string, unknown>).title === 'string' &&
            typeof (p as Record<string, unknown>).why === 'string',
          )
          .slice(0, 3)
      : []
    if (!summary || !system_addendum || priorities.length === 0) return null
    return { summary, focus, tone, priorities, system_addendum }
  } catch {
    return null
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase } = auth

  const body = await req.json().catch(() => ({})) as {
    answers?: unknown
    zoneLabels?: unknown
    prenom?: unknown
    force?: unknown
  }
  const force = body.force === true
  const zoneLabels = Array.isArray(body.zoneLabels)
    ? (body.zoneLabels as unknown[]).filter((z): z is string => typeof z === 'string')
    : []
  const prenom = typeof body.prenom === 'string' ? body.prenom : null

  // ── Idempotence : un profil déjà prêt n'est pas régénéré (économie LLM). ──
  if (!force) {
    const { data: existing } = await supabase
      .from('agent_ai_profiles')
      .select('agent_id, status, model, brief, preferences')
      .eq('agent_id', user.id)
      .maybeSingle()
    if (existing && existing.status === 'ready') {
      return json(200, { status: 'ready', cached: true, model: existing.model, profile: existing })
    }
  }

  // ── Réponses : body en priorité (l'écran les a, day0_payload pas encore
  //    forcément persisté), sinon profiles.day0_payload. ──
  let answers: Answers | null = isAnswers(body.answers) ? (body.answers as Answers) : null
  if (!answers) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('day0_payload')
      .eq('id', user.id)
      .maybeSingle()
    if (isAnswers(prof?.day0_payload)) answers = prof!.day0_payload as Answers
  }

  if (!answers) {
    // Pas de calibrage exploitable : on ne bloque pas l'agent, on signale.
    return json(200, { status: 'error', reason: 'no_answers' })
  }

  // ── 2. Persiste le calibrage tôt (les réponses sont finales à ce stade).
  //    La complétion canonique (first_day_done) reste gérée à l'entrée CRM. ──
  try {
    await supabase.from('profiles').update({ day0_payload: answers }).eq('id', user.id)
  } catch (_) { /* best-effort */ }

  // ── 3. Préférences déterministes (source de vérité partagée). ──
  let preferences: unknown = {}
  try {
    const { data: prefs, error } = await supabase.rpc('compute_agent_preferences', {
      p_agent_id: user.id,
    })
    if (!error && prefs) preferences = prefs
  } catch (_) { /* fallback: {} */ }

  // ── 4. Brief LLM (réel) avec repli déterministe. Moteur DeepSeek (cohérence
  //    coût avec ai-copilot ; appel unique par agent au Day 0). ──
  let brief: Brief
  let model = 'fallback'
  try {
    const ai = await callDeepSeek(
      [{ role: 'user', content: buildPrompt(answers, zoneLabels, prenom, preferences) }],
      BRIEF_SYSTEM,
      { maxTokens: 900, temperature: 0.5 },
    )
    const parsed = parseBrief(ai.text)
    if (parsed) {
      brief = parsed
      model = ai.provider
    } else {
      brief = fallbackBrief(answers, zoneLabels)
    }
  } catch (_) {
    brief = fallbackBrief(answers, zoneLabels)
  }

  // ── 5. Persiste le profil IA (upsert) + audit. ──
  const nowIso = new Date().toISOString()
  const row = {
    agent_id: user.id,
    agency_id: profile.agency_id,
    status: 'ready',
    preferences,
    brief,
    model,
    source_answers: answers,
    generated_at: nowIso,
    updated_at: nowIso,
  }

  let saved: unknown = row
  try {
    const { data, error } = await supabase
      .from('agent_ai_profiles')
      .upsert(row, { onConflict: 'agent_id' })
      .select()
      .maybeSingle()
    if (!error && data) saved = data
  } catch (_) { /* on renvoie quand même le brief calculé */ }

  try {
    await supabase.from('activity_events').insert({
      agency_id: profile.agency_id,
      actor_id: null,
      actor_kind: 'ai',
      action: 'MEGGA AI — provisioning du contexte agent (Day 0)',
      entity_type: 'profile',
      entity_id: user.id,
      metadata: { model, has_brief: !!brief.system_addendum },
    })
  } catch (_) { /* l'audit ne doit jamais bloquer */ }

  return json(200, { status: 'ready', model, profile: saved })
})
