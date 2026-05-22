// MEGGA Premier jour — Types
// Source : handoff-premier-jour/HANDOFF_PREMIER_JOUR_CLAUDE_CODE.md §"Modèle de données"

export type Specialite = 'vente' | 'location' | 'commercial' | 'mix'
export type Dispo = 'office' | 'wide' | '247'
export type Priorite = 'acquisition' | 'closing' | 'fidelisation'
export type Autonomy = 'suggest' | 'notify' | 'resume'

export type D0Phase =
  | 'welcome'
  | 'q0'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'synthesis'
  | 'today'

export type D0Answers = {
  specialite: Specialite | null
  zone: string[]
  dispo: Dispo | null
  priorite: Priorite | null
}

export type D0Payload = {
  specialite: Specialite
  zone: string[]
  dispo: Dispo
  priorite: Priorite
  autonomy: Autonomy
}

export type D0ChecklistItem = {
  id: string
  icon: string
  label: string
  est: string
  done: boolean
}

export const D0_PHASES: D0Phase[] = [
  'welcome',
  'q0',
  'q1',
  'q2',
  'q3',
  'synthesis',
  'today',
]

export const INITIAL_ANSWERS: D0Answers = {
  specialite: null,
  zone: [],
  dispo: null,
  priorite: null,
}

// Défauts utilisés par le skip ("Passer le calibrage").
// Idéalement configurables côté serveur via DAY0_SKIP_DEFAULTS ; en attendant
// d'avoir l'endpoint, on garde ces valeurs ici pour ne pas bloquer le sas.
export const SKIP_DEFAULTS: D0Payload = {
  specialite: 'vente',
  zone: ['c-vd', 'c-ge'],
  dispo: 'office',
  priorite: 'closing',
  autonomy: 'suggest',
}
