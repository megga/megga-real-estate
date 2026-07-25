/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : sélecteur de vue + pilule « Filtres »
 * unique (panneau Étape / Risque / Période) + les 3 sous-filtres.
 * Port 1:1 du handoff crm-screen-pipeline-sugar.jsx (§SugarFilterPill,
 * §SugarStageFilter, §SugarRiskFilter, §SugarPeriodFilter, §SugarSegmentedView).
 * Les en-têtes de sections (« Étape », « Risque », « Période ») vivent dans le
 * panneau composé par la page — pas dans les sous-filtres.
 */

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { CRM_STAGE_ORDER, SG_STAGE_HUE, type SugarPalette, type StageId } from '../tokens'

// ─── Segmented view (Kanban / Liste / Timeline) ───────────────────────
export type PipelineView = 'kanban' | 'list' | 'timeline'

export function SugarSegmentedView({
  value, onChange, sp,
}: { value: PipelineView; onChange?: (v: PipelineView) => void; sp: SugarPalette }) {
  const { t } = useTranslation('pipeline')
  return (
    <div style={{
      display: 'flex', padding: 4, background: sp.cardBg,
      borderRadius: 999, boxShadow: sp.shadowSm,
    }}>
      {([
        { k: 'kanban' as const,   label: t('view.kanban') },
        { k: 'list' as const,     label: t('view.list') },
        { k: 'timeline' as const, label: t('view.timeline') },
      ]).map(v => (
        <button key={v.k} onClick={() => onChange?.(v.k)} style={{
          padding: '9px 18px', borderRadius: 999, border: 0, cursor: 'pointer',
          background: value === v.k ? sp.accent : 'transparent',
          color: value === v.k ? sp.accentInk : sp.soft,
          fontWeight: value === v.k ? 700 : 500, fontSize: 13,
          fontFamily: 'inherit',
          boxShadow: value === v.k ? sp.focusShadow : 'none',
        }}>{v.label}</button>
      ))}
    </div>
  )
}

// ─── Détection de thème depuis la palette (repli robuste sur `dark`) ───
function sgFilterIsDark(sp: SugarPalette, dark?: boolean): boolean {
  if (typeof dark === 'boolean') return dark
  const hex = (sp.ink || '#000000').replace('#', '')
  if (hex.length < 6) return false
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 140
}

// ─── Pilule « Filtres » unique (label + valeur + chevron, panneau) ─────
interface FilterPillProps {
  sp: SugarPalette
  label: string
  value: string
  active: boolean
  children: ReactNode
  dark: boolean
}
export function SugarFilterPill({ sp, label, value, active, children, dark }: FilterPillProps) {
  const { t } = useTranslation('pipeline')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isDark = sgFilterIsDark(sp, dark)
  const panelBg = isDark ? '#17181A' : '#FFFFFF'
  const panelBorder = isDark ? 'rgba(255,255,255,.07)' : sp.cardBorder
  const panelShadow = isDark
    ? '0 16px 40px -12px rgba(0,0,0,.72), 0 2px 10px rgba(0,0,0,.45)'
    : '0 10px 30px -10px rgba(14,20,16,.18), 0 2px 8px rgba(14,20,16,.06)'

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  const mutedOnAccent = `color-mix(in srgb, ${sp.accentInk} 62%, transparent)`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        height: 44, padding: '0 16px', borderRadius: 999, border: 0,
        background: active ? sp.accent : sp.cardBg,
        boxShadow: sp.shadowSm,
        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{ fontSize: 11, color: active ? mutedOnAccent : sp.sub, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12.5, color: active ? sp.accentInk : sp.ink, fontWeight: 700 }}>{value}</span>
        <MEIcon name="chevron-down" size={11} color={active ? sp.accentInk : sp.sub} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: panelBg, border: `1px solid ${panelBorder}`,
          borderRadius: 16, boxShadow: panelShadow,
          padding: 14, zIndex: 50, minWidth: 220,
          animation: 'sfPop .16s cubic-bezier(.2,.7,.2,1)',
        }}>
          {children}
          <div style={{ borderTop: `1px solid ${panelBorder}`, marginTop: 8, paddingTop: 8 }}>
            <button onClick={() => setOpen(false)} style={{
              width: '100%', padding: '8px 0', borderRadius: 10, border: 0, cursor: 'pointer',
              background: sp.focusBg, color: sp.focusInk, fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
            }}>{t('board.filter.apply')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stage filter (pastilles SG_STAGE_HUE) ─────────────────────────────
export function SugarStageFilter({
  sp, value, onChange, dark,
}: { sp: SugarPalette; value: StageId[]; onChange: (v: StageId[]) => void; dark: boolean }) {
  const { t } = useTranslation('pipeline')
  const isDark = sgFilterIsDark(sp, dark)
  const rowSel = isDark ? 'rgba(255,255,255,.08)' : '#F4F5F7'
  const boxBorder = isDark ? 'rgba(255,255,255,.28)' : '#CDD3DB'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {CRM_STAGE_ORDER.map(s => {
        const sel = value.includes(s)
        return (
          <button key={s}
            onClick={() => onChange(sel ? value.filter(x => x !== s) : [...value, s])}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px',
              borderRadius: 10, border: 0, cursor: 'pointer', fontFamily: 'inherit',
              background: sel ? rowSel : 'transparent', textAlign: 'left',
            }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4,
              border: `2px solid ${sel ? sp.focusBg : boxBorder}`,
              background: sel ? sp.focusBg : 'transparent',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              {sel && <svg width="9" height="9" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5 4-4" stroke={sp.focusInk} strokeWidth="1.6" strokeLinecap="round" fill="none"/></svg>}
            </span>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: SG_STAGE_HUE[s], flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: sel ? 700 : 500, color: sp.ink }}>{t(`stages.${s}`)}</span>
          </button>
        )
      })}
      {value.length > 0 && (
        <button onClick={() => onChange([])} style={{
          marginTop: 4, padding: '5px 8px', borderRadius: 8, border: 0, cursor: 'pointer',
          background: 'transparent', color: sp.sub,
          fontSize: 11, fontWeight: 600, fontFamily: 'inherit', textAlign: 'left',
        }}>{t('board.filter.deselectAll')}</button>
      )}
    </div>
  )
}

// ─── Risk filter ───────────────────────────────────────────────────────
export type RiskFilterValue = 'all' | 'healthy' | 'at-risk' | 'stalled'

export function SugarRiskFilter({
  sp, value, onChange, dark,
}: { sp: SugarPalette; value: RiskFilterValue; onChange: (v: RiskFilterValue) => void; dark: boolean }) {
  const { t } = useTranslation('pipeline')
  const isDark = sgFilterIsDark(sp, dark)
  const rowSel = isDark ? 'rgba(255,255,255,.08)' : '#F4F5F7'
  const boxBorder = isDark ? 'rgba(255,255,255,.28)' : '#CDD3DB'
  const opts: { k: RiskFilterValue; label: string; dot: string }[] = [
    { k: 'all',      label: t('board.risk.all'),     dot: sp.sub },
    { k: 'healthy',  label: t('board.risk.healthy'), dot: '#0E9F6E' },
    { k: 'at-risk',  label: t('board.risk.atRisk'),  dot: '#F59E0B' },
    { k: 'stalled',  label: t('board.risk.stalled'), dot: '#E53935' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {opts.map(o => (
        <button key={o.k} onClick={() => onChange(o.k)} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px',
          borderRadius: 10, border: 0, cursor: 'pointer', fontFamily: 'inherit',
          background: value === o.k ? rowSel : 'transparent', textAlign: 'left',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 999,
            border: `2px solid ${value === o.k ? sp.focusBg : boxBorder}`,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            {value === o.k && <span style={{ width: 6, height: 6, borderRadius: 999, background: sp.focusBg }} />}
          </span>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: o.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: value === o.k ? 700 : 500, color: sp.ink }}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Period filter ─────────────────────────────────────────────────────
export function SugarPeriodFilter({
  sp, value, onChange, dark,
}: { sp: SugarPalette; value: number; onChange: (v: number) => void; dark: boolean }) {
  const { t } = useTranslation('pipeline')
  const isDark = sgFilterIsDark(sp, dark)
  const rowSel = isDark ? 'rgba(255,255,255,.08)' : '#F4F5F7'
  const boxBorder = isDark ? 'rgba(255,255,255,.28)' : '#CDD3DB'
  const opts = [
    { k: 7,  label: t('board.filter.lastDays', { count: 7 }) },
    { k: 30, label: t('board.filter.lastDays', { count: 30 }) },
    { k: 60, label: t('board.filter.lastDays', { count: 60 }) },
    { k: 90, label: t('board.filter.lastDays', { count: 90 }) },
    { k: 0,  label: t('board.filter.allTime') },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {opts.map(o => (
        <button key={o.k} onClick={() => onChange(o.k)} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px',
          borderRadius: 10, border: 0, cursor: 'pointer', fontFamily: 'inherit',
          background: value === o.k ? rowSel : 'transparent', textAlign: 'left',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 999,
            border: `2px solid ${value === o.k ? sp.focusBg : boxBorder}`,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            {value === o.k && <span style={{ width: 6, height: 6, borderRadius: 999, background: sp.focusBg }} />}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: value === o.k ? 700 : 500, color: sp.ink }}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
