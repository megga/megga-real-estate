// MEGGA Premier jour — Persistance (localStorage + Supabase)
// - localStorage : reprise en cours de calibrage (key `megga.day0.answers`)
// - Supabase : completion → profiles.first_day_done + day0_payload
// - Supabase : checklist toggle → profiles.activation_checklist (JSONB)
//
// Source : handoff-premier-jour/HANDOFF_PREMIER_JOUR_CLAUDE_CODE.md §"Modèle de données"
import { supabase } from '@/lib/supabase'
import type { D0Answers, D0Payload, D0Phase } from './types'

const LS_ANSWERS = 'megga.day0.answers'
const LS_AUTONOMY = 'megga.day0.autonomy'
const LS_PHASE = 'megga.day0.phase'

// ─── localStorage : reprise calibrage ────────────────────────────────

type LocalState = {
  answers?: D0Answers
  autonomy?: D0Payload['autonomy']
  phase?: D0Phase
}

export function loadLocalState(): LocalState {
  try {
    const out: LocalState = {}
    const a = localStorage.getItem(LS_ANSWERS)
    if (a) out.answers = JSON.parse(a) as D0Answers
    const au = localStorage.getItem(LS_AUTONOMY)
    if (au) out.autonomy = JSON.parse(au) as D0Payload['autonomy']
    const p = localStorage.getItem(LS_PHASE)
    if (p) out.phase = JSON.parse(p) as D0Phase
    return out
  } catch {
    return {}
  }
}

export function saveLocalAnswers(answers: D0Answers) {
  try {
    localStorage.setItem(LS_ANSWERS, JSON.stringify(answers))
  } catch {
    /* quota — silent */
  }
}

export function saveLocalAutonomy(autonomy: D0Payload['autonomy']) {
  try {
    localStorage.setItem(LS_AUTONOMY, JSON.stringify(autonomy))
  } catch {
    /* silent */
  }
}

export function saveLocalPhase(phase: D0Phase) {
  try {
    localStorage.setItem(LS_PHASE, JSON.stringify(phase))
  } catch {
    /* silent */
  }
}

export function clearLocalState() {
  try {
    localStorage.removeItem(LS_ANSWERS)
    localStorage.removeItem(LS_AUTONOMY)
    localStorage.removeItem(LS_PHASE)
  } catch {
    /* silent */
  }
}

// ─── Supabase : completion calibrage ─────────────────────────────────

export async function saveDay0Payload(
  userId: string,
  payload: D0Payload,
): Promise<{ alreadyDone: boolean }> {
  // Vérifie d'abord si déjà fait (idempotence)
  const { data: existing } = await supabase
    .from('profiles')
    .select('first_day_done, agency_id')
    .eq('id', userId)
    .maybeSingle()

  if (existing?.first_day_done) {
    return { alreadyDone: true }
  }

  await supabase
    .from('profiles')
    .update({
      first_day_done: true,
      day0_payload: payload,
      first_day_completed_at: new Date().toISOString(),
    })
    .eq('id', userId)

  // AuditEvent nLPD : trace l'événement avec snapshot du payload pour
  // traçabilité (cf. handoff §"Modèle de données" point 6).
  // Best-effort : ne bloque pas l'entrée dans le CRM si l'insert échoue.
  try {
    await supabase.from('activity_events').insert({
      agency_id: existing?.agency_id ?? null,
      actor_id: userId,
      action: 'agent.first_day_completed',
      entity_type: 'profile',
      entity_id: userId,
      metadata: { payload },
    })
  } catch {
    /* silent — l'audit ne doit pas casser l'UX */
  }

  return { alreadyDone: false }
}

// ─── Supabase : checklist activation ─────────────────────────────────
