// WhatsApp Conversation Intelligence — Engagements actionnables.
// MEGGA extrait déjà des `commitments` (« Agent: rappeler jeudi », « Client: dispo
// samedi 14h ») et une `next_action`. Ici on DÉRIVE de façon 100 % déterministe (0 LLM,
// 0 coût, 0 PII nouvelle) des suggestions de suivi DATÉES pour l'agent, qu'il accepte
// (→ vrai rappel) ou écarte. v1 = les engagements de l'AGENT (= ses todos) + la
// next_action. Les lignes « Client: … » restent du contexte (fast-follow possible).
//
// Tout est pur (testable sous Node/vitest) : `persistFollowups` est la seule I/O.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ConversationInsight } from './whatsapp-comprehend.ts'

export type FollowupOwner = 'agent' | 'client'
export type FollowupKind = 'commitment' | 'next_action' | 'client_availability'

export interface DerivedFollowup {
  owner: FollowupOwner
  action: string
  dueAt: string | null   // ISO 8601 (UTC) ou null si aucune date détectée
  kind: FollowupKind
  dedupKey: string       // stable par (engagement normalisé, jour) → pas de doublon au re-run
}

const TZ = 'Europe/Zurich'
const ACTION_MAX = 300

// next_action « molles » qui ne valent pas un todo daté (réponse immédiate / rien à faire).
const SOFT_NEXT_ACTIONS = new Set(['rien', 'repondre'])

const NEXT_ACTION_LABEL_FR: Record<string, string> = {
  planifier_visite: 'Planifier une visite',
  envoyer_biens: 'Envoyer des biens',
  relancer: 'Relancer le contact',
  qualifier_lead: 'Qualifier le lead',
}

// ── Normalisation / hash ─────────────────────────────────────────────────────
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Clé de dédup : minuscule, sans accents, alphanum compacté. */
export function normalizeAction(s: string): string {
  return stripDiacritics((s ?? '').toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim()
}

/** djb2 → base36, court et stable (pas de crypto requise pour une clé de dédup). */
export function hashKey(...parts: string[]): string {
  let h = 5381
  const s = parts.join('|')
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// ── Propriétaire de l'engagement ─────────────────────────────────────────────
/** Sépare le préfixe « Agent: »/« Client: »/« MEGGA: » du reste de la ligne. */
export function parseOwner(line: string): { owner: FollowupOwner | null; text: string } {
  const raw = (line ?? '').trim()
  const m = raw.match(/^\s*(agent|megga|moi|client|prospect|acheteur|vendeur)\s*[:\-–]\s*(.+)$/i)
  if (!m) return { owner: null, text: raw }
  const tag = stripDiacritics(m[1].toLowerCase())
  const owner: FollowupOwner = tag === 'client' || tag === 'prospect' || tag === 'acheteur' || tag === 'vendeur'
    ? 'client'
    : 'agent'
  return { owner, text: m[2].trim() }
}

// ── Ancrage temps Europe/Zurich ──────────────────────────────────────────────
type LocalParts = { y: number; mo: number; d: number; H: number; M: number; weekday: number }

/** Parts murales locales (TZ) d'un instant donné + offset en minutes (est de UTC). */
function localParts(nowISO: string): { p: LocalParts; offsetMin: number } {
  const instant = new Date(nowISO)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const parts: Record<string, string> = {}
  for (const x of dtf.formatToParts(instant)) parts[x.type] = x.value
  const y = +parts.year, mo = +parts.month, d = +parts.day
  let H = +parts.hour; if (H === 24) H = 0
  const M = +parts.minute, S = +parts.second
  const asUTC = Date.UTC(y, mo - 1, d, H, M, S)
  const offsetMin = Math.round((asUTC - instant.getTime()) / 60000)
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay() // 0=dim..6=sam
  return { p: { y, mo, d, H, M, weekday }, offsetMin }
}

/** Construit l'ISO UTC d'une heure murale Zurich (offset figé à celui de « now »). */
function wallToISO(y: number, mo: number, d: number, H: number, M: number, offsetMin: number): string {
  return new Date(Date.UTC(y, mo - 1, d, H, M) - offsetMin * 60000).toISOString()
}

const WEEKDAYS: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

/** Heure murale (h, min) trouvée dans le texte, sinon null. */
function parseTime(t: string): { H: number; M: number } | null {
  // FR « 14h », « 14h30 », « 9 h »
  const fr = t.match(/(\d{1,2})\s*h\s*(\d{2})?/)
  if (fr) {
    const H = Math.min(23, +fr[1]); const M = fr[2] ? Math.min(59, +fr[2]) : 0
    return { H, M }
  }
  // EN « 2pm », « 10:30 am »
  const en = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/)
  if (en) {
    let H = +en[1] % 12; if (en[3] === 'pm') H += 12
    return { H, M: en[2] ? +en[2] : 0 }
  }
  if (/\bmidi\b|\bnoon\b/.test(t)) return { H: 12, M: 0 }
  if (/matin|morning/.test(t)) return { H: 9, M: 0 }
  if (/apres[\s-]?midi|afternoon/.test(t)) return { H: 14, M: 0 }
  if (/\bsoir\b|evening|tonight|ce soir/.test(t)) return { H: 18, M: 0 }
  if (/fin de journee|end of day/.test(t)) return { H: 17, M: 0 }
  return null
}

/**
 * Résout une échéance depuis le texte d'un engagement, relative à `nowISO` (Zurich).
 * Renvoie un ISO UTC, ou null si aucun repère de jour n'est trouvé (engagement non daté).
 * Heure par défaut si jour sans heure : 09:00 local.
 */
export function resolveDueAt(text: string, nowISO: string): string | null {
  const t = stripDiacritics((text ?? '').toLowerCase())
  const { p, offsetMin } = localParts(nowISO)
  const time = parseTime(t)
  const base = Date.UTC(p.y, p.mo - 1, p.d) // minuit local du jour courant (en repère UTC)
  const DAY = 86400000

  const at = (offsetDays: number): string => {
    const dt = new Date(base + offsetDays * DAY)
    return wallToISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(),
      time?.H ?? 9, time?.M ?? 0, offsetMin)
  }

  // Relatifs explicites.
  if (/apres[\s-]?demain|day after tomorrow/.test(t)) return at(2)
  if (/\bdemain\b|tomorrow/.test(t)) return at(1)
  if (/aujourd|today|ce soir|tonight|ce midi/.test(t)) return at(0)
  const inDays = t.match(/dans\s+(\d{1,2})\s+jours?|in\s+(\d{1,2})\s+days?/)
  if (inDays) return at(+(inDays[1] ?? inDays[2]))
  const inWeeks = t.match(/dans\s+(\d{1,2})\s+semaines?|in\s+(\d{1,2})\s+weeks?/)
  if (inWeeks) return at(7 * +(inWeeks[1] ?? inWeeks[2]))
  if (/semaine prochaine|next week/.test(t)) return at(7)
  if (/week[\s-]?end|weekend/.test(t)) {
    const delta = (6 - p.weekday + 7) % 7 // prochain samedi (aujourd'hui si samedi)
    return at(delta)
  }

  // Jour de la semaine nommé.
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      let delta = (dow - p.weekday + 7) % 7
      // « lundi prochain » / « next monday » → forcer la semaine suivante.
      if (/prochain|next/.test(t) && delta === 0) delta = 7
      // Même jour sans « prochain » : si une heure est passée, basculer à +7 ; sinon aujourd'hui.
      if (delta === 0 && time && (time.H < p.H || (time.H === p.H && time.M <= p.M))) delta = 7
      return at(delta)
    }
  }
  return null
}

// ── Dérivation ───────────────────────────────────────────────────────────────
function isActionable(text: string): boolean {
  // Au moins quelques caractères « utiles » (évite les fragments vides après strip du préfixe).
  return normalizeAction(text).replace(/\s/g, '').length >= 3
}

// Une ligne « Client: … » qui exprime une DISPONIBILITÉ (créneau à exploiter par l'agent).
const AVAILABILITY_RE = /\b(dispo(?:nible|nibilit\w*)?|libre|available|free|je peux|je suis (?:la|present|dispo|libre))\b/

function isClientAvailability(text: string): boolean {
  return AVAILABILITY_RE.test(stripDiacritics((text ?? '').toLowerCase()))
}

/**
 * Dérive les suggestions de suivi d'un insight. Pur :
 *  - chaque `commitment` de l'AGENT → un todo (daté si repère temporel) ;
 *  - une `next_action` (hors « rien »/« répondre ») → un todo non daté ;
 *  - une dispo CLIENT avec créneau concret (« Client: dispo samedi 14h ») →
 *    suggestion de planification pour l'agent (kind `client_availability`).
 */
export function deriveFollowups(
  insight: Pick<ConversationInsight, 'commitments' | 'next_action'> | null | undefined,
  opts: { nowISO: string; contactId?: string },
): DerivedFollowup[] {
  if (!insight) return []
  const out: DerivedFollowup[] = []
  const seen = new Set<string>()

  const push = (f: DerivedFollowup) => {
    if (seen.has(f.dedupKey)) return
    seen.add(f.dedupKey); out.push(f)
  }

  for (const raw of (insight.commitments ?? [])) {
    if (typeof raw !== 'string') continue
    const { owner, text } = parseOwner(raw)
    if (!isActionable(text)) continue
    if (owner === 'agent') {
      // Engagement de l'agent = son todo (daté si repère temporel, sinon non daté).
      const action = text.slice(0, ACTION_MAX)
      const dueAt = resolveDueAt(text, opts.nowISO)
      const dayKey = dueAt ? dueAt.slice(0, 10) : 'nodate'
      push({ owner: 'agent', action, dueAt, kind: 'commitment', dedupKey: hashKey('c', normalizeAction(action), dayKey) })
    } else if (owner === 'client' && isClientAvailability(text)) {
      // Dispo client → suggestion de planification, UNIQUEMENT si un créneau concret
      // est résolu (pas de « dispo cette semaine » vague). L'action reste à l'agent.
      const dueAt = resolveDueAt(text, opts.nowISO)
      if (!dueAt) continue
      const action = `Planifier avec le client (dispo : ${text})`.slice(0, ACTION_MAX)
      push({ owner: 'agent', action, dueAt, kind: 'client_availability', dedupKey: hashKey('av', normalizeAction(text), dueAt.slice(0, 10)) })
    }
  }

  const na = insight.next_action
  if (na && na.type && !SOFT_NEXT_ACTIONS.has(na.type)) {
    const label = (na.label && na.label.trim()) || NEXT_ACTION_LABEL_FR[na.type] || na.type
    if (isActionable(label)) {
      push({ owner: 'agent', action: label.slice(0, ACTION_MAX), dueAt: null, kind: 'next_action', dedupKey: hashKey('n', na.type) })
    }
  }
  return out
}

// ── Persistance (seule I/O) ──────────────────────────────────────────────────
/** Upsert ON CONFLICT DO NOTHING : ne ressuscite jamais une suggestion écartée/acceptée. */
export async function persistFollowups(
  admin: SupabaseClient,
  agencyId: string,
  contactId: string,
  suggestions: DerivedFollowup[],
  sourceAt: string | null,
): Promise<number> {
  if (!suggestions.length) return 0
  const rows = suggestions.map((s) => ({
    agency_id: agencyId, contact_id: contactId, owner: s.owner,
    action: s.action, due_at: s.dueAt, kind: s.kind,
    dedup_key: s.dedupKey, source_insight_at: sourceAt,
  }))
  const { error } = await admin
    .from('whatsapp_followup_suggestions')
    .upsert(rows, { onConflict: 'contact_id,dedup_key', ignoreDuplicates: true })
  if (error) throw error
  return rows.length
}
