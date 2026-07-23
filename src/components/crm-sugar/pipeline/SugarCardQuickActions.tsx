/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : actions rapides de carte deal.
 * Port du handoff crm-screen-pipeline-sugar.jsx §SugarCardQuickActions :
 * pilule flottante (survol/menu) → popover « Planifier une visite » (4 créneaux
 * + « Envoyer à MEGGA AI ») et menu « ⋯ » (Réassigner à / Archiver / Marquer
 * perdu). Le sous-menu de réassignation est rendu ACCESSIBLE (le proto avait le
 * picker construit mais aucun déclencheur — bug de câblage assumé, le README
 * liste bien « réassigner » dans les actions) ; agents réels via useTeamMembers.
 */

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { SugarPalette } from '../tokens'
import type { CrmDeal } from '../mockData'
import { useTeamMembers } from '@/hooks/useTeam'

/** Créneau proposé par le popover visite (J+1 10:00 · J+1 14:00 · J+2 11:00 · J+3 16:00). */
export interface VisitSlot {
  label: string
  day: string
  time: string
  /** Date réelle du créneau — persistée en reminder « visite » (kind visit). */
  at: Date
}

interface Props {
  sp: SugarPalette
  dark: boolean
  deal: CrmDeal
  menuOpen: boolean
  setMenuOpen: (open: boolean | ((o: boolean) => boolean)) => void
  onActiveChange: (active: boolean) => void
  onReassign: (dealId: string, member: { id: string; name: string }) => void
  onArchive: (dealId: string) => void
  onMarkLost: (dealId: string) => void
  onScheduleVisit: (dealId: string, slot: VisitSlot) => void
  onAskAiVisit: (dealId: string) => void
}

export function SugarCardQuickActions({
  sp, dark, deal, menuOpen, setMenuOpen, onActiveChange,
  onReassign, onArchive, onMarkLost, onScheduleVisit, onAskAiVisit,
}: Props) {
  const { t, i18n } = useTranslation('pipeline')
  const stop = (e: ReactMouseEvent) => { e.stopPropagation() }
  const [reassignOpen, setReassignOpen] = useState(false)
  const [visitOpen, setVisitOpen] = useState(false)
  useEffect(() => { if (!menuOpen) setReassignOpen(false) }, [menuOpen])
  useEffect(() => {
    onActiveChange(menuOpen || visitOpen || reassignOpen)
    return () => onActiveChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, visitOpen, reassignOpen])

  const visitSlots = useMemo<VisitSlot[]>(() => {
    const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' })
    const fmt = (d: Date) => `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`
    const mk = (addDays: number, time: string): VisitSlot => {
      const d = new Date()
      d.setDate(d.getDate() + addDays)
      const [h, m] = time.split(':').map(Number)
      d.setHours(h, m, 0, 0)
      const raw = weekday.format(d)
      const dayName = addDays === 1 ? t('board.card.tomorrow') : raw.charAt(0).toUpperCase() + raw.slice(1)
      return { label: `${addDays}-${time}`, day: `${dayName} ${fmt(d)}`, time, at: d }
    }
    return [mk(1, '10:00'), mk(1, '14:00'), mk(2, '11:00'), mk(3, '16:00')]
  }, [i18n.language, t])

  const { data: members = [] } = useTeamMembers()
  const team = members
    .filter(m => m.id !== deal.ownerAgentId)
    .map(m => ({ id: m.id, name: m.full_name }))

  const btnBg = dark ? '#26272A' : '#EDF0F4'
  const btnHover = dark ? '#33353A' : '#E1E6EC'
  const btnFg = sp.ink
  const rowHover = dark ? '#26272A' : '#F4F5F8'
  const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 999, border: 0,
    background: btnBg, color: btnFg, cursor: 'pointer', fontFamily: 'inherit',
    display: 'grid', placeItems: 'center',
    transition: 'background .12s',
    ...extra,
  })
  const panelHair = dark ? 'rgba(255,255,255,.07)' : 'rgba(15,23,42,.08)'
  const panelBg = dark ? '#17181A' : '#FFFFFF'
  const panelStyle: React.CSSProperties = {
    position: 'absolute', top: 32, right: 0, minWidth: 200,
    background: panelBg, border: dark ? `1px solid ${panelHair}` : 0, borderRadius: 14,
    boxShadow: sp.solidShadow,
    padding: 6, zIndex: 10, animation: 'qaFade .14s ease-out',
  }
  const rowStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 10, border: 0,
    background: 'transparent', color: sp.ink, cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600, textAlign: 'left',
  }
  const hoverIn = (e: ReactMouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = rowHover }
  const hoverOut = (e: ReactMouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'transparent' }

  return (
    <div onClick={stop} style={{
      position: 'absolute', top: 8, right: 8, display: 'flex', gap: 3, zIndex: 5,
      padding: 3, borderRadius: 999,
      background: dark ? '#17181A' : '#FFFFFF',
      boxShadow: dark ? '0 6px 20px rgba(0,0,0,.55)' : '0 3px 12px rgba(15,23,42,.16), 0 1px 4px rgba(15,23,42,.08)',
      animation: 'qaFade .14s ease-out',
    }}>
      <div style={{ position: 'relative' }}>
        <button title={t('board.card.scheduleVisit')}
          onClick={(e) => { stop(e); setVisitOpen(o => !o); setMenuOpen(false) }}
          style={btn(visitOpen ? { background: sp.accent, color: sp.accentInk } : {})}
          onMouseEnter={(e) => { if (!visitOpen) e.currentTarget.style.background = btnHover }}
          onMouseLeave={(e) => { if (!visitOpen) e.currentTarget.style.background = btnBg }}>
          <MEIcon name="home" size={11} color={visitOpen ? sp.accentInk : btnFg} />
        </button>
        {visitOpen && (
          <div style={{ ...panelStyle, minWidth: 210 }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4,
              textTransform: 'uppercase', padding: '2px 8px 8px',
            }}>
              {t('board.card.scheduleVisit')}
            </div>
            {visitSlots.map(slot => (
              <button key={slot.label}
                onClick={() => { setVisitOpen(false); onScheduleVisit(deal.id, slot) }}
                style={rowStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <MEIcon name="calendar" size={12} color={sp.soft} />
                <span style={{ flex: 1 }}>{slot.day}</span>
                <span style={{ color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>{slot.time}</span>
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${panelHair}`, marginTop: 6, paddingTop: 6 }}>
              <button
                onClick={() => { setVisitOpen(false); onAskAiVisit(deal.id) }}
                style={rowStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <MEIcon name="sparkle" size={12} color={sp.ink} />
                <span style={{ flex: 1 }}>{t('board.card.sendToAi')}</span>
                <MEIcon name="chevron-right" size={12} color={sp.sub} />
              </button>
            </div>
          </div>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <button title={t('board.card.moreOptions')}
          onClick={(e) => { stop(e); setMenuOpen(o => !o) }}
          style={btn(menuOpen ? { background: sp.accent, color: sp.accentInk } : {})}
          onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.background = btnHover }}
          onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = btnBg }}>
          <MEIcon name="more-horizontal" size={14} color={menuOpen ? sp.accentInk : btnFg} />
        </button>
        {menuOpen && !reassignOpen && (
          <div style={panelStyle}>
            {team.length > 0 && (
              <SugarMenuItem sp={sp} dark={dark} icon="users" label={t('board.card.reassign')} chevron
                onClick={() => setReassignOpen(true)} />
            )}
            <SugarMenuItem sp={sp} dark={dark} icon="file" label={t('board.card.archive')}
              onClick={() => { setMenuOpen(false); onArchive(deal.id) }} />
            <SugarMenuItem sp={sp} dark={dark} icon="alert" label={t('board.card.markLost')} tone="danger"
              onClick={() => { setMenuOpen(false); onMarkLost(deal.id) }} />
          </div>
        )}
        {menuOpen && reassignOpen && (
          <div style={{ ...panelStyle, minWidth: 220, maxHeight: 300, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 8px' }}>
              <button onClick={() => setReassignOpen(false)} style={{
                width: 22, height: 22, borderRadius: 999, border: 0, cursor: 'pointer',
                background: rowHover, display: 'grid', placeItems: 'center', fontFamily: 'inherit',
              }}>
                <MEIcon name="chevron-left" size={11} color={sp.ink} />
              </button>
              <span style={{
                fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4, textTransform: 'uppercase',
              }}>{t('board.card.reassignTo')}</span>
            </div>
            {team.map(m => (
              <SugarAgentItem key={m.id} sp={sp} dark={dark} member={m}
                onClick={() => { setMenuOpen(false); onReassign(deal.id, m) }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SugarAgentItem({ sp, member, onClick, dark }: {
  sp: SugarPalette
  member: { id: string; name: string }
  onClick: () => void
  dark: boolean
}) {
  const [hov, setHov] = useState(false)
  const initials = member.name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '7px 8px', borderRadius: 10, border: 0,
        background: hov ? (dark ? '#26272A' : '#F4F5F8') : 'transparent',
        color: sp.ink, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
      }}>
      <span style={{
        width: 26, height: 26, borderRadius: 999, background: '#0041D9', color: '#fff',
        fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>{initials}</span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{member.name}</span>
      </span>
    </button>
  )
}

function SugarMenuItem({ sp, icon, label, tone, onClick, dark, chevron }: {
  sp: SugarPalette
  icon: MEIconName
  label: string
  tone?: 'danger'
  onClick: () => void
  dark: boolean
  chevron?: boolean
}) {
  const danger = tone === 'danger'
  const dangerInk = danger ? (dark ? '#F26B65' : '#A11C16') : sp.ink
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '8px 10px', borderRadius: 10, border: 0,
        background: hov ? (danger ? 'rgba(242,107,101,0.14)' : (dark ? '#26272A' : '#F4F5F8')) : 'transparent',
        color: dangerInk, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600,
        textAlign: 'left',
      }}>
      <MEIcon name={icon} size={12} color={danger ? dangerInk : sp.soft} />
      <span style={{ flex: 1 }}>{label}</span>
      {chevron && <MEIcon name="chevron-right" size={12} color={sp.sub} />}
    </button>
  )
}
