// MEGGA CRM Sugar v2 — Parcours module data
// 1:1 port from `crm-parcours-data.jsx`. Les dossiers sont dérivés en live par
// useJourneyScreen ; le tableau démo PARCOURS_DOSSIERS a été retiré.

// i18n : seuls les libellés STRUCTURELS rendus en live (étapes du parcours,
// niveaux d'urgence) sont traduits via getter singleton (clés pipeline:journey.*).
// PARCOURS_TEAM reste une table de correspondance (parcoursAgentById, rendu live)
// → laissée en FR en attendant le chantier RBAC équipe.
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import i18n from '@/i18n'

export interface ParcoursAgent {
  id: string
  firstName: string
  lastName: string
  initials: string
  role: string
  avatarBg: string
}

export const PARCOURS_TEAM: ParcoursAgent[] = [
  { id: 't-greg', firstName: 'Grégory', lastName: 'Lyonnet', initials: 'GR', role: 'Directeur', avatarBg: MXC_COLOR.n100 },
  { id: 't-sophie', firstName: 'Sophie', lastName: 'Martin', initials: 'SO', role: 'Courtière senior', avatarBg: '#1E5BC6' },
  { id: 't-marc', firstName: 'Marc', lastName: 'Dubois', initials: 'MA', role: 'Courtier', avatarBg: '#0891B2' },
  { id: 't-lea', firstName: 'Léa', lastName: 'Berger', initials: 'LE', role: 'Assistante admin.', avatarBg: '#C45A00' },
  { id: 't-antoine', firstName: 'Antoine', lastName: 'Picard', initials: 'AN', role: 'Photographe / Visites', avatarBg: '#059669' },
  { id: 't-camille', firstName: 'Camille', lastName: 'Roy', initials: 'CA', role: 'Marketing', avatarBg: '#7C3AED' },
  { id: 't-julien', firstName: 'Julien', lastName: 'Schmidt', initials: 'JU', role: 'KYC / Conformité', avatarBg: '#374151' },
]

export function parcoursAgentById(id: string): ParcoursAgent | undefined {
  return PARCOURS_TEAM.find(a => a.id === id)
}

export type StageId = 'mandat' | 'market' | 'nego' | 'closing'

export interface ParcoursStage {
  id: StageId
  label: string
  color: string
}

export const PARCOURS_STAGES: ParcoursStage[] = [
  { id: 'mandat', get label() { return i18n.t('pipeline:journey.stages.mandat') }, color: '#1E5BC6' },
  { id: 'market', get label() { return i18n.t('pipeline:journey.stages.market') }, color: '#0891B2' },
  { id: 'nego', get label() { return i18n.t('pipeline:journey.stages.nego') }, color: '#C45A00' },
  { id: 'closing', get label() { return i18n.t('pipeline:journey.stages.closing') }, color: '#059669' },
]

export type TaskState = 'done' | 'active' | 'todo'

export interface ParcoursTask {
  id: string
  agentId: string
  label: string
  sub?: string
  state: TaskState
  big?: boolean
  grid?: boolean
}

export type Urgency = 'high' | 'medium' | 'low'

export interface DossierTeamMember {
  agentId: string
  count: number
  badgeColor: string
}

export interface ParcoursDossier {
  id: string
  title: string
  subtitle?: string
  urgency: Urgency
  stageActive: StageId
  activeTaskId: string
  team: DossierTeamMember[]
  columns: Record<StageId, ParcoursTask[]>
}

export interface UrgencyMeta {
  label: string
  dot: string
  bg: string
  fg: string
}

export const URGENCY_MAP: Record<Urgency, UrgencyMeta> = {
  high: { get label() { return i18n.t('pipeline:journey.urgency.high') }, dot: '#E53935', bg: 'rgba(229,57,53,0.10)', fg: '#E53935' },
  medium: { get label() { return i18n.t('pipeline:journey.urgency.medium') }, dot: '#F59E0B', bg: 'rgba(245,158,11,0.14)', fg: '#A85B00' },
  low: { get label() { return i18n.t('pipeline:journey.urgency.low') }, dot: '#0E9F6E', bg: 'rgba(14,159,110,0.10)', fg: '#0E9F6E' },
}
