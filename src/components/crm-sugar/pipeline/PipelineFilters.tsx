// MEGGA CRM Sugar v2 — Pipeline filters + KPI tiles + segmented view.
// 1:1 port from the Claude Design bundle (crm-screen-pipeline-sugar.jsx).

import { useState, useEffect, useRef, type ReactNode } from 'react'
import MEIcon from '@/components/propertyx/MEIcon'
import { CRM_STAGES, CRM_STAGE_ORDER, type SugarPalette, type StageId } from '../tokens'

// ─── KPI Tile ──────────────────────────────────────────────────────────
interface KpiTileProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
  sp: SugarPalette
  dark: boolean
}
export function SugarKpiTile({ label, value, sub, accent, sp, dark }: KpiTileProps) {
  return (
    <div style={{
      background: dark ? 'transparent' : 'rgba(255,255,255,.55)',
      border: `1px solid ${sp.cardBorder}`,
      borderRadius: 20, padding: '16px 18px',
      boxShadow: dark ? 'none' : sp.shadowSm,
      backdropFilter: dark ? 'none' : 'blur(6px)',
      WebkitBackdropFilter: dark ? 'none' : 'blur(6px)',
      flex: 1, minWidth: 0,
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.4, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontSize: 26, fontWeight: 800, color: accent || sp.ink,
        letterSpacing: -0.6, marginTop: 6, fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 4, fontWeight: 600 }}>{sub}</div>
      )}
    </div>
  )
}

// ─── Segmented view (Kanban / Liste) ──────────────────────────────────
// 'timeline' retiré : PipelineTimeline iterait CRM_DEALS mock + pas de dates
// start/end réelles par deal. Réintroductible quand spec produit définie.
export type PipelineView = 'kanban' | 'list'

export function SugarSegmentedView({
  value, onChange, sp,
}: { value: PipelineView; onChange?: (v: PipelineView) => void; sp: SugarPalette }) {
  return (
    <div style={{
      display: 'flex', padding: 4, background: sp.cardBg,
      border: `1px solid ${sp.cardBorder}`, borderRadius: 999,
      boxShadow: sp.shadowSm,
    }}>
      {([
        { k: 'kanban' as const,   label: 'Kanban' },
        { k: 'list' as const,     label: 'Liste' },
      ]).map(v => (
        <button key={v.k} onClick={() => onChange?.(v.k)} style={{
          padding: '9px 18px', borderRadius: 999, border: 0, cursor: 'pointer',
          background: value === v.k ? sp.ink : 'transparent',
          color: value === v.k ? sp.pageBg : sp.soft,
          fontWeight: value === v.k ? 700 : 500, fontSize: 13,
          fontFamily: 'inherit',
          boxShadow: value === v.k ? sp.focusShadow : 'none',
        }}>{v.label}</button>
      ))}
    </div>
  )
}

// ─── Filter pill (with popover) ────────────────────────────────────────
interface FilterPillProps {
  sp: SugarPalette
  label: string
  value: string
  active: boolean
  children: ReactNode
  dark: boolean
}
export function SugarFilterPill({ sp, label, value, active, children, dark }: FilterPillProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        height: 44, padding: '0 16px', borderRadius: 999, border: 0,
        background: active ? sp.ink : sp.cardBg,
        boxShadow: sp.shadowSm,
        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{
          fontSize: 11, color: active ? 'rgba(255,255,255,.65)' : sp.sub, fontWeight: 600,
        }}>{label}</span>
        <span style={{
          fontSize: 12.5, color: active ? sp.pageBg : sp.ink, fontWeight: 700,
        }}>{value}</span>
        <MEIcon name="chevron-down" size={11} color={active ? 'rgba(255,255,255,.65)' : sp.sub} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: dark ? '#181B22' : 'rgba(255,255,255,.96)',
          border: `1px solid ${dark ? 'rgba(255,255,255,.09)' : sp.cardBorder}`,
          borderRadius: 16,
          boxShadow: dark
            ? '0 12px 34px -10px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.35)'
            : '0 10px 30px -10px rgba(14,20,16,.18), 0 2px 8px rgba(14,20,16,.06)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          padding: 10, zIndex: 50, minWidth: 220,
          animation: 'sfPop .16s cubic-bezier(.2,.7,.2,1)',
        }}>
          <style>{`@keyframes sfPop { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }`}</style>
          {children}
          <div style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,.09)' : sp.cardBorder}`, marginTop: 8, paddingTop: 8 }}>
            <button onClick={() => setOpen(false)} style={{
              width: '100%', padding: '8px 0', borderRadius: 10, border: 0, cursor: 'pointer',
              background: sp.focusBg, color: sp.focusInk, fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
            }}>Appliquer</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stage filter ──────────────────────────────────────────────────────
export function SugarStageFilter({
  sp, value, onChange, dark,
}: { sp: SugarPalette; value: StageId[]; onChange: (v: StageId[]) => void; dark: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4, padding: '0 4px',
      }}>Étapes</div>
      {CRM_STAGE_ORDER.map(s => {
        const info = CRM_STAGES[s]
        const sel = value.includes(s)
        return (
          <button key={s}
            onClick={() => onChange(sel ? value.filter(x => x !== s) : [...value, s])}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px',
              borderRadius: 10, border: 0, cursor: 'pointer', fontFamily: 'inherit',
              background: sel ? (dark ? 'rgba(255,255,255,.08)' : '#F4F5F7') : 'transparent', textAlign: 'left',
            }}>
            <span style={{
              width: 16, height: 16, borderRadius: 4,
              border: `2px solid ${sel ? sp.focusBg : (dark ? 'rgba(255,255,255,.28)' : '#CDD3DB')}`,
              background: sel ? sp.focusBg : 'transparent',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              {sel && <svg width="9" height="9" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5 4-4" stroke={sp.focusInk} strokeWidth="1.6" strokeLinecap="round" fill="none"/></svg>}
            </span>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: info.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: sel ? 700 : 500, color: sp.ink }}>{info.label}</span>
          </button>
        )
      })}
      {value.length > 0 && (
        <button onClick={() => onChange([])} style={{
          marginTop: 4, padding: '5px 8px', borderRadius: 8, border: 0, cursor: 'pointer',
          background: 'transparent', color: sp.sub,
          fontSize: 11, fontWeight: 600, fontFamily: 'inherit', textAlign: 'left',
        }}>Tout déselectionner</button>
      )}
    </div>
  )
}

// ─── Risk filter ───────────────────────────────────────────────────────
export type RiskFilterValue = 'all' | 'healthy' | 'at-risk' | 'stalled'

export function SugarRiskFilter({
  sp, value, onChange, dark,
}: { sp: SugarPalette; value: RiskFilterValue; onChange: (v: RiskFilterValue) => void; dark: boolean }) {
  const opts: { k: RiskFilterValue; label: string; dot: string }[] = [
    { k: 'all',      label: 'Tous',      dot: sp.sub },
    { k: 'healthy',  label: 'Sain',      dot: '#0E9F6E' },
    { k: 'at-risk',  label: 'À risque',  dot: '#F59E0B' },
    { k: 'stalled',  label: 'Bloqué',    dot: '#E53935' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4, padding: '0 4px',
      }}>Risque</div>
      {opts.map(o => (
        <button key={o.k} onClick={() => onChange(o.k)} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px',
          borderRadius: 10, border: 0, cursor: 'pointer', fontFamily: 'inherit',
          background: value === o.k ? (dark ? 'rgba(255,255,255,.08)' : '#F4F5F7') : 'transparent', textAlign: 'left',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 999,
            border: `2px solid ${value === o.k ? sp.focusBg : (dark ? 'rgba(255,255,255,.28)' : '#CDD3DB')}`,
            background: value === o.k ? sp.focusBg : 'transparent',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            {value === o.k && <span style={{ width: 6, height: 6, borderRadius: 999, background: sp.focusInk }} />}
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
  const opts = [
    { k: 7,  label: '7 derniers jours' },
    { k: 30, label: '30 derniers jours' },
    { k: 60, label: '60 derniers jours' },
    { k: 90, label: '90 derniers jours' },
    { k: 0,  label: 'Tous' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: sp.sub,
        letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4, padding: '0 4px',
      }}>Période</div>
      {opts.map(o => (
        <button key={o.k} onClick={() => onChange(o.k)} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px',
          borderRadius: 10, border: 0, cursor: 'pointer', fontFamily: 'inherit',
          background: value === o.k ? (dark ? 'rgba(255,255,255,.08)' : '#F4F5F7') : 'transparent', textAlign: 'left',
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 999,
            border: `2px solid ${value === o.k ? sp.focusBg : (dark ? 'rgba(255,255,255,.28)' : '#CDD3DB')}`,
            background: value === o.k ? sp.focusBg : 'transparent',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            {value === o.k && <span style={{ width: 6, height: 6, borderRadius: 999, background: sp.focusInk }} />}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: value === o.k ? 700 : 500, color: sp.ink }}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
