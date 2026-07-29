// MEGGA CRM Sugar v2 — Parcours filters (Agent / Stade / Urgence)
// 1:1 port from `crm-screen-parcours-sugar.jsx` (PCFilters).

import { useTranslation } from 'react-i18next'
import { crmStep, type SugarPalette } from '../tokens'
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
    padding: '0 14px',
    borderRadius: 999,
    border: 0,
    cursor: 'pointer',
    background: dark ? crmStep('s2', 'rgba(255,255,255,0.06)') : 'rgba(255,255,255,0.6)',
    color: sp.ink,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
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
        gap: 10,
        alignItems: 'center',
      }}
    >
      {/* Stade */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: sp.sub,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
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
                borderRadius: 999,
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
          background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.10)',
        }}
      />

      {/* Urgence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: sp.sub,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
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
                borderRadius: 999,
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
          fontSize: 12,
          color: sp.sub,
          fontWeight: 600,
          padding: '6px 12px',
          borderRadius: 999,
          background: dark ? crmStep('s2', 'rgba(255,255,255,0.04)') : 'rgba(255,255,255,0.5)',
        }}
      >
        {tr('journey.filters.activeCount', { count })}
      </span>
    </div>
  )
}
