// Traducteur injecté (cf docs/i18n-conventions.md §5) : helpers d'affichage de
// l'insight de conversation ; le `t` de useTranslation est passé par le composant.
export type CiT = (key: string, opts?: Record<string, unknown>) => string

const NEXT_ACTION_TYPES = new Set(['planifier_visite', 'envoyer_biens', 'relancer', 'qualifier_lead', 'repondre', 'rien'])

function capitalize(s: string): string {
  if (!s) return ''
  const t = s.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function nextActionLabel(type: string, t: CiT): string {
  return NEXT_ACTION_TYPES.has(type) ? t('contacts:nextAction.' + type) : capitalize(type)
}

export type SentimentTone = 'ok' | 'err' | 'neutral'
export function sentimentTone(s: string | null | undefined, t: CiT): { label: string; tone: SentimentTone } | null {
  if (!s) return null
  if (s === 'positif') return { label: t('contacts:sentiment.positif'), tone: 'ok' }
  if (s === 'tendu') return { label: t('contacts:sentiment.tendu'), tone: 'err' }
  if (s === 'neutre') return { label: t('contacts:sentiment.neutre'), tone: 'neutral' }
  return { label: s, tone: 'neutral' }
}

const ENTITY_KEYS = ['budget', 'zones', 'type', 'pieces', 'dates'] as const

/** Transforme entities (jsonb libre) en puces "Label : valeur" pour les clés connues non vides. */
export function entityChips(entities: Record<string, unknown> | null | undefined, t: CiT): string[] {
  if (!entities || typeof entities !== 'object') return []
  const chips: string[] = []
  for (const key of ENTITY_KEYS) {
    const v = (entities as Record<string, unknown>)[key]
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    const val = Array.isArray(v) ? v.join(', ') : String(v)
    if (!val.trim()) continue
    chips.push(`${t('contacts:entity.' + key)} : ${val}`)
  }
  return chips
}
