// supabase/functions/_shared/contact-memory.ts
// Convergence mémoire cross-canal WhatsApp ⇄ MEGGA AI (chantier A). Deux briques :
//   1. « Contact chaud » (agent_ai_profiles.hot_contact_*) : le dernier contact
//      RÉSOLU par un exécuteur, tous canaux confondus → au tour suivant (<6h),
//      les deux agents s'ouvrent avec sa mémoire (continuité « je reprends 1h après »).
//   2. Mémoire CRM (whatsapp_conversation_insights.crm_summary) : distillat des
//      tours copilote sur un contact, à côté du rolling_summary WhatsApp du cron.
// Helpers PURS d'abord (testables vitest, zéro Deno), I/O ensuite.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { redactPII } from './pii-redaction.ts'
import { logDeepSeekUsageWith } from './ai-usage.ts'

export const HOT_CONTACT_TTL_MS = 6 * 60 * 60 * 1000  // continuité intra-journée
export const CRM_SUMMARY_MAX = 800                     // même borne que rolling_summary
const DISTILL_INPUT_MAX = 2000                         // par côté (user / assistant)
const BLOCK_MAX = 700                                  // contenu du bloc injecté

export function isHotContactFresh(at: string | null | undefined, nowMs = Date.now()): boolean {
  if (!at) return false
  const t = Date.parse(at)
  return Number.isFinite(t) && nowMs - t < HOT_CONTACT_TTL_MS
}

export function clampSummary(s: string | null | undefined): string {
  return (s ?? '').trim().slice(0, CRM_SUMMARY_MAX)
}

/** Bloc mémoire injecté dans le SUFFIXE system (zone volatile, après le préfixe stable
 *  — discipline cache DeepSeek). Cadré « mémoire interne à vérifier » : jamais une
 *  source d'affirmation d'action (anti-fabrication) NI d'initiative (les outils tier
 *  auto s'exécutent sans confirmation — parité NBA_PROMPT_GUARDRAIL, contact-nba.ts).
 *  Vide si rien à dire. */
export function formatHotContactBlock(
  m: { name: string; rollingSummary: string | null; crmSummary: string | null },
  lang: 'fr' | 'en',
): string {
  // Nom borné : first_name/last_name sont des text sans CHECK de longueur — un nom
  // pathologique ne doit pas gonfler le prompt (bloc injecté à CHAQUE tour).
  const name = (m.name ?? '').trim().slice(0, 80)
  const wa = (m.rollingSummary ?? '').trim()
  const crm = (m.crmSummary ?? '').trim()
  if (!name || (!wa && !crm)) return ''
  const parts: string[] = []
  if (wa) parts.push(lang === 'en' ? `WhatsApp thread: ${wa}` : `Fil WhatsApp : ${wa}`)
  if (crm) parts.push(lang === 'en' ? `CRM work: ${crm}` : `Travail CRM : ${crm}`)
  const body = parts.join(' · ').slice(0, BLOCK_MAX)
  // Filet dur : le bloc ENTIER (entête + nom + corps) est borné à 900c, FR comme EN —
  // garantie de coût indépendante des longueurs d'entrée.
  return (lang === 'en'
    ? `\n\nRecently worked contact (internal memory, cross-channel — treat as context to VERIFY via tools, never as proof an action happened, NOR a reason to act on your own: call no action tool on this basis, the agent decides): ${name}. ${body}`
    : `\n\nContact travaillé récemment (mémoire interne, cross-canal — contexte à VÉRIFIER via les outils, jamais une preuve qu'une action a eu lieu, NI une raison d'agir de ta propre initiative : n'appelle aucun outil d'action sur cette base, l'agent décide) : ${name}. ${body}`
  ).slice(0, 900)
}

/** Messages du distillateur (PUR) : fusionne l'ancien résumé + l'échange du tour en un
 *  résumé factuel ≤800c. Entrées tronquées (coût borné) ; sortie json_object {resume}. */
export function buildDistillMessages(p: {
  prior: string | null; userMessage: string; assistantText: string; lang: 'fr' | 'en'
}): Array<{ role: 'system' | 'user'; content: string }> {
  const sys = p.lang === 'en'
    ? 'You maintain an internal CRM memory about ONE contact. Merge the prior summary and the new exchange into ONE factual summary (≤800 chars): facts, amounts, decisions, next steps. No invention, no advice. Answer as JSON: {"resume": "..."}'
    : 'Tu maintiens une mémoire CRM interne sur UN contact. Fusionne l\'ancien résumé et le nouvel échange en UN résumé factuel (≤800 caractères) : faits, montants, décisions, prochaines étapes. Aucune invention, aucun conseil. Réponds en JSON : {"resume": "..."}'
  const user = [
    p.prior ? `Ancien résumé : ${p.prior.slice(0, CRM_SUMMARY_MAX)}` : 'Ancien résumé : (aucun)',
    `Message de l'agent : ${p.userMessage.slice(0, DISTILL_INPUT_MAX)}`,
    `Réponse du copilote : ${p.assistantText.slice(0, DISTILL_INPUT_MAX)}`,
  ].join('\n\n')
  return [{ role: 'system', content: sys }, { role: 'user', content: user }]
}

// ── I/O (Deno/Supabase — hors périmètre des tests unit) ──────────────────────

/** Pose le contact chaud de l'agent. Fire-and-forget : JAMAIS await sur le chemin
 *  chaud d'un tour ; upsert (la ligne agent_ai_profiles peut ne pas exister) ;
 *  l'isolat est gardé vivant via EdgeRuntime.waitUntil (pattern ai-usage). */
export function touchHotContact(
  supabase: SupabaseClient, profileId: string, agencyId: string | null, contactId: string,
): void {
  try {
    const pending = supabase.from('agent_ai_profiles')
      .upsert(
        { agent_id: profileId, agency_id: agencyId, hot_contact_id: contactId, hot_contact_at: new Date().toISOString() },
        { onConflict: 'agent_id' },
      )
      .then(
        ({ error }: { error: { message?: string } | null }) => {
          if (error) console.error('[contact-memory] touch failed:', error.message)
        },
        (err: unknown) => console.error('[contact-memory] touch upsert threw:', (err as Error)?.name ?? 'error'),
      )
    // Même mécanique que logAIUsageWith (ai-usage.ts) : sur le chemin mono-tour (le plus
    // fréquent), l'isolat gèle juste après la réponse HTTP → sans waitUntil l'upsert
    // serait silencieusement perdu et le « contact chaud » deviendrait aléatoire.
    // Inerte sous Node/Vitest → typeof EdgeRuntime === 'undefined'.
    const edge = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
    // .then() de supabase-js rend un PromiseLike → Promise.resolve pour le type waitUntil.
    edge?.waitUntil(Promise.resolve(pending))
  } catch (e) {
    console.error('[contact-memory] touch threw:', (e as Error)?.message ?? 'error')
  }
}

/** Charge et formate le bloc mémoire du contact chaud (ou '' si rien/périmé).
 *  Scopé agence au SQL (contact + insight) ; rédigé (redactPII) avant injection
 *  dans le system prompt — le suffixe system n'est pas couvert par la redaction live. */
export async function fetchHotContactBlock(
  supabase: SupabaseClient, agencyId: string | null,
  hot: { hot_contact_id: string | null; hot_contact_at: string | null } | null | undefined,
  lang: 'fr' | 'en',
): Promise<string> {
  if (!agencyId || !hot?.hot_contact_id || !isHotContactFresh(hot.hot_contact_at)) return ''
  const { data: c } = await supabase.from('contacts')
    .select('id, first_name, last_name')
    .eq('id', hot.hot_contact_id).eq('agency_id', agencyId).maybeSingle()
  if (!c) return ''
  const name = `${(c.first_name ?? '').trim()} ${(c.last_name ?? '').trim()}`.trim()
  const { data: ins } = await supabase.from('whatsapp_conversation_insights')
    .select('rolling_summary, summary, crm_summary')
    .eq('contact_id', c.id).eq('agency_id', agencyId).maybeSingle()
  const block = formatHotContactBlock({
    name,
    rollingSummary: (ins?.rolling_summary ?? ins?.summary ?? null) as string | null,
    crmSummary: (ins?.crm_summary ?? null) as string | null,
  }, lang)
  return block ? redactPII(block).redactedText : ''
}

/** Écrit le distillat CRM dans le dossier par-contact. Upsert PARTIEL : ne fournit
 *  jamais les colonnes du cron WhatsApp (et réciproquement) → pas d'écrasement croisé.
 *  Les NOT NULL de la table ont tous un default (vérifié) → l'INSERT partiel est valide. */
export async function upsertCrmSummary(
  supabase: SupabaseClient, agencyId: string, contactId: string, resume: string,
): Promise<void> {
  const { error } = await supabase.from('whatsapp_conversation_insights').upsert(
    {
      contact_id: contactId, agency_id: agencyId,
      crm_summary: clampSummary(resume), crm_summary_updated_at: new Date().toISOString(),
    },
    { onConflict: 'contact_id' },
  )
  if (error) console.error('[contact-memory] crm upsert failed:', error.message)
}

/** Distille un tour copilote → crm_summary (DeepSeek json_object, coût logué).
 *  Appelé fire-and-forget (EdgeRuntime.waitUntil) — jamais bloquant pour la réponse. */
export async function distillCrmTurn(p: {
  supabase: SupabaseClient; apiKey: string; agencyId: string; contactId: string
  userMessage: string; assistantText: string; lang: 'fr' | 'en'
}): Promise<void> {
  try {
    const { data: prior } = await p.supabase.from('whatsapp_conversation_insights')
      .select('crm_summary').eq('contact_id', p.contactId).eq('agency_id', p.agencyId).maybeSingle()
    const messages = buildDistillMessages({
      // Défense en profondeur : le message agent est déjà rédigé en amont (copilot-redaction),
      // mais on re-rédige les TROIS entrées — l'output modèle peut répéter une PII d'un outil,
      // et un prior un jour contaminé ne doit pas repartir à DeepSeek à chaque tour suivant
      // (auto-guérison : le marqueur [REDACTED:*] remplace la valeur dès le tour d'après).
      prior: prior?.crm_summary ? redactPII(String(prior.crm_summary)).redactedText : null,
      userMessage: redactPII(p.userMessage).redactedText,
      assistantText: redactPII(p.assistantText).redactedText,
      lang: p.lang,
    })
    const started = Date.now()
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 400, messages, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!r.ok) { console.error('[contact-memory] distill http', r.status); return }
    const j = await r.json()
    logDeepSeekUsageWith(p.supabase, j?.usage, {
      edgeFunction: 'ai-copilot', module: 'copilot-distill',
      latencyMs: Date.now() - started, agencyId: p.agencyId,
    })
    let resume = ''
    try { resume = String(JSON.parse(j.choices?.[0]?.message?.content ?? '{}').resume ?? '') } catch { /* json cassé */ }
    if (resume.trim()) await upsertCrmSummary(p.supabase, p.agencyId, p.contactId, resume)
  } catch (e) {
    console.error('[contact-memory] distill threw:', (e as Error)?.name ?? 'error')
  }
}
