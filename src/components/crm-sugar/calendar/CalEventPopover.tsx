// MEGGA CRM Sugar — Calendar — Bulle détail événement (« façon Google »)
// Petite carte ancrée près de l'événement cliqué, portée dans document.body
// (échappe au clip du bento). Déplaçable. Actions : modifier · supprimer ·
// marquer terminé · itinéraire. Les événements externes « Occupé » sont en
// LECTURE SEULE (pas de modifier/supprimer/terminé).

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalIcon, type CalIconName } from './CalIcon'
import { CAL_RECUR_LABEL, calConflicts, calTypeStyle, useCalPalette, type CalEvent } from './data'
import { fmtDate, fmtTime, sameDay, shadeMix } from './helpers'

function CalPopIconBtn({ name, title, onClick, danger }: { name: CalIconName; title: string; onClick: () => void; danger?: boolean }) {
  const SP = useCalPalette()
  const col = danger ? SP.dangerInk : SP.inkSoft
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ width: 32, height: 32, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
      onMouseEnter={e => { e.currentTarget.style.background = SP.cardSubtle }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <CalIcon name={name} size={16} stroke={col} sw={2} />
    </button>
  )
}

function CalMiniRow({ icon, children }: { icon: CalIconName; children: ReactNode }) {
  const SP = useCalPalette()
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: SP.inkSoft, lineHeight: 1.4 }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}><CalIcon name={icon} size={15} stroke={SP.muted} sw={1.9} /></span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  )
}

function CalPopAction({ icon, label, onClick }: { icon: CalIconName; label: string; onClick: () => void }) {
  const SP = useCalPalette()
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, height: 40, borderRadius: 'var(--crm-radius-lg)', border: 0, background: SP.cardSubtle, color: SP.ink,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)',
      }}
    >
      <CalIcon name={icon} size={14} stroke={SP.ink} sw={2} />{label}
    </button>
  )
}

interface CalEventPopoverProps {
  event: CalEvent
  anchorRect: DOMRect | null
  allEvents: CalEvent[]
  onClose: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onStatus: (id: string, status: 'done') => void
}

export function CalEventPopover({ event, anchorRect, allEvents, onClose, onEdit, onDelete, onStatus }: CalEventPopoverProps) {
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: -9999, top: -9999 })
  const W = 336

  useLayoutEffect(() => {
    const r = anchorRect
    const h = ref.current?.offsetHeight || 320
    const M = 14
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left: number
    let top: number
    if (r) {
      left = r.right + 12
      if (left + W > vw - M) left = r.left - W - 12
      if (left < M) left = Math.max(M, (vw - W) / 2)
      top = r.top
      if (top + h > vh - M) top = vh - h - M
      if (top < M) top = M
    } else {
      left = (vw - W) / 2
      top = (vh - h) / 2
    }
    setPos({ left, top })
  }, [anchorRect, event])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Déplaçable : glisser la barre de titre repositionne la bulle.
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
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    document.body.style.userSelect = 'none'
  }

  const ts = calTypeStyle(event, SP)
  const done = event.status === 'done'
  const cancelled = event.status === 'cancelled'
  const initials = event.contact ? event.contact.name.split(' ').map(s => s[0]).slice(0, 2).join('') : ''

  // Liens profonds CRM (id explicite → carte cliquable).
  const linkBienId = event.bienId ?? event.property?.id ?? null
  const linkContactId = event.contactId ?? null
  const openBien = () => { if (!linkBienId) return; onClose(); navigate(`/dashboard/listings/${linkBienId}`) }
  const openContact = () => { if (!linkContactId) return; onClose(); navigate(`/dashboard/contacts/${linkContactId}`) }

  const conflicts = calConflicts(event, allEvents).slice().sort((a, b) => a.start.getTime() - b.start.getTime())
  const multiDay = !sameDay(event.start, event.end)
  const propTone = event.property?.tone || '#A8B5BF'

  const node = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} />
      <div
        ref={ref}
        style={{
          position: 'absolute', left: pos.left, top: pos.top, width: W,
          // Popover = surface flottante : palier haut, comme les 3 autres du
          // calendrier. Au palier « card » il se confondait avec la grille.
          background: SP.popBg, borderRadius: 'var(--crm-radius-3xl)', boxShadow: SP.shadowHover || SP.shadow,
          padding: 'var(--crm-space-4xl)', animation: 'calPopIn .16s cubic-bezier(.2,.8,.2,1) both',
          maxHeight: 'calc(100vh - 28px)', overflowY: 'auto',
        }}
      >
        {/* Barre de titre — poignée de déplacement */}
        <div onMouseDown={startDrag} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 12, cursor: 'grab', userSelect: 'none' }}>
          <CalIcon name="grip" size={16} stroke={SP.ghost} sw={2} />
          <span style={{ width: 11, height: 11, borderRadius: 'var(--crm-radius-xs)', background: ts.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, color: SP.muted, letterSpacing: 1, textTransform: 'uppercase' }}>{ts.label}</span>
          {(done || cancelled) && (
            <span style={{
              fontSize: 'var(--crm-text-xs)', fontWeight: 800, letterSpacing: 0.5, padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)',
              background: done ? '#059669' : '#B33A2A', color: '#FFFFFF', textTransform: 'uppercase',
            }}>
              {done ? t('popover.statusDone') : t('popover.statusCancelled')}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--crm-space-2xs)' }}>
            {!event.external && <CalPopIconBtn name="edit" title={t('popover.edit')} onClick={() => onEdit(event.id)} />}
            {!event.external && <CalPopIconBtn name="trash" title={t('popover.delete')} danger onClick={() => onDelete(event.id)} />}
            <CalPopIconBtn name="close" title={t('popover.close')} onClick={onClose} />
          </div>
        </div>

        {/* Titre */}
        <div style={{
          fontSize: 'var(--crm-text-3xl)', fontWeight: 800, color: SP.ink, letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 12,
          textDecoration: done || cancelled ? 'line-through' : 'none',
        }}>
          {event.title}
        </div>

        {/* Infos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
          <CalMiniRow icon="clock">
            {event.allDay ? (
              multiDay ? (
                <span style={{ textTransform: 'capitalize' }}>{t('popover.from')} {fmtDate(event.start)} {t('popover.to')} {fmtDate(event.end)}</span>
              ) : (
                <Fragment>
                  <span style={{ textTransform: 'capitalize' }}>{fmtDate(event.start)}</span>
                  <span style={{ color: SP.muted }}> · {t('popover.fullDay')}</span>
                </Fragment>
              )
            ) : multiDay ? (
              <span style={{ textTransform: 'capitalize' }}>{fmtDate(event.start)}, {fmtTime(event.start)} → {fmtDate(event.end)}, {fmtTime(event.end)}</span>
            ) : (
              <Fragment>
                <span style={{ textTransform: 'capitalize' }}>{fmtDate(event.start)}</span>
                <span style={{ color: SP.muted }}> · {fmtTime(event.start)} – {fmtTime(event.end)}</span>
              </Fragment>
            )}
          </CalMiniRow>

          {event.recurrence && event.recurrence.freq && (
            <CalMiniRow icon="repeat">
              {CAL_RECUR_LABEL[event.recurrence.freq] || t('popover.recurrent')}
              {event.recurrence.until && <span style={{ color: SP.muted }}> · {t('popover.until')} {fmtDate(new Date(event.recurrence.until))}</span>}
            </CalMiniRow>
          )}

          {event.location && <CalMiniRow icon="pin">{event.location}</CalMiniRow>}

          {!event.external && conflicts.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--crm-space-md)', alignItems: 'flex-start', background: SP.warnBg, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-md) var(--crm-space-lg)', marginTop: 2 }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><CalIcon name="warn" size={15} stroke={SP.warnIcon} sw={2.2} /></span>
              <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 700, color: SP.warnInk, lineHeight: 1.4 }}>
                {conflicts.length === 1 ? (
                  <Fragment>
                    {t('popover.conflictOne')} « {conflicts[0].title} »
                    <span style={{ fontWeight: 600, opacity: 0.85 }}> · {fmtTime(conflicts[0].start)}–{fmtTime(conflicts[0].end)}</span>
                  </Fragment>
                ) : (
                  t('popover.conflictMany', { count: conflicts.length })
                )}
              </div>
            </div>
          )}

          {event.property && (() => {
            const inner = (
              <Fragment>
                <div style={{
                  width: 42, height: 42, borderRadius: 'var(--crm-radius-md)', flexShrink: 0,
                  background: `repeating-linear-gradient(135deg, ${propTone} 0 8px, ${shadeMix(propTone, -0.05)} 8px 16px)`,
                  display: 'grid', placeItems: 'center', color: 'rgba(11,12,14,0.22)',
                }}>
                  <CalIcon name="home" size={19} stroke="currentColor" sw={1.4} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 700, color: SP.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.property!.title}</div>
                </div>
                {linkBienId && <CalIcon name="chevR" size={16} stroke={SP.muted} sw={2.2} />}
              </Fragment>
            )
            const base: React.CSSProperties = { display: 'flex', gap: 'var(--crm-space-lg)', alignItems: 'center', background: SP.cardSubtle, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg)', marginTop: 2 }
            return linkBienId ? (
              <button
                type="button" onClick={openBien} title={t('popover.openBien')}
                style={{ ...base, width: '100%', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = SP.cardHover }}
                onMouseLeave={e => { e.currentTarget.style.background = SP.cardSubtle }}
              >{inner}</button>
            ) : (
              <div style={base}>{inner}</div>
            )
          })()}

          {event.contact && event.contact.name && (() => {
            const inner = (
              <Fragment>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-pill)', background: SP.accent, color: SP.onAccent, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-lg)', fontWeight: 800, flexShrink: 0 }}>{initials}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 700, color: SP.ink, letterSpacing: -0.2 }}>{event.contact!.name}</div>
                  <div style={{ fontSize: 'var(--crm-text-sm)', color: SP.muted, fontWeight: 600 }}>{event.contact!.phone || ''}</div>
                </div>
                {linkContactId && <CalIcon name="chevR" size={16} stroke={SP.muted} sw={2.2} />}
              </Fragment>
            )
            return linkContactId ? (
              <button
                type="button" onClick={openContact} title={t('popover.openContact')}
                style={{ display: 'flex', gap: 'var(--crm-space-lg)', alignItems: 'center', background: SP.cardSubtle, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg)', marginTop: 2, width: '100%', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = SP.cardHover }}
                onMouseLeave={e => { e.currentTarget.style.background = SP.cardSubtle }}
              >{inner}</button>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', alignItems: 'center', marginTop: 2 }}>{inner}</div>
            )
          })()}

          {event.notes && (
            <div style={{ fontSize: 'var(--crm-text-md)', color: SP.inkSoft, fontWeight: 500, lineHeight: 1.5, background: SP.cardSubtle, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-md) var(--crm-space-lg)', marginTop: 2 }}>{event.notes}</div>
          )}
        </div>

        {/* Actions contextuelles */}
        {event.location && (
          <div style={{ display: 'flex', gap: 'var(--crm-space-md)', marginTop: 14 }}>
            <CalPopAction
              icon="route" label={t('popover.itinerary')}
              onClick={() => { window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.location!)}`, '_blank', 'noopener,noreferrer') }}
            />
          </div>
        )}

        {/* Statut (RDV MEGGA) — ou mention lecture seule (externe) */}
        {event.external ? (
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: SP.muted, lineHeight: 1.5, background: SP.cardSubtle, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg) var(--crm-space-xl)', marginTop: 12 }}>
            {t('popover.readOnly', { source: ts.label })}
          </div>
        ) : (
          <button
            onClick={() => onStatus(event.id, 'done')}
            style={{
              width: '100%', marginTop: 10, height: 42, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 'var(--crm-text-lg)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)',
              background: done ? SP.accent : SP.cardSubtle, color: done ? SP.onAccent : SP.ink,
              boxShadow: done ? SP.shadowSm : 'none',
            }}
          >
            <CalIcon name="check" size={15} stroke={done ? SP.onAccent : SP.ink} sw={2.6} />
            {done ? t('popover.done') : t('popover.markDone')}
          </button>
        )}
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
