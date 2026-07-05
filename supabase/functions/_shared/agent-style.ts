import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Un vrai message destiné à un client, source de mimétisme de voix (few-shot). */
export type VoiceSample = { body: string }

const VOICE_MIN = 2            // en dessous, pas assez de signal → bloc vide (fallback style/brief)
const VOICE_MAX = 4            // few-shot borné (coût + focus)
const VOICE_SAMPLE_CHARS = 220 // borne par exemple
const VOICE_BLOCK_CHARS = 900  // borne du bloc entier

/** Bloc FEW-SHOT : montre de VRAIS messages clients pour copier le TON, JAMAIS le contenu.
 *  Vide si < VOICE_MIN exemples. Auto-appliqué (pas de gate) : ne façonne qu'un brouillon validé. */
export function formatVoiceExamples(samples: VoiceSample[] | null | undefined, lang: 'fr' | 'en' = 'fr'): string {
  const cleaned = (samples ?? [])
    .map((s) => (s?.body ?? '').trim())
    .filter((b) => b.length > 1)
    .map((b) => b.slice(0, VOICE_SAMPLE_CHARS))
  const seen = new Set<string>()
  const uniq: string[] = []
  for (const b of cleaned) { const k = b.toLowerCase(); if (!seen.has(k)) { seen.add(k); uniq.push(b) } }
  const picked = uniq.slice(0, VOICE_MAX)
  if (picked.length < VOICE_MIN) return ''
  const list = picked.map((b) => `- « ${b} »`).join('\n')
  const head = lang === 'en'
    ? `\n\nReal recent messages this agency sent to its clients — Mirror the TONE (vocabulary, length, sign-offs). NEVER reuse their content/data (names, prices, dates); write fresh for the current client.\n${list}`
    : `\n\nVrais messages récents que cette agence a envoyés à ses clients — Copie le TON (vocabulaire, longueur, formules). NE REPRENDS JAMAIS leur contenu/données (noms, prix, dates) ; rédige du neuf pour le client courant.\n${list}`
  return head.slice(0, VOICE_BLOCK_CHARS)
}

/** Récupère de vrais messages clients récents pour le mimétisme de voix.
 *  T2 « par agent » : si `opts.profileId` est fourni et que cet agent a ASSEZ de
 *  messages prose à lui (>= VOICE_MIN, tagués `sent_by_profile_id`), on apprend SA
 *  voix (ses messages validés = ses corrections) ; sinon repli sur le ton de l'agence.
 *  Lecture seule ; dégrade à [] proprement (jamais d'exception qui casse la rédaction). */
export async function fetchClientVoiceSamples(
  supabase: SupabaseClient,
  agencyId: string | null,
  opts: { profileId?: string | null; limit?: number } = {},
): Promise<VoiceSample[]> {
  if (!agencyId) return []
  const limit = opts.limit ?? 8

  const toSamples = (data: unknown): VoiceSample[] =>
    ((data ?? []) as Array<{ body: string | null }>)
      .map((r) => ({ body: (r.body ?? '').trim() }))
      .filter((s) => s.body.length > 1)

  // 1. PAR AGENT : ses propres messages clients (= ses corrections, validées au fil
  //    de l'eau). Le plus sur-mesure ; utilisé seulement s'il y a assez de signal.
  if (opts.profileId) {
    const { data } = await supabase.from('whatsapp_messages')
      .select('body')
      .eq('agency_id', agencyId)
      .eq('direction', 'outbound')
      .eq('sent_by_profile_id', opts.profileId)
      .not('contact_id', 'is', null)
      .not('body', 'is', null)
      // is_automated=false → prose RÉELLEMENT écrite par un agent (exclut copilote,
      // templates, texte ET légendes send_listings) ; media_type null → texte seul.
      .eq('is_automated', false)
      .is('media_type', null)
      .order('created_at', { ascending: false })
      .limit(limit)
    const perAgent = toSamples(data)
    if (perAgent.length >= VOICE_MIN) return perAgent
  }

  // 2. REPLI AGENCE : ton de la maison (agent sans historique propre suffisant).
  const { data } = await supabase.from('whatsapp_messages')
    .select('body')
    .eq('agency_id', agencyId)
    .eq('direction', 'outbound')
    .not('contact_id', 'is', null)
    .not('body', 'is', null)
    // Même garde : seule la prose authored (is_automated=false, texte) alimente le corpus.
    // NE PAS gater sur sent_by_profile_id : le compositeur manuel CRM ne le pose pas → on
    // perdrait de la vraie voix. Le flag is_automated est le seul discriminant fiable.
    .eq('is_automated', false)
    .is('media_type', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  return toSamples(data)
}

export type LearnedStyle = {
  language: 'fr' | 'en' | 'mixed'
  formality: 'tu' | 'vous' | 'direct'
  emoji: boolean
  traits: string
  status: 'suggested' | 'active' | 'off'
  updated_at: string
  sample_count: number
}

/** Bloc TONAL injecté dans le prompt système de whatsapp-agent. Vide si pas 'active'.
 *  Borné (~300 car.) pour ne pas gonfler le prompt ni le coût. JAMAIS de règle/contenu. */
export function formatStyleBlock(ls: LearnedStyle | null | undefined): string {
  if (!ls || ls.status !== 'active') return ''
  const lang = ls.language === 'en' ? 'en anglais' : ls.language === 'mixed' ? 'FR/EN selon le contact' : 'en français'
  const reg = ls.formality === 'vous' ? 'vouvoie' : ls.formality === 'direct' ? 'style direct' : 'tutoie'
  const emo = ls.emoji ? 'utilise des emoji avec parcimonie' : 'sans emoji'
  const traits = (ls.traits ?? '').slice(0, 180)
  return `\n\nStyle de cet agent (adapte ton TON, jamais tes règles ni le socle légal) : ${lang}, ${reg}, ${emo}. ${traits}`.slice(0, 320)
}

// ── T2 par l'exemple : corrections (brouillon rejeté → message envoyé) ────────
/** Une correction apprise : ce que MEGGA avait proposé vs ce que l'agent a préféré. */
export type CorrectionExample = { draft: string; final: string }

const CORR_MAX = 3            // peu mais à fort signal (coût + focus)
const CORR_SAMPLE_CHARS = 200 // borne par côté de la paire
const CORR_BLOCK_CHARS = 900  // borne du bloc entier

/** Récupère les dernières corrections d'un AGENT (paires contrastives). Lecture
 *  seule ; dégrade à [] proprement. */
export async function fetchCorrectionExamples(
  supabase: SupabaseClient, profileId: string | null, limit = CORR_MAX,
): Promise<CorrectionExample[]> {
  if (!profileId) return []
  const { data } = await supabase.from('whatsapp_message_corrections')
    .select('megga_draft, agent_final')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data ?? []) as Array<{ megga_draft: string | null; agent_final: string | null }>)
    .map((r) => ({ draft: (r.megga_draft ?? '').trim(), final: (r.agent_final ?? '').trim() }))
    .filter((c) => c.draft.length > 1 && c.final.length > 1)
}

/** Bloc CONTRASTIF injecté dans la rédaction client : « tu proposais X → l'agent a
 *  préféré Y ». Apprentissage par l'exemple ; ne façonne qu'un brouillon validé.
 *  Vide si aucune correction. JAMAIS une règle / un contournement. */
export function formatCorrectionExamples(corr: CorrectionExample[] | null | undefined, lang: 'fr' | 'en' = 'fr'): string {
  const cleaned = (corr ?? [])
    .map((c) => ({ draft: (c?.draft ?? '').trim(), final: (c?.final ?? '').trim() }))
    .filter((c) => c.draft.length > 1 && c.final.length > 1)
    .slice(0, CORR_MAX)
    .map((c) => ({ draft: c.draft.slice(0, CORR_SAMPLE_CHARS), final: c.final.slice(0, CORR_SAMPLE_CHARS) }))
  if (cleaned.length === 0) return ''
  const list = cleaned
    .map((c) => lang === 'en'
      ? `- you proposed « ${c.draft} » → the agent preferred « ${c.final} »`
      : `- tu proposais « ${c.draft} » → l'agent a préféré « ${c.final} »`)
    .join('\n')
  const head = lang === 'en'
    ? `\n\nRecent corrections this agent made to YOUR client drafts — learn from them (don't repeat the same gap), match their preferred phrasing; never reuse the old content/data:\n${list}`
    : `\n\nCorrections récentes de cet agent sur TES brouillons client — apprends-en (ne refais pas la même erreur), reprends sa formulation préférée ; ne réutilise jamais l'ancien contenu/données :\n${list}`
  return head.slice(0, CORR_BLOCK_CHARS)
}
