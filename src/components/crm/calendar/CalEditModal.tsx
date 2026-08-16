// MEGGA CRM Sugar — Calendar — Modale de création / édition d'un événement
// Modale centrée (portée dans document.body), grammaire Sugar Pure, déplaçable.
// Déclenchée par « Nouvel événement », un clic sur un créneau vide (pré-rempli)
// ou « Modifier » depuis la bulle. Sélecteurs date/heure custom + liens CRM réels.

import { crmVoileEncre } from '@/components/crm/tokens'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { CalIcon, type CalIconName } from './CalIcon'
import {
  CAL_EVENT_COLORS, CAL_EVENT_TYPES, CAL_RECUR_LABEL, calNormalizeDraft, calRecurDefaultUntil,
  eventTypeColors, useCalPalette, type CalEvent, type CalRecurFreq, type CalPalette,
} from './data'
import { calDaysFull, calMonths, calMonthsShort, sameDay } from './helpers'
import { useContacts } from '@/hooks/useContacts'
import { useAgencyProperties } from '@/hooks/useProperties'
import { formatCHF } from '@/lib/utils'
import type { ContactType } from '@/types/contact'

export interface CalEditing {
  mode: 'create' | 'edit',
  draft: CalEvent
}

// ─── Helpers date ───────────────────────────────────────────────────────────
const calToYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const calToHm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const calSetDate = (date: Date, ymd: string) => {
  const [y, m, da] = ymd.split('-').map(Number)
  const x = new Date(date)
  x.setFullYear(y, (m || 1) - 1, da || 1)
  return x
}
const calSetTime = (date: Date, hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  const x = new Date(date)
  x.setHours(h || 0, m || 0, 0, 0)
  return x
}

const RECUR_OPTS: { id: 'none' | CalRecurFreq; label: () => string }[] = [
  { id: 'none', label: () => '' },
  { id: 'daily', label: () => CAL_RECUR_LABEL.daily },
  { id: 'weekly', label: () => CAL_RECUR_LABEL.weekly },
  { id: 'biweekly', label: () => CAL_RECUR_LABEL.biweekly },
  { id: 'monthly', label: () => CAL_RECUR_LABEL.monthly },
]

const calInputStyle = (SP: CalPalette): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box', border: 0, outline: 'none',
  background: SP.cardSubtle, color: SP.ink, borderRadius: 'var(--crm-radius-md)',
  padding: 'var(--crm-space-lg) var(--crm-space-xl)', fontSize: 'var(--crm-text-lg)', fontFamily: 'inherit', fontWeight: 600,
  boxShadow: `inset 0 0 0 1px ${SP.line}`,
})

function CalField({ label, children }: { label: string; children: React.ReactNode }) {
  const SP = useCalPalette()
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)' }}>
      <span style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 400, color: SP.muted }}>{label}</span>
      {children}
    </label>
  )
}

function CalInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const SP = useCalPalette()
  return (
    <input
      {...props}
      style={{ ...calInputStyle(SP), ...(props.style || {}) }}
      onFocus={e => { e.target.style.boxShadow = `inset 0 0 0 2px ${SP.ring}` }}
      onBlur={e => { e.target.style.boxShadow = `inset 0 0 0 1px ${SP.line}` }}
    />
  )
}

// ─── Dropdown d'heure custom ────────────────────────────────────────────────
function CalTimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const SP = useCalPalette()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const opts = useMemo(() => {
    const arr: string[] = []
    for (let m = 7 * 60; m <= 21 * 60; m += 15) arr.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
    if (value && !arr.includes(value)) { arr.push(value); arr.sort() }
    return arr
  }, [value])
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button" onClick={() => setOpen(o => !o)}
        style={{ ...calInputStyle(SP), display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', boxShadow: open ? `inset 0 0 0 2px ${SP.ring}` : `inset 0 0 0 1px ${SP.line}` }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
          <CalIcon name="clock" size={13} stroke={SP.inkSoft} sw={2} />{value}
        </span>
        <span style={{ display: 'grid', placeItems: 'center', transform: 'rotate(90deg)', opacity: 0.7 }}>
          <CalIcon name="chevR" size={12} stroke={SP.muted} sw={2.6} />
        </span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40, maxHeight: 200, overflowY: 'auto', background: SP.popBg, borderRadius: 'var(--crm-radius-lg)', boxShadow: SP.shadow, padding: 'var(--crm-space-sm)' }}>
          {opts.map(o => {
            const active = o === value
            return (
              <button
                key={o} type="button" onClick={() => { onChange(o); setOpen(false) }}
                style={{ width: '100%', textAlign: 'left', border: 0, cursor: 'pointer', fontFamily: 'inherit', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-sm)', fontSize: 'var(--crm-text-lg)', fontWeight: 500, background: active ? SP.accent : 'transparent', color: active ? SP.onAccent : SP.ink }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = SP.cardSubtle }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {o}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Sélecteur de date custom (mini-calendrier, porté en portail) ───────────
function CalDatePicker({ value, onChange }: { value: Date; onChange: (ymd: string) => void }) {
  const SP = useCalPalette()
  const months = calMonths()
  const monthsShort = calMonthsShort()
  const daysFull = calDaysFull()
  const [open, setOpen] = useState(false)
  const [viewM, setViewM] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1))
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: -9999, top: -9999 })

  useEffect(() => { if (open) setViewM(new Date(value.getFullYear(), value.getMonth(), 1)) }, [open, value])

  useLayoutEffect(() => {
    if (!open) return
    const b = btnRef.current
    if (!b) return
    const r = b.getBoundingClientRect()
    const W = 292
    const H = 336
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
    let top = r.bottom + 6
    if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 6)
    setPos({ left, top })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey, true) }
  }, [open])

  const first = new Date(viewM.getFullYear(), viewM.getMonth(), 1)
  const last = new Date(viewM.getFullYear(), viewM.getMonth() + 1, 0)
  const startOffset = (first.getDay() + 6) % 7
  const cells: { d: Date; mute: boolean }[] = []
  for (let i = 0; i < startOffset; i++) { const d = new Date(first); d.setDate(d.getDate() - (startOffset - i)); cells.push({ d, mute: true }) }
  for (let i = 1; i <= last.getDate(); i++) cells.push({ d: new Date(viewM.getFullYear(), viewM.getMonth(), i), mute: false })
  while (cells.length % 7) { const d = new Date(cells[cells.length - 1].d); d.setDate(d.getDate() + 1); cells.push({ d, mute: true }) }

  const today = new Date()
  const wd = [1, 2, 3, 4, 5, 6, 0].map(i => (daysFull[i] || '').slice(0, 2))
  const label = `${daysFull[value.getDay()]} ${value.getDate()} ${monthsShort[value.getMonth()]} ${value.getFullYear()}`

  const navBtn = (name: CalIconName, onClick: () => void) => (
    <button
      type="button" onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', color: SP.inkSoft, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
      onMouseEnter={e => { e.currentTarget.style.background = SP.cardSubtle }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <CalIcon name={name} size={16} stroke={SP.inkSoft} sw={2.2} />
    </button>
  )

  const pop = open
    ? createPortal(
        <div ref={popRef} style={{ position: 'fixed', left: pos.left, top: pos.top, width: 292, zIndex: 4300, background: SP.popBg, borderRadius: 'var(--crm-radius-2xl)', boxShadow: SP.shadow, padding: 'var(--crm-space-xl)', fontFamily: 'inherit', animation: 'calPopIn .14s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            {navBtn('chevL', () => setViewM(new Date(viewM.getFullYear(), viewM.getMonth() - 1, 1)))}
            <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 500, color: SP.ink }}>{months[viewM.getMonth()]} {viewM.getFullYear()}</span>
            {navBtn('chevR', () => setViewM(new Date(viewM.getFullYear(), viewM.getMonth() + 1, 1)))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 'var(--crm-space-2xs)', marginBottom: 4 }}>
            {wd.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: SP.muted , padding: 'var(--crm-space-2xs) 0' }}>{w}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 'var(--crm-space-2xs)' }}>
            {cells.map(({ d, mute }, i) => {
              const selected = sameDay(d, value)
              const isToday = sameDay(d, today)
              return (
                <button
                  key={i} type="button" onClick={() => { onChange(calToYmd(d)); setOpen(false) }}
                  style={{
                    height: 34, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 'var(--crm-text-lg)', fontWeight: selected ? 600 : 500,
                    background: selected ? SP.accent : 'transparent',
                    color: selected ? SP.onAccent : mute ? SP.ghost : SP.ink,
                    boxShadow: isToday && !selected ? `inset 0 0 0 1.5px ${SP.line}` : 'none',
                    display: 'grid', placeItems: 'center',
                  }}
                  onMouseEnter={e => { if (!selected) e.currentTarget.style.background = SP.cardSubtle }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <Fragment>
      <button
        ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
        style={{ ...calInputStyle(SP), display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', boxShadow: open ? `inset 0 0 0 2px ${SP.ring}` : `inset 0 0 0 1px ${SP.line}` }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <CalIcon name="calendar" size={14} stroke={SP.inkSoft} sw={2} />{label}
        </span>
        <span style={{ display: 'grid', placeItems: 'center', transform: 'rotate(90deg)', opacity: 0.7 }}>
          <CalIcon name="chevR" size={12} stroke={SP.muted} sw={2.6} />
        </span>
      </button>
      {pop}
    </Fragment>
  )
}

// ─── Sélecteur d'entité CRM (contact / bien) — recherche + liste ────────────
interface LinkItem {
  id: string
  title: string
  subtitle?: string
  avatarText?: string
  avatarBg?: string
  tone?: string
  search: string
}

function CalLinkPicker({
  icon, placeholder, selected, items, onSelect, onClear,
}: {
  icon: CalIconName
  placeholder: string
  selected: LinkItem | null
  items: LinkItem[]
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const btnRef = useRef<HTMLElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ left: -9999, top: -9999, width: 300 })

  useLayoutEffect(() => {
    if (!open) return
    const b = btnRef.current
    if (!b) return
    const r = b.getBoundingClientRect()
    const W = Math.max(260, r.width)
    const H = 320
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
    let top = r.bottom + 6
    if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 6)
    setPos({ left, top, width: W })
  }, [open])

  useEffect(() => {
    if (!open) return
    setQ('')
    const tm = setTimeout(() => inputRef.current?.focus(), 30)
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    return () => { clearTimeout(tm); document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey, true) }
  }, [open])

  const filtered = q.trim() ? items.filter(it => it.search.includes(q.trim().toLowerCase())) : items

  const avatar = (it: LinkItem, size = 34) =>
    it.avatarText != null ? (
      <div style={{ width: size, height: size, borderRadius: 'var(--crm-radius-pill)', background: it.avatarBg || SP.accent, color: '#fff', display: 'grid', placeItems: 'center', fontSize: Math.round(size * 0.38), fontWeight: 500, flexShrink: 0 }}>{it.avatarText}</div>
    ) : (
      <div style={{ width: size, height: size, borderRadius: 'var(--crm-radius-sm)', flexShrink: 0, background: it.tone || SP.muted, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.92)' }}><CalIcon name="home" size={Math.round(size * 0.5)} stroke="currentColor" sw={1.6} /></div>
    )

  const row = (it: LinkItem) => (
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ display: 'block', fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: SP.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
      {it.subtitle && <span style={{ display: 'block', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SP.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.subtitle}</span>}
    </span>
  )

  const pop = open
    ? createPortal(
        <div ref={popRef} style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width, zIndex: 4300, background: SP.popBg, borderRadius: 'var(--crm-radius-2xl)', boxShadow: SP.shadow, padding: 'var(--crm-space-md)', fontFamily: 'inherit', animation: 'calPopIn .14s cubic-bezier(.2,.8,.2,1) both', display: 'flex', flexDirection: 'column', maxHeight: 320 }}>
          <div style={{ marginBottom: 6, flexShrink: 0 }}>
            <input
              ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder={t('modal.search')}
              style={{ width: '100%', boxSizing: 'border-box', border: 0, outline: 'none', background: SP.cardSubtle, color: SP.ink, borderRadius: 'var(--crm-radius-md)', padding: 'var(--crm-space-md) var(--crm-space-xl)', fontSize: 'var(--crm-text-lg)', fontFamily: 'inherit', fontWeight: 600, boxShadow: `inset 0 0 0 1px ${SP.line}` }}
            />
          </div>
          <div style={{ overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
            {filtered.length === 0 && <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-xl)', fontSize: 'var(--crm-text-md)', color: SP.muted, fontWeight: 600 }}>{t('modal.noResults')}</div>}
            {filtered.map(it => {
              const active = selected?.id === it.id
              return (
                <button
                  key={it.id} type="button" onClick={() => { onSelect(it.id); setOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', width: '100%', textAlign: 'left', border: 0, cursor: 'pointer', padding: 'var(--crm-space-sm) var(--crm-space-md)', borderRadius: 'var(--crm-radius-md)', background: active ? SP.cardSubtle : 'transparent', fontFamily: 'inherit' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = SP.cardSubtle }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  {avatar(it, 34)}
                  {row(it)}
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <Fragment>
      {selected ? (
        <div ref={btnRef as React.RefObject<HTMLDivElement>} style={{ ...calInputStyle(SP), display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-sm) var(--crm-space-md) var(--crm-space-sm) var(--crm-space-lg)' }}>
          {avatar(selected, 30)}
          {row(selected)}
          <button type="button" onClick={() => setOpen(true)} title={t('modal.change')} style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', color: SP.inkSoft, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <CalIcon name="edit" size={14} stroke={SP.inkSoft} sw={2} />
          </button>
          <button type="button" onClick={onClear} title={t('modal.remove')} style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', color: SP.muted, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <CalIcon name="close" size={14} stroke={SP.muted} sw={2.2} />
          </button>
        </div>
      ) : (
        <button
          ref={btnRef as React.RefObject<HTMLButtonElement>} type="button" onClick={() => setOpen(o => !o)}
          style={{ ...calInputStyle(SP), display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: SP.muted, boxShadow: open ? `inset 0 0 0 2px ${SP.ring}` : `inset 0 0 0 1px ${SP.line}` }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
            <CalIcon name={icon} size={15} stroke={SP.muted} sw={2} />{placeholder}
          </span>
          <span style={{ display: 'grid', placeItems: 'center', transform: 'rotate(90deg)', opacity: 0.7 }}>
            <CalIcon name="chevR" size={12} stroke={SP.muted} sw={2.6} />
          </span>
        </button>
      )}
      {pop}
    </Fragment>
  )
}

// ─── MODALE ─────────────────────────────────────────────────────────────────
interface CalEditModalProps {
  editing: CalEditing
  onSave: (draft: CalEvent) => void
  onCancel: () => void
  onDelete?: (id: string) => void
}

const PROPERTY_TONE = '#A8B5BF'

export function CalEditModal({ editing, onSave, onCancel, onDelete }: CalEditModalProps) {
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  const [d, setD] = useState<CalEvent>(editing.draft)
  const set = (patch: Partial<CalEvent>) => setD(prev => ({ ...prev, ...patch }))
  const isCreate = editing.mode === 'create'
  // Une VISITE ne peut être créée sans contact ET bien (contrainte table visits) :
  // sinon elle serait persistée en reminder et rechargerait avec un autre type.
  // (À la création seulement — éditer une visite existante ne l'exige pas.)
  const blockVisitCreate = isCreate && d.type === 'visite' && (!d.contactId || !d.bienId)

  const { contacts } = useContacts()
  const { data: properties = [] } = useAgencyProperties()

  const roleLabel = (type: ContactType): string => t(`role.${type}`, { defaultValue: t('role.contact') })

  const contactItems: LinkItem[] = useMemo(
    () => (contacts || []).map(c => ({
      id: c.id,
      title: `${c.first_name} ${c.last_name}`.trim(),
      avatarText: ((c.first_name[0] || '') + (c.last_name[0] || '')).toUpperCase(),
      avatarBg: SP.accent,
      search: `${c.first_name} ${c.last_name} ${c.email || ''} ${c.phone || ''}`.toLowerCase(),
    })),
    [contacts, SP.accent],
  )
  const bienItems: LinkItem[] = useMemo(
    () => properties.map(p => ({
      id: p.id,
      title: p.title,
      subtitle: [p.address, p.city].filter(Boolean).join(', '),
      tone: PROPERTY_TONE,
      search: `${p.title} ${p.address || ''} ${p.city || ''}`.toLowerCase(),
    })),
    [properties],
  )

  const pickContact = (id: string) => {
    const c = (contacts || []).find(x => x.id === id)
    if (!c) return
    set({ contactId: id, contact: { name: `${c.first_name} ${c.last_name}`.trim(), role: roleLabel(c.type), phone: c.phone || '' } })
  }
  const pickBien = (id: string) => {
    const p = properties.find(x => x.id === id)
    if (!p) return
    const addr = [p.address, p.city].filter(Boolean).join(', ')
    set({
      bienId: id,
      property: { id: p.id, title: p.title, area: p.surface_m2 ?? null, price: p.price ?? null, tone: PROPERTY_TONE, addr },
      location: d.location?.trim() ? d.location : addr,
    })
  }

  const selContact: LinkItem | null = d.contact && d.contact.name ? {
    id: d.contactId || 'current',
    title: d.contact.name,
    avatarText: d.contact.name.split(' ').filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase(),
    avatarBg: SP.accent,
    search: '',
  } : null
  const selBien: LinkItem | null = d.property && d.property.title ? {
    id: d.bienId || 'current',
    title: d.property.title,
    subtitle: d.property.addr || (d.property.price ? formatCHF(d.property.price) : ''),
    tone: d.property.tone || SP.muted,
    search: '',
  } : null

  // ── Récurrence ──
  const setRecur = (freq: 'none' | CalRecurFreq) => {
    if (freq === 'none') { set({ recurrence: null }); return }
    set({ recurrence: { freq, until: d.recurrence?.until ?? null } })
  }
  const recurPill = (active: boolean): React.CSSProperties => ({
    padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: 0,
    background: active ? SP.cardSubtle : 'transparent',
    boxShadow: active ? `inset 0 0 0 2px ${SP.ring}` : `inset 0 0 0 1px ${SP.line}`,
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: SP.ink, whiteSpace: 'nowrap',
  })

  // ── Dates début/fin (supporte le multi-jours) ──
  const setStartDate = (ymd: string) => {
    const ns = calSetDate(d.start, ymd)
    let ne = d.end
    if (ne.getTime() < ns.getTime()) ne = calSetDate(d.end, ymd)
    set({ start: ns, end: ne })
  }
  const setEndDate = (ymd: string) => {
    let ne = calSetDate(d.end, ymd)
    if (ne.getTime() < d.start.getTime()) ne = calSetDate(d.end, calToYmd(d.start))
    set({ end: ne })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const modalShadow = SP.isDark
    ? '0 30px 80px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.06)'
    : `0 40px 100px ${crmVoileEncre(false, 0.20)}, 0 8px 24px ${crmVoileEncre(false, 0.10)}`

  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: -9999, top: -9999 })
  useLayoutEffect(() => {
    const el = ref.current
    const w = 460
    const h = el ? el.offsetHeight : 520
    setPos({ left: Math.max(12, (window.innerWidth - w) / 2), top: Math.max(16, (window.innerHeight - h) / 2) })
  }, [])

  const startDrag = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (e.button !== 0 || target.closest('button, input, textarea, select, a, [data-no-drag]')) return
    e.preventDefault()
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const offX = e.clientX - r.left
    const offY = e.clientY - r.top
    const move = (ev: MouseEvent) => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      const M = 8
      setPos({
        left: Math.max(M, Math.min(window.innerWidth - w - M, ev.clientX - offX)),
        top: Math.max(M, Math.min(window.innerHeight - h - M, ev.clientY - offY)),
      })
    }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.userSelect = '' }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    document.body.style.userSelect = 'none'
  }

  const recurLabel = (id: 'none' | CalRecurFreq) => (id === 'none' ? t('modal.recurNone') : RECUR_OPTS.find(o => o.id === id)!.label())

  const node = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4200 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0 }} />
      <div
        ref={ref}
        style={{
          position: 'fixed', left: pos.left, top: pos.top, width: 460, maxWidth: 'calc(100vw - 24px)', maxHeight: '88vh',
          background: SP.popBg, borderRadius: 'var(--crm-radius-4xl)', boxShadow: modalShadow,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'calPopIn .18s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {/* Barre de titre déplaçable */}
        <div onMouseDown={startDrag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--crm-space-md) var(--crm-space-lg) var(--crm-space-md) var(--crm-space-2xl)', background: SP.cardSubtle, cursor: 'grab', userSelect: 'none', flexShrink: 0 }}>
          <CalIcon name="grip" size={18} stroke={SP.muted} sw={2} />
          <button onClick={onCancel} title={t('popover.close')} data-no-drag style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', color: SP.inkSoft, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <CalIcon name="close" size={16} stroke={SP.inkSoft} sw={2.2} />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: 'var(--crm-space-4xl) var(--crm-space-5xl) var(--crm-space-5xl)' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: SP.ink, letterSpacing: -0.5 }}>{isCreate ? t('modal.newEvent') : t('modal.editEvent')}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
            {/* Type */}
            <CalField label={t('modal.type')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
                {Object.values(CAL_EVENT_TYPES).map(tp => {
                  const active = d.type === tp.id
                  const dot = tp.id === 'autre' ? (d.color || tp.accent) : eventTypeColors(tp, SP.isDark).accent
                  return (
                    <button
                      key={tp.id} onClick={() => set({ type: tp.id })}
                      style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: 0, background: active ? SP.cardSubtle : 'transparent', boxShadow: active ? `inset 0 0 0 2px ${SP.ring}` : `inset 0 0 0 1px ${SP.line}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: SP.ink, whiteSpace: 'nowrap' }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: 'var(--crm-radius-2xs)', background: dot }} />
                      {tp.label}
                    </button>
                  )
                })}
              </div>
            </CalField>

            {d.type === 'autre' && (
              <CalField label={t('modal.color')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
                  {CAL_EVENT_COLORS.map(c => {
                    const active = (d.color || '#5B6472') === c.hex
                    return (
                      <button
                        key={c.id} type="button" title={c.label} onClick={() => set({ color: c.hex })}
                        style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', padding: 0, background: c.hex, display: 'grid', placeItems: 'center', boxShadow: active ? `0 0 0 2px ${SP.card}, 0 0 0 4px ${SP.ring}` : 'inset 0 0 0 1px rgba(0,0,0,0.10)' }}
                      >
                        {active && <CalIcon name="check" size={15} stroke="#FFFFFF" sw={3} />}
                      </button>
                    )
                  })}
                </div>
              </CalField>
            )}

            <CalField label={t('modal.title')}>
              <CalInput value={d.title} autoFocus onChange={e => set({ title: e.target.value })} />
            </CalField>

            {/* Journée entière + dates/heures */}
            <div>
              <button
                type="button" onClick={() => set({ allDay: !d.allDay })}
                style={{ ...recurPill(!!d.allDay), display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 12 }}
              >
                <span style={{ width: 16, height: 16, borderRadius: 'var(--crm-radius-xs)', flexShrink: 0, display: 'grid', placeItems: 'center', background: d.allDay ? SP.accent : 'transparent', boxShadow: d.allDay ? 'none' : `inset 0 0 0 1.5px ${SP.line2 || SP.line}` }}>
                  {d.allDay && <CalIcon name="check" size={11} stroke={SP.onAccent} sw={3} />}
                </span>
                {t('modal.allDay')}
              </button>

              {d.allDay ? (
                <div style={{ display: 'flex', gap: 'var(--crm-space-xl)' }}>
                  <div style={{ flex: 1 }}><CalField label={t('modal.startDate')}><CalDatePicker value={d.start} onChange={setStartDate} /></CalField></div>
                  <div style={{ flex: 1 }}><CalField label={t('modal.endDate')}><CalDatePicker value={d.end} onChange={setEndDate} /></CalField></div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
                  <div style={{ display: 'flex', gap: 'var(--crm-space-xl)' }}>
                    <div style={{ flex: 1.4 }}><CalField label={t('modal.startDate')}><CalDatePicker value={d.start} onChange={setStartDate} /></CalField></div>
                    <div style={{ flex: 1 }}><CalField label={t('modal.start')}><CalTimeSelect value={calToHm(d.start)} onChange={hm => set({ start: calSetTime(d.start, hm) })} /></CalField></div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--crm-space-xl)' }}>
                    <div style={{ flex: 1.4 }}><CalField label={t('modal.endDate')}><CalDatePicker value={d.end} onChange={setEndDate} /></CalField></div>
                    <div style={{ flex: 1 }}><CalField label={t('modal.end')}><CalTimeSelect value={calToHm(d.end)} onChange={hm => set({ end: calSetTime(d.end, hm) })} /></CalField></div>
                  </div>
                </div>
              )}
            </div>

            {/* Récurrence */}
            <CalField label={t('modal.recurrence')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
                {RECUR_OPTS.map(opt => {
                  const active = (d.recurrence?.freq ?? 'none') === opt.id
                  return <button key={opt.id} type="button" onClick={() => setRecur(opt.id)} style={recurPill(active)}>{recurLabel(opt.id)}</button>
                })}
              </div>
            </CalField>

            {d.recurrence && d.recurrence.freq && (
              <CalField label={t('modal.recurEnd')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 'var(--crm-space-sm)' }}>
                    <button type="button" onClick={() => set({ recurrence: { ...d.recurrence!, until: null } })} style={recurPill(!d.recurrence.until)}>{t('modal.recurNever')}</button>
                    <button type="button" onClick={() => set({ recurrence: { ...d.recurrence!, until: calRecurDefaultUntil(d.start) } })} style={recurPill(!!d.recurrence.until)}>{t('modal.recurUntil')}</button>
                  </div>
                  {d.recurrence.until && (
                    <div style={{ flex: 1, minWidth: 190 }}>
                      <CalDatePicker value={new Date(d.recurrence.until)} onChange={ymd => set({ recurrence: { ...d.recurrence!, until: calSetDate(new Date(d.recurrence!.until!), ymd).toISOString() } })} />
                    </div>
                  )}
                </div>
              </CalField>
            )}

            <CalField label={t('modal.location')}>
              <CalInput value={d.location || ''} onChange={e => set({ location: e.target.value })} />
            </CalField>

            {/* Rattachement CRM */}
            <CalField label={t('modal.linkedBien')}>
              <CalLinkPicker icon="home" placeholder={t('modal.associateBien')} selected={selBien} items={bienItems} onSelect={pickBien} onClear={() => set({ bienId: null, property: undefined })} />
            </CalField>

            <CalField label={t('modal.linkedContact')}>
              <CalLinkPicker icon="user" placeholder={t('modal.associateContact')} selected={selContact} items={contactItems} onSelect={pickContact} onClear={() => set({ contactId: null, contact: undefined })} />
            </CalField>

            {/* Notes */}
            <CalField label={t('modal.notes')}>
              <textarea
                value={d.notes || ''} onChange={e => set({ notes: e.target.value })}
                onFocus={e => { e.target.style.boxShadow = `inset 0 0 0 2px ${SP.ring}` }}
                onBlur={e => { e.target.style.boxShadow = `inset 0 0 0 1px ${SP.line}` }}
                style={{ ...calInputStyle(SP), minHeight: 72, resize: 'vertical', lineHeight: 1.5 }}
              />
            </CalField>
          </div>

          {/* Hint : visite sans contact/bien */}
          {blockVisitCreate && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-md)', marginTop: 16, background: SP.warnBg, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg) var(--crm-space-xl)' }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><CalIcon name="warn" size={15} stroke={SP.warnIcon} sw={2.2} /></span>
              <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: SP.warnInk, lineHeight: 1.4 }}>{t('page.selectContactAndProperty')}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 20 }}>
            {!isCreate && onDelete && (
              <button
                onClick={() => onDelete(d.id)}
                style={{ height: 46, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', color: SP.dangerInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}
              >
                <CalIcon name="trash" size={15} stroke={SP.dangerInk} sw={2.2} />{t('modal.delete')}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onCancel} style={{ height: 46, padding: '0 var(--crm-space-5xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', color: SP.inkSoft, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, cursor: 'pointer' }}>{t('modal.cancel')}</button>
            <button
              onClick={() => { if (!blockVisitCreate) onSave(calNormalizeDraft(d)) }}
              disabled={blockVisitCreate}
              style={{ height: 46, padding: '0 var(--crm-space-7xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, background: SP.accent, color: SP.onAccent, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, cursor: blockVisitCreate ? 'not-allowed' : 'pointer', opacity: blockVisitCreate ? 0.5 : 1, boxShadow: SP.shadowSm, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}
            >
              {isCreate ? t('modal.create') : t('modal.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
