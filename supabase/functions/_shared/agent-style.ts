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

/** Récupère de vrais messages clients récents de l'agence (mimétisme de voix).
 *  Agence-scopé au SQL (`whatsapp_messages` ne trace pas l'agent émetteur — limite v1).
 *  Lecture seule ; dégrade à [] proprement (jamais d'exception qui casse la rédaction). */
export async function fetchClientVoiceSamples(
  supabase: SupabaseClient, agencyId: string | null, limit = 8,
): Promise<VoiceSample[]> {
  if (!agencyId) return []
  const { data } = await supabase.from('whatsapp_messages')
    .select('body')
    .eq('agency_id', agencyId)
    .eq('direction', 'outbound')
    .not('contact_id', 'is', null)
    .not('body', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  return ((data ?? []) as Array<{ body: string | null }>)
    .map((r) => ({ body: (r.body ?? '').trim() }))
    .filter((s) => s.body.length > 1)
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
