// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — Shell
// Port pixel-près de sprint-4/crm-dashboard-shell.jsx.
//
// DBContextBar : barre sticky avec tabs + period chips + actions.
// DBChip + DBDelta : primitives partagées par tous les onglets.

import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { DB_SP } from './tokens'
import { DbIcon } from './icons'
import type { PeriodKey, ScopeKey } from './data'

// iOS UISegmentedControl spring — light, snappy, no overshoot. Tuned to land
// the pill on the new tab in ~280 ms.
const TAB_PILL_SPRING = { type: 'spring' as const, stiffness: 500, damping: 38, mass: 0.7 }

/**
 * Single tab in the dashboard's segmented control. The active state renders
 * a `motion.div` with `layoutId="dashboard-tab-pill"` underneath the label;
 * framer-motion interpolates its position+size between siblings sharing the
 * same layoutId, so the pill slides from the previously-active tab to the
 * new one instead of disappearing/reappearing.
 */
function DashboardTabPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  const reducedMotion = useReducedMotion()
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        height: 36,
        padding: '0 16px',
        borderRadius: 999,
        border: 0,
        background: 'transparent',
        color: active ? '#fff' : DB_SP.inkSoft,
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        letterSpacing: -0.1,
        whiteSpace: 'nowrap',
        transition: 'color .18s ease',
        zIndex: 1,
      }}
    >
      {active && (
        <motion.span
          layoutId="dashboard-tab-pill"
          transition={reducedMotion ? { duration: 0 } : TAB_PILL_SPRING}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: DB_SP.black,
            boxShadow: '0 4px 12px rgba(11,12,14,0.20)',
            zIndex: -1,
          }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
    </button>
  )
}

// ─── Small primitives ─────────────────────────────────────────────────
interface DBChipProps {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  icon?: ReactNode
}

export function DBChip({ active, onClick, children, icon }: DBChipProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 36,
        padding: '0 14px',
        borderRadius: 999,
        border: 0,
        background: active ? DB_SP.black : hover ? DB_SP.card : 'transparent',
        color: active ? '#fff' : DB_SP.inkSoft,
        fontFamily: 'inherit',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        boxShadow: active
          ? '0 4px 12px rgba(11,12,14,0.18)'
          : hover
            ? DB_SP.shadowSm
            : 'none',
        transition: 'all .15s ease',
        letterSpacing: -0.1,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

interface DBDeltaProps {
  value: number
  suffix?: string
  invert?: boolean
  big?: boolean
}

export function DBDelta({ value, suffix = '%', invert = false, big = false }: DBDeltaProps) {
  const up = value > 0
  const positive = invert ? !up : up
  const p = positive ? DB_SP.pill.ok : DB_SP.pill.danger
  const sign = up ? '+' : ''
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: big ? '5px 11px' : '3px 8px',
        borderRadius: 999,
        background: p.bg,
        color: p.fg,
        fontSize: big ? 12 : 11,
        fontWeight: 700,
        letterSpacing: -0.1,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        boxShadow: p.shadow,
      }}
    >
      <svg
        width={big ? 11 : 9}
        height={big ? 11 : 9}
        viewBox="0 0 24 24"
        fill="none"
        stroke={p.fg}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={up ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} />
      </svg>
      {sign}
      {value}
      {suffix}
    </span>
  )
}

// ─── Icon button (refresh + export) ────────────────────────────────────
function iconBtnStyle(refreshing = false) {
  return {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: 0,
    background: refreshing ? DB_SP.cardSubtle : DB_SP.card,
    cursor: refreshing ? ('wait' as const) : ('pointer' as const),
    display: 'grid' as const,
    placeItems: 'center' as const,
    boxShadow: DB_SP.shadowSm,
    transition: 'all .15s ease',
  }
}

// ─── DBContextBar — barre sticky en haut du dashboard ─────────────────
export type DashboardTab = 'cockpit' | 'entonnoir' | 'objectif'

interface DBContextBarProps {
  period: PeriodKey
  setPeriod: (p: PeriodKey) => void
  scope: ScopeKey
  setScope: (s: ScopeKey) => void
  tab: DashboardTab
  setTab: (t: DashboardTab) => void
  embedded?: boolean
  refreshing: boolean
  onRefresh: () => void
  /** Stub — l'export PDF n'est pas livré en v1 (cf. handoff §"Export PDF : bouton stub"). */
  onExportPdf?: () => void
  /** v1 launch : scope toggle hidden derrière `if (false)` dans la maquette. */
  showScope?: boolean
}

export function DBContextBar({
  period,
  setPeriod,
  scope,
  setScope,
  tab,
  setTab,
  embedded = false,
  refreshing,
  onRefresh,
  onExportPdf,
  showScope = false,
}: DBContextBarProps) {
  const refreshIconRef = useRef<HTMLSpanElement | null>(null)

  const handleRefresh = () => {
    if (refreshing) return
    const el = refreshIconRef.current
    if (el && el.animate) {
      el.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-720deg)' }],
        { duration: 1200, easing: 'cubic-bezier(.2,.8,.2,1)' },
      )
    }
    onRefresh()
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: embedded ? 64 : 0,
        zIndex: 50,
        background: 'rgba(237,239,243,0.85)',
        backdropFilter: 'saturate(160%) blur(14px)',
        WebkitBackdropFilter: 'saturate(160%) blur(14px)',
        paddingTop: 36,
        paddingBottom: 14,
        animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '0 32px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
            background: DB_SP.card,
            borderRadius: 18,
            padding: '12px 16px',
            boxShadow: DB_SP.shadowSm,
          }}
        >
          {/* Tabs Cockpit / Entonnoir / Objectif — segmented pill */}
          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              borderRadius: 999,
              background: DB_SP.cardSubtle,
              boxShadow: `inset 0 0 0 1px ${DB_SP.hairline}`,
              flexShrink: 0,
            }}
          >
            {(
              [
                { v: 'cockpit', l: 'Cockpit' },
                { v: 'entonnoir', l: 'Entonnoir' },
                { v: 'objectif', l: 'Objectif' },
              ] as const
            ).map((o) => {
              const active = tab === o.v
              return (
                <DashboardTabPill key={o.v} active={active} onClick={() => setTab(o.v)}>
                  {o.l}
                </DashboardTabPill>
              )
            })}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Period chips */}
          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              borderRadius: 999,
              background: DB_SP.cardSubtle,
              boxShadow: `inset 0 0 0 1px ${DB_SP.hairline}`,
              flexShrink: 0,
            }}
          >
            {(
              [
                { v: 'month', l: 'Mois' },
                { v: 'quarter', l: 'Trimestre' },
                { v: 'year', l: 'Année' },
                { v: 'ytd', l: 'YTD' },
              ] as const
            ).map((o) => {
              const active = period === o.v
              return (
                <button
                  key={o.v}
                  onClick={() => setPeriod(o.v)}
                  style={{
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 999,
                    border: 0,
                    background: active ? DB_SP.black : 'transparent',
                    color: active ? '#fff' : DB_SP.inkSoft,
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    letterSpacing: -0.1,
                    boxShadow: active ? '0 4px 12px rgba(11,12,14,0.20)' : 'none',
                    transition: 'all .18s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {o.l}
                </button>
              )
            })}
          </div>

          {/* Actions Refresh + Export */}
          <div style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
            <button
              title={refreshing ? 'Synchronisation…' : 'Rafraîchir'}
              aria-label={refreshing ? 'Synchronisation en cours' : 'Rafraîchir les données du dashboard'}
              onClick={handleRefresh}
              disabled={refreshing}
              style={iconBtnStyle(refreshing)}
            >
              <span
                ref={refreshIconRef}
                style={{ display: 'inline-flex', transformOrigin: '50% 50%' }}
              >
                <DbIcon
                  name="refresh"
                  size={14}
                  stroke={refreshing ? DB_SP.ink : DB_SP.inkSoft}
                />
              </span>
            </button>
            <button
              title="Exporter PDF (bientôt disponible)"
              aria-label="Exporter le dashboard en PDF (bientôt disponible)"
              style={iconBtnStyle()}
              onClick={onExportPdf}
            >
              <DbIcon name="download" size={14} stroke={DB_SP.inkSoft} />
            </button>
          </div>

          {/* Scope toggle — caché en v1 launch */}
          {showScope && (
            <div
              style={{
                display: 'inline-flex',
                padding: 4,
                borderRadius: 999,
                background: DB_SP.cardSubtle,
                boxShadow: `inset 0 0 0 1px ${DB_SP.hairline}`,
              }}
            >
              {(
                [
                  { v: 'me', l: 'Moi' },
                  { v: 'team', l: 'Mon équipe' },
                  { v: 'all', l: 'Agence' },
                ] as const
              ).map((o) => (
                <DBChip
                  key={o.v}
                  active={scope === o.v}
                  onClick={() => setScope(o.v)}
                  icon={
                    o.v === 'team' || o.v === 'all' ? (
                      <DbIcon name="users" size={12} />
                    ) : null
                  }
                >
                  {o.l}
                </DBChip>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
