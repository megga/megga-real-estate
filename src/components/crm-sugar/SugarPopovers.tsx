// MEGGA CRM Sugar v2 — Popovers, toast and contextual menus
// 1:1 port from the Claude Design bundle (crm-screen-today-sugar-popovers.jsx).

import { useState, Fragment, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { SugarPalette } from './tokens'

// ─── useSugarPopover hook ───────────────────────────────────────────────
export interface SugarPopoverState<P = unknown> {
  open: boolean
  anchorRect: DOMRect | null
  kind: string | null
  payload: P | null
  openAt: (e: ReactMouseEvent<Element>, kind: string, payload?: P) => void
  close: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSugarPopover<P = unknown>(): SugarPopoverState<P> {
  const [state, setState] = useState<{ open: boolean; anchorRect: DOMRect | null; kind: string | null; payload: P | null }>({
    open: false, anchorRect: null, kind: null, payload: null,
  })
  const openAt = (e: ReactMouseEvent<Element>, kind: string, payload?: P) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect()
    setState({ open: true, anchorRect: rect, kind, payload: payload ?? null })
  }
  const close = () => setState(s => ({ ...s, open: false }))
  return { ...state, openAt, close }
}

// ─── Anchored popover — glass surface, top-right of trigger ────────────
interface SugarPopoverProps {
  anchorRect: DOMRect | null
  sp: SugarPalette
  dark: boolean
  onClose: () => void
  width?: number
  /** Surface OPAQUE (panneaux denses type dropdown profil) — verre Sugar sinon.
   *  La couleur opaque vient des tokens (sp.solidBg…), correcte clair ET sombre. */
  solid?: boolean
  children: ReactNode
}
export function SugarPopover({ anchorRect, sp, onClose, width = 320, solid = false, children }: SugarPopoverProps) {
  if (!anchorRect) return null
  const top = anchorRect.bottom + window.scrollY + 10
  const left = anchorRect.right + window.scrollX - width
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1300,
          background: 'transparent',
        }}
      />
      <div
        role="dialog"
        style={{
          position: 'absolute',
          top, left, width,
          zIndex: 1301,
          background: solid ? sp.solidBg : sp.frameBg,
          border: `1px solid ${solid ? sp.solidBorder : sp.frameBorder}`,
          borderRadius: 20,
          boxShadow: solid ? (sp.solidShadow || sp.shadowHover || sp.shadow) : (sp.shadowHover || sp.shadow),
          backdropFilter: solid ? 'none' : 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: solid ? 'none' : 'blur(20px) saturate(140%)',
          padding: 12,
          color: sp.ink,
          animation: 'sugar-fade-up 280ms cubic-bezier(.22,1,.36,1)',
          fontFamily: '"Inter Tight", system-ui, sans-serif',
        }}
      >
        {children}
      </div>
    </>
  )
}

// ─── Toast — bottom-center confirmation ─────────────────────────────────
export function SugarToast({ message, sp }: { message: string | null; sp: SugarPalette }) {
  if (!message) return null
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      zIndex: 1400,
      background: sp.ink, color: sp.pageBg,
      padding: '12px 18px', borderRadius: 999,
      fontFamily: '"Inter Tight", system-ui, sans-serif', fontSize: 13, fontWeight: 600,
      boxShadow: sp.focusShadow,
      animation: 'sugar-toast 240ms cubic-bezier(.22,1,.36,1)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: 999,
        background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center',
      }}>
        <MEIcon name="check" size={10} color={sp.pageBg} />
      </span>
      {message}
    </div>
  )
}

// ─── Quick add menu ────────────────────────────────────────────────────
export type QuickAddId = 'task' | 'visit' | 'contact' | 'deal' | 'note'

export function SugarQuickAdd({ sp, onPick }: { sp: SugarPalette; onPick?: (id: QuickAddId) => void }) {
  const items: { id: QuickAddId; icon: MEIconName; label: string; sub: string }[] = [
    { id: 'task',    icon: 'check', label: 'Nouvelle tâche',   sub: 'Action rapide à planifier' },
    { id: 'visit',   icon: 'home',  label: 'Planifier visite', sub: 'Bien · acheteur · créneau' },
    { id: 'contact', icon: 'plus',  label: 'Nouveau contact',  sub: 'Lead, acheteur ou vendeur' },
    { id: 'deal',    icon: 'bolt',  label: 'Nouvelle offre',   sub: 'Démarrer un dossier' },
    { id: 'note',    icon: 'file',  label: 'Note interne',     sub: 'Mémo lié au jour' },
  ]
  return (
    <div>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
        color: sp.sub, padding: '4px 10px 8px',
      }}>Ajout rapide</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(it => (
          <button
            key={it.id}
            onClick={() => onPick?.(it.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left',
              borderRadius: 14, fontFamily: 'inherit', color: sp.ink,
              transition: 'background 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sp.cardSubBg }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 12, background: sp.cardSubBg,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <MEIcon name={it.icon} size={14} color={sp.ink} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink, lineHeight: 1.2 }}>{it.label}</div>
              <div style={{ fontSize: 11, color: sp.sub, marginTop: 2 }}>{it.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Reschedule ────────────────────────────────────────────────────────
export interface RescheduleSlot { id: string; label: string; sub: string }

export function SugarReschedule({ sp, currentLabel, onPick, onClose }: {
  sp: SugarPalette
  currentLabel?: string
  onPick?: (s: RescheduleSlot) => void
  onClose?: () => void
}) {
  const slots: RescheduleSlot[] = [
    { id: 'now',      label: 'Maintenant',    sub: 'Démarrer la tâche' },
    { id: 'later',    label: '+ 2 heures',    sub: 'Repousser légèrement' },
    { id: 'tomorrow', label: 'Demain matin',  sub: 'Sam. 09:00' },
    { id: 'monday',   label: 'Lundi',         sub: 'Lun. 09:00' },
    { id: 'week',     label: 'Cette semaine', sub: 'Auto-placement IA' },
  ]
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 10px',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 12, background: sp.cardSubBg,
          display: 'grid', placeItems: 'center',
        }}>
          <MEIcon name="calendar" size={14} color={sp.ink} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink }}>Replanifier</div>
          {currentLabel && (
            <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Actuellement · {currentLabel}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {slots.map(s => (
          <button
            key={s.id}
            onClick={() => { onPick?.(s); onClose?.() }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10, padding: '9px 12px', border: 0, background: 'transparent', cursor: 'pointer',
              borderRadius: 12, fontFamily: 'inherit', color: sp.ink, textAlign: 'left',
              transition: 'background 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sp.cardSubBg }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: sp.ink }}>{s.label}</div>
              <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1 }}>{s.sub}</div>
            </div>
            <MEIcon name="calendar" size={12} color={sp.soft} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Mini calendar ────────────────────────────────────────────────────
const miniNavBtn = (sp: SugarPalette) => ({
  width: 24, height: 24, borderRadius: 999, border: 0, cursor: 'pointer',
  background: sp.cardSubBg, display: 'grid', placeItems: 'center',
} as const)

export function SugarMiniCalendar({ sp }: { sp: SugarPalette; dark?: boolean }) {
  const month = 'Mai 2026'
  const startWeekday = 4 // 1 mai 2026 = vendredi (Mon=0)
  const daysInMonth = 31
  const today = 1
  const dotsByDay: Record<number, number> = {
    1: 6, 2: 0, 4: 4, 5: 3, 6: 2, 7: 5, 8: 3,
    11: 4, 12: 2, 13: 6, 14: 1, 15: 3,
    18: 2, 19: 4, 20: 3, 21: 5, 22: 2,
    25: 3, 26: 4, 27: 1, 28: 6, 29: 2,
  }
  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 10px 10px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink, letterSpacing: -0.2 }}>{month}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={miniNavBtn(sp)}><MEIcon name="chevron-left" size={11} color={sp.soft} /></button>
          <button style={miniNavBtn(sp)}><MEIcon name="chevron-right" size={11} color={sp.soft} /></button>
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
        padding: '0 6px 6px',
      }}>
        {dayLabels.map((l, i) => (
          <div key={'h' + i} style={{
            textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: sp.sub,
            letterSpacing: 0.4, padding: '4px 0',
          }}>{l}</div>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <div key={'e' + i} />
          const isToday = d === today
          const dots = dotsByDay[d] || 0
          return (
            <button key={'d' + d} style={{
              aspectRatio: '1 / 1', border: 0, cursor: 'pointer', padding: 0,
              borderRadius: 10,
              background: isToday ? sp.focusBg : 'transparent',
              color: isToday ? sp.focusInk : sp.ink,
              boxShadow: isToday ? sp.focusShadow : 'none',
              fontFamily: 'inherit', fontWeight: isToday ? 800 : 600, fontSize: 11.5,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              transition: 'background 140ms ease',
              gap: 2,
            }}
            onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = sp.cardSubBg }}
            onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = 'transparent' }}
            >
              <span>{d}</span>
              {dots > 0 && (
                <span style={{
                  width: Math.min(4 + dots, 10), height: 3, borderRadius: 999,
                  background: isToday ? 'rgba(255,255,255,0.7)' : (dots >= 5 ? '#E53935' : '#0041D9'),
                  opacity: isToday ? 1 : 0.85,
                }} />
              )}
            </button>
          )
        })}
      </div>
      <div style={{
        margin: '6px 8px 4px', padding: '10px 12px', borderRadius: 14,
        background: sp.cardSubBg, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 999, background: sp.focusBg,
          display: 'grid', placeItems: 'center', color: sp.focusInk,
          fontSize: 11, fontWeight: 800,
        }}>1</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: sp.ink }}>Aujourd'hui · 6 actions</div>
          <div style={{ fontSize: 10, color: sp.sub, marginTop: 1 }}>2 relances · 3 qualifs · 1 offre</div>
        </div>
        <button style={{
          height: 28, padding: '0 10px', borderRadius: 999, border: 0, cursor: 'pointer',
          background: sp.ink, color: sp.pageBg,
          fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
        }}>Ouvrir</button>
      </div>
    </div>
  )
}

// ─── Row context menu ─────────────────────────────────────────────────
export type RowMenuItemId = 'open' | 'reschedule' | 'priority' | 'assign' | 'complete' | 'delete'
export interface RowMenuItem {
  id: RowMenuItemId
  icon: MEIconName
  label: string
  sub: string
  tone?: 'good' | 'bad'
}

export function SugarRowMenu({ sp, label, onPick, onClose }: {
  sp: SugarPalette
  label?: string
  onPick?: (it: RowMenuItem) => void
  onClose?: () => void
}) {
  const items: RowMenuItem[] = [
    { id: 'open',       icon: 'eye',   label: 'Ouvrir la fiche',     sub: 'Voir le détail complet' },
    { id: 'reschedule', icon: 'calendar',   label: 'Replanifier',         sub: 'Choisir un nouveau créneau' },
    { id: 'priority',   icon: 'sparkle', label: 'Marquer prioritaire', sub: 'Remonte en haut du parcours' },
    { id: 'assign',     icon: 'plus',  label: 'Assigner à…',         sub: 'Déléguer à un collaborateur' },
    { id: 'complete',   icon: 'check', label: 'Marquer comme fait',  sub: 'Cloturer cette action', tone: 'good' },
    { id: 'delete',     icon: 'close',     label: 'Supprimer',           sub: 'Retirer du parcours',   tone: 'bad' },
  ]
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 10px',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 12, background: sp.cardSubBg,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, color: sp.ink, letterSpacing: 0, lineHeight: 0.5 }}>···</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink }}>Actions</div>
          {label && (
            <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(it => {
          const isBad = it.tone === 'bad'
          const isGood = it.tone === 'good'
          const sep = it.id === 'complete'
          return (
            <Fragment key={it.id}>
              {sep && <div style={{ height: 1, background: sp.cardBorder, margin: '6px 8px' }} />}
              <button
                onClick={() => { onPick?.(it); onClose?.() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', border: 0, background: 'transparent', cursor: 'pointer',
                  borderRadius: 12, fontFamily: 'inherit', textAlign: 'left',
                  color: isBad ? '#E53935' : sp.ink,
                  transition: 'background 160ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isBad ? 'rgba(229,57,53,0.10)' : sp.cardSubBg }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: 999,
                  background: isBad ? 'rgba(229,57,53,0.10)' : isGood ? 'rgba(14,159,110,0.12)' : sp.cardSubBg,
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <MEIcon name={it.icon} size={12}
                    color={isBad ? '#E53935' : isGood ? '#0E9F6E' : sp.ink} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: isBad ? '#E53935' : sp.ink }}>{it.label}</div>
                  <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1 }}>{it.sub}</div>
                </div>
              </button>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ─── AI Leads drawer ──────────────────────────────────────────────────
export interface AILead { id: string; name: string; source: string; intent: string; budget: string; score: number; hint: string }

export function SugarAILeads({ sp, onPickLead, onAccept, onReject, onClose }: {
  sp: SugarPalette
  onPickLead?: (l: { id: string }) => void
  onAccept?: (l: { id: string; name?: string }) => void
  onReject?: (l: AILead) => void
  onClose?: () => void
}) {
  const leads: AILead[] = [
    { id: 'l1', name: 'Sophie Mercier',  source: 'Site web',           intent: 'Achat', budget: 'CHF 1.2M',  score: 88, hint: 'Match: 5 biens · Carouge / Champel' },
    { id: 'l2', name: 'Marc Tornay',     source: 'Référent agent',     intent: 'Vente', budget: 'CHF 2.4M',  score: 74, hint: 'Mandat exclusif possible · Cologny' },
    { id: 'l3', name: 'Léa Brunner',     source: 'Formulaire visite',  intent: 'Achat', budget: 'CHF 850k',  score: 62, hint: 'Premier contact à initier' },
    { id: 'l4', name: 'Xavier Dunant',   source: 'LinkedIn',           intent: 'Vente', budget: '—',         score: 45, hint: 'Qualification IA en cours' },
  ]
  const [busy, setBusy] = useState<string | null>(null)

  const ScoreBadge = ({ s }: { s: number }) => {
    const color = s >= 75 ? '#0E9F6E' : s >= 55 ? '#F59E0B' : '#E53935'
    const bg    = s >= 75 ? 'rgba(14,159,110,0.12)' : s >= 55 ? 'rgba(245,158,11,0.16)' : 'rgba(229,57,53,0.12)'
    return (
      <span style={{
        padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
        background: bg, color, fontVariantNumeric: 'tabular-nums',
      }}>{s}</span>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 12px',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 12,
          background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          boxShadow: '0 4px 10px rgba(99,102,241,0.4)',
        }}>
          <MEIcon name="sparkle" size={14} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink }}>MEGGA AI · Demande de traitement</div>
          <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1 }}>4 leads en attente · qualifie ou délègue</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {leads.map(l => {
          const initials = l.name.split(' ').map(s => s[0]).join('').slice(0, 2)
          const isAccepted = busy === `accept-${l.id}`
          const isRejected = busy === `reject-${l.id}`
          return (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 14,
              background: isAccepted ? 'rgba(14,159,110,0.10)'
                       : isRejected ? 'rgba(229,57,53,0.08)'
                       : sp.cardSubBg,
              border: `1px solid ${isAccepted ? 'rgba(14,159,110,0.35)' : isRejected ? 'rgba(229,57,53,0.35)' : 'transparent'}`,
              transition: 'background 200ms ease, border-color 200ms ease, opacity 200ms ease',
              opacity: isRejected ? 0.6 : 1,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 999,
                background: '#0041D9', color: '#fff',
                display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700,
                flexShrink: 0,
              }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                  <ScoreBadge s={l.score} />
                </div>
                <div style={{ fontSize: 10.5, color: sp.sub, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.intent} · {l.budget} · {l.hint}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => { setBusy(`reject-${l.id}`); setTimeout(() => { onReject?.(l); setBusy(null) }, 260) }}
                  title="Rejeter"
                  style={{
                    width: 26, height: 26, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
                    background: 'transparent', color: sp.sub,
                    display: 'grid', placeItems: 'center',
                    transition: 'background 160ms ease, color 160ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,57,53,0.12)'; e.currentTarget.style.color = '#E53935' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = sp.sub }}
                >
                  <MEIcon name="close" size={11} color="currentColor" />
                </button>
                <button
                  onClick={() => { setBusy(`accept-${l.id}`); setTimeout(() => { onAccept?.(l); setBusy(null) }, 320) }}
                  title="Accepter et qualifier"
                  style={{
                    width: 26, height: 26, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
                    background: sp.ink, color: sp.pageBg,
                    display: 'grid', placeItems: 'center',
                    transition: 'transform 160ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <MEIcon name="check" size={11} color={sp.pageBg} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: 10, paddingTop: 10, borderTop: `1px solid ${sp.cardBorder}`,
        display: 'flex', gap: 6,
      }}>
        <button
          onClick={() => { onAccept?.({ id: 'all' }); onClose?.() }}
          style={{
            flex: 1, height: 34, borderRadius: 12, border: 0, cursor: 'pointer',
            background: sp.ink, color: sp.pageBg,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 11.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <MEIcon name="sparkle" size={11} color={sp.pageBg} />
          Tout qualifier avec l'IA
        </button>
        <button
          onClick={() => { onPickLead?.({ id: 'review' }); onClose?.() }}
          style={{
            height: 34, padding: '0 12px', borderRadius: 12, border: `1px solid ${sp.cardBorder}`, cursor: 'pointer',
            background: 'transparent', color: sp.ink,
            fontFamily: 'inherit', fontWeight: 600, fontSize: 11.5,
          }}
        >
          Examiner un par un
        </button>
      </div>
    </div>
  )
}

// ─── Status menu ──────────────────────────────────────────────────────
export type StatusId = 'Planifié' | 'À faire' | 'En cours' | 'Bloqué' | 'Exécuté'
export interface StatusItem { id: StatusId; color: string; bg: string; sub: string }

export function SugarStatusMenu({ sp, currentStatus, onPick, onClose }: {
  sp: SugarPalette
  currentStatus?: StatusId
  onPick?: (it: StatusItem) => void
  onClose?: () => void
}) {
  const items: StatusItem[] = [
    { id: 'Planifié', color: '#0041D9', bg: 'rgba(0,65,217,0.12)',   sub: 'Créneau réservé' },
    { id: 'À faire',  color: '#E53935', bg: 'rgba(229,57,53,0.10)',  sub: "En attente d'action" },
    { id: 'En cours', color: '#F59E0B', bg: 'rgba(245,158,11,0.16)', sub: "Action en train d'avancer" },
    { id: 'Bloqué',   color: '#E53935', bg: 'rgba(229,57,53,0.10)',  sub: "Dépend d'un externe" },
    { id: 'Exécuté',  color: '#0E9F6E', bg: 'rgba(14,159,110,0.12)', sub: 'Terminé · à archiver' },
  ]
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 10px',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 12, background: sp.cardSubBg,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <MEIcon name="sparkle" size={14} color={sp.ink} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink }}>Changer le statut</div>
          {currentStatus && (
            <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1 }}>
              Actuellement · {currentStatus}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(it => {
          const isCurrent = it.id === currentStatus
          return (
            <button
              key={it.id}
              onClick={() => { if (!isCurrent) { onPick?.(it) } onClose?.() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', border: 0, background: 'transparent', cursor: isCurrent ? 'default' : 'pointer',
                borderRadius: 12, fontFamily: 'inherit', textAlign: 'left',
                opacity: isCurrent ? 0.55 : 1,
                transition: 'background 160ms ease',
              }}
              onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = sp.cardSubBg }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
                background: it.bg, color: it.color, flexShrink: 0,
              }}>{it.id}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: sp.sub, marginTop: 1 }}>{it.sub}</div>
              </div>
              {isCurrent && <MEIcon name="check" size={11} color={sp.soft} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Pipeline drill-down ──────────────────────────────────────────────
export type PipelineDrillKind = 'executed' | 'active' | 'pipeline' | 'matches' | 'risk'
export interface PipelineDrillItem { id: string; label: string; sub: string; meta: string }

export function SugarPipelineDrill({ sp, kind, onPickItem, onClose }: {
  sp: SugarPalette
  kind?: PipelineDrillKind
  onPickItem?: (it: { id: string; label?: string }) => void
  onClose?: () => void
}) {
  const DATA: Record<PipelineDrillKind, { title: string; caption: string; accent: string; items: PipelineDrillItem[] }> = {
    executed: {
      title: 'Tâches exécutées · semaine',
      caption: '5 sur 6 — bonne cadence',
      accent: '#0041D9',
      items: [
        { id: 'e1', label: 'Visite Carouge — Bertrand',      sub: 'Lun · 14:00',  meta: '45 min' },
        { id: 'e2', label: 'KYC Schmidt — pièces validées',  sub: 'Lun · 11:00',  meta: 'OK' },
        { id: 'e3', label: 'Premier appel Loreau',           sub: 'Mar · 15:00',  meta: '20 min' },
        { id: 'e4', label: 'Recap visite — email Bertrand',  sub: 'Mer · 09:30',  meta: 'Lu' },
        { id: 'e5', label: 'Match envoyé Vionnet (3 biens)', sub: 'Jeu · 10:00',  meta: 'Vu' },
      ],
    },
    active: {
      title: 'Deals actifs',
      caption: '7 deals sur 10 mouvements',
      accent: '#E53935',
      items: [
        { id: 'a1', label: 'Cologny — Picard',     sub: 'Offre · 3.85M', meta: 'Étape: négociation' },
        { id: 'a2', label: 'Carouge — Bertrand',   sub: 'Visite · 1.2M', meta: 'Étape: 2e visite' },
        { id: 'a3', label: 'Champel — Schmidt',    sub: 'KYC · 850k',    meta: 'Étape: dossier' },
        { id: 'a4', label: 'Pâquis — Aebischer',   sub: 'Mandat · 1.4M', meta: 'Étape: mandat' },
        { id: 'a5', label: 'Eaux-Vives — Vionnet', sub: 'Match · 1.9M', meta: 'Étape: matching' },
        { id: 'a6', label: 'Onex — Okafor',        sub: '1er contact',   meta: 'Étape: découverte' },
        { id: 'a7', label: 'Plainpalais — Dunant', sub: 'Bouclage',      meta: 'Étape: closing' },
      ],
    },
    pipeline: {
      title: 'Volume du pipeline',
      caption: 'CHF 7.6M répartis sur 7 deals actifs',
      accent: sp.ink,
      items: [
        { id: 'p1', label: 'Cologny — Picard',     sub: 'CHF 3.85M', meta: '50%' },
        { id: 'p2', label: 'Pâquis — Aebischer',   sub: 'CHF 1.40M', meta: '18%' },
        { id: 'p3', label: 'Carouge — Bertrand',   sub: 'CHF 1.20M', meta: '16%' },
        { id: 'p4', label: 'Eaux-Vives — Vionnet', sub: 'CHF 0.65M', meta: '9%' },
        { id: 'p5', label: 'Champel — Schmidt',    sub: 'CHF 0.50M', meta: '7%' },
      ],
    },
    matches: {
      title: 'Nouveaux matchs · 24h',
      caption: '3 leads avec biens correspondants',
      accent: '#0E9F6E',
      items: [
        { id: 'm1', label: 'Vionnet ↔ Eaux-Vives 4p', sub: 'Score 92', meta: 'À envoyer' },
        { id: 'm2', label: 'Schmidt ↔ Champel 3p',    sub: 'Score 88', meta: 'Envoyé · vu' },
        { id: 'm3', label: 'Okafor ↔ Onex maison',    sub: 'Score 76', meta: 'À envoyer' },
      ],
    },
    risk: {
      title: 'Deals à risque',
      caption: '1 deal nécessite une action rapide',
      accent: '#F59E0B',
      items: [
        { id: 'r1', label: 'Cologny — Picard', sub: 'Offre bloquée 48h', meta: "Relancer aujourd'hui" },
      ],
    },
  }
  const cfg = DATA[kind || 'pipeline']
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 12px',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 12, background: `${cfg.accent}1F`,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <MEIcon name="dashboard" size={14} color={cfg.accent} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink, letterSpacing: -0.2 }}>{cfg.title}</div>
          <div style={{ fontSize: 11, color: sp.sub, marginTop: 1 }}>{cfg.caption}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflowY: 'auto' }}>
        {cfg.items.map(it => (
          <button key={it.id}
            onClick={() => { onPickItem?.(it); onClose?.() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', border: 0, background: 'transparent', cursor: 'pointer',
              borderRadius: 12, fontFamily: 'inherit', textAlign: 'left',
              transition: 'background 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = sp.cardSubBg }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: 999, background: cfg.accent, flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: sp.ink, lineHeight: 1.3 }}>{it.label}</div>
              <div style={{ fontSize: 11, color: sp.sub, marginTop: 1 }}>{it.sub}</div>
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: cfg.accent,
              padding: '3px 8px', borderRadius: 999, background: `${cfg.accent}14`,
              flexShrink: 0,
            }}>{it.meta}</span>
          </button>
        ))}
      </div>

      <div style={{
        display: 'flex', gap: 8, padding: '10px 8px 0', marginTop: 8,
        borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <button
          onClick={() => { onPickItem?.({ id: 'all' }); onClose?.() }}
          style={{
            flex: 1, height: 36, borderRadius: 12, border: 0, cursor: 'pointer',
            background: sp.ink, color: sp.pageBg,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <MEIcon name="eye" size={12} color={sp.pageBg} />
          Ouvrir le pipeline complet
        </button>
      </div>
    </div>
  )
}
