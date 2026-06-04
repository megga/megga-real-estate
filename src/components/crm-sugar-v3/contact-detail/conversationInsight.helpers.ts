const NEXT_ACTION_LABELS: Record<string, string> = {
  planifier_visite: 'Planifier une visite',
  envoyer_biens: 'Envoyer des biens',
  relancer: 'Relancer',
  qualifier_lead: 'Qualifier le lead',
  repondre: 'Répondre',
  rien: 'Rien à faire',
}

function capitalize(s: string): string {
  if (!s) return ''
  const t = s.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function nextActionLabel(type: string): string {
  return NEXT_ACTION_LABELS[type] ?? capitalize(type)
}

export type SentimentTone = 'ok' | 'err' | 'neutral'
export function sentimentTone(s: string | null | undefined): { label: string; tone: SentimentTone } | null {
  if (!s) return null
  if (s === 'positif') return { label: 'Positif', tone: 'ok' }
  if (s === 'tendu') return { label: 'Tendu', tone: 'err' }
  if (s === 'neutre') return { label: 'Neutre', tone: 'neutral' }
  return { label: s, tone: 'neutral' }
}

const ENTITY_LABELS: Array<{ key: string; label: string }> = [
  { key: 'budget', label: 'Budget' },
  { key: 'zones', label: 'Zones' },
  { key: 'type', label: 'Type' },
  { key: 'pieces', label: 'Pièces' },
  { key: 'dates', label: 'Dates' },
]

/** Transforme entities (jsonb libre) en puces "Label : valeur" pour les clés connues non vides. */
export function entityChips(entities: Record<string, unknown> | null | undefined): string[] {
  if (!entities || typeof entities !== 'object') return []
  const chips: string[] = []
  for (const { key, label } of ENTITY_LABELS) {
    const v = (entities as Record<string, unknown>)[key]
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    const val = Array.isArray(v) ? v.join(', ') : String(v)
    if (!val.trim()) continue
    chips.push(`${label} : ${val}`)
  }
  return chips
}
