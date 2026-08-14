// MEGGA CRM Sugar v2 — Parcours filters (Agent / Stade / Urgence)
// 1:1 port from `crm-screen-parcours-sugar.jsx` (PCFilters).

import { sgVoileEncre } from '@/components/crm-sugar/tokens'
import { useTranslation } from 'react-i18next'
import { type SugarPalette } from '../tokens'
import {
  PARCOURS_STAGES,
  URGENCY_MAP,
  type StageId,
  type Urgency,
} from './journeyData'

interface PCFiltersProps {
  sp: SugarPalette
  dark: boolean
  stageFilter: StageId | 'all'
  setStageFilter: (v: StageId | 'all') => void
  urgencyFilter: Urgency | 'all'
  setUrgencyFilter: (v: Urgency | 'all') => void
  count: number
}

// Filtre Agent retiré : pas de table profiles peuplée par agence pour wire
// les vrais teammates. Réintroduit quand RBAC ship.
export function PCFilters({
  sp,
  dark,
  stageFilter,
  setStageFilter,
  urgencyFilter,
  setUrgencyFilter,
  count,
}: PCFiltersProps) {
  const { t: tr } = useTranslation('pipeline')
  const pillBase = {
    height: 36,
    padding: '0 var(--crm-space-2xl)',
    borderRadius: 'var(--crm-radius-pill)',
    border: 0,
    cursor: 'pointer',
    background: dark ? sp.cardBg : 'rgba(255,255,255,0.6)',
    color: sp.ink,
    fontSize: 'var(--crm-text-lg)',
    fontWeight: 600,
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--crm-space-md)',
    boxShadow: sp.shadowSm,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  } as const

  const activePill = (active: boolean) => ({
    ...pillBase,
    background: active ? sp.focusBg : pillBase.background,
    color: active ? sp.focusInk : sp.ink,
    boxShadow: active ? sp.focusShadow : sp.shadowSm,
  })

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--crm-space-lg)',
        alignItems: 'center',
      }}
    >
      {/* Stade */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
        <span
          style={{
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 600,
            color: sp.sub,
                                  }}
        >
          {tr('journey.filters.stageLabel')}
        </span>
        <button
          style={activePill(stageFilter === 'all')}
          onClick={() => setStageFilter('all')}
        >
          {tr('journey.filters.allStages')}
        </button>
        {PARCOURS_STAGES.map(s => (
          <button
            key={s.id}
            style={activePill(stageFilter === s.id)}
            onClick={() => setStageFilter(s.id)}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 'var(--crm-radius-pill)',
                background: s.color,
              }}
            />
            {s.label}
          </button>
        ))}
      </div>

      <div
        style={{
          width: 1,
          height: 22,
          background: dark ? 'rgba(255,255,255,0.12)' : `${sgVoileEncre(false, 0.10)}`,
        }}
      />

      {/* Urgence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
        <span
          style={{
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 600,
            color: sp.sub,
                                  }}
        >
          {tr('journey.filters.urgencyLabel')}
        </span>
        <button
          style={activePill(urgencyFilter === 'all')}
          onClick={() => setUrgencyFilter('all')}
        >
          {tr('journey.filters.allUrgencies')}
        </button>
        {(['high', 'medium', 'low'] as const).map(u => (
          <button
            key={u}
            style={activePill(urgencyFilter === u)}
            onClick={() => setUrgencyFilter(u)}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 'var(--crm-radius-pill)',
                background: URGENCY_MAP[u].dot,
              }}
            />
            {URGENCY_MAP[u].label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <span
        style={{
          fontSize: 'var(--crm-text-md)',
          color: sp.sub,
          fontWeight: 600,
          padding: 'var(--crm-space-sm) var(--crm-space-xl)',
          borderRadius: 'var(--crm-radius-pill)',
          background: dark ? sp.cardBg : 'rgba(255,255,255,0.5)',
        }}
      >
        {tr('journey.filters.activeCount', { count })}
      </span>
    </div>
  )
}
