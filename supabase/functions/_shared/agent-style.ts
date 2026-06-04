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
