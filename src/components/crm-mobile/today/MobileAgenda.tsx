/**
 * Agenda du jour du cockpit « Aujourd'hui » mobile (crm-mobile/today).
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useCalendarSugar } from '@/hooks/useCalendarSugar'
import { useMobileTokens } from '../useMobileTokens'

interface AgendaRow {
  time: string
  label: string
  meta: string
  color: string
  done?: boolean
  now?: boolean
}

const DEMO_ROWS: AgendaRow[] = [
  { time: '09:30', label: 'Relance Pierre Vionnet', meta: '3 nouveaux matchs', color: '#9b7cf0', done: true },
  { time: '10:00', label: 'Appel Marie Bertrand', meta: 'Relance à chaud', color: '#5b6cff', now: true },
  { time: '11:00', label: 'KYC Élodie Schmidt', meta: 'Vérification', color: '#0E7490' },
  { time: '11:30', label: 'Mandat — Julien Aebischer', meta: 'Signature', color: '#1E5BC6' },
  { time: '14:00', label: 'Visite Carouge', meta: 'Marie Bertrand · 45 min', color: '#0E7490' },
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}
function fmtTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Ligne d'agenda : heure, pastille couleur, libellé (barré si passé) et badge « maintenant ». */
function Row({ a, last }: { a: AgendaRow; last: boolean }) {
  const { t } = useTranslation('dashboard')
  const { tk } = useMobileTokens()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--crm-space-xl)',
        padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
        background: a.now ? tk.cardSubtle : 'transparent',
        boxShadow: last ? 'none' : `inset 0 -1px 0 ${tk.hair}`,
      }}
    >
      <div style={{ width: 42, flexShrink: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: a.now ? tk.ink : tk.muted, fontVariantNumeric: 'tabular-nums' }}>
        {a.time}
      </div>
      <div style={{ width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)', background: a.color, flexShrink: 0, opacity: a.done ? 0.4 : 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--crm-text-lg)',
            fontWeight: 600,
            color: a.done ? tk.muted : tk.ink,
            letterSpacing: -0.2,
            textDecoration: a.done ? 'line-through' : 'none',
            textDecorationColor: tk.ghost,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {a.label}
        </div>
        {a.meta ? (
          <div style={{ fontSize: 'var(--crm-text-sm)', color: tk.muted, fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {a.meta}
          </div>
        ) : null}
      </div>
      {a.done ? <MEIcon name="check" size={16} color={tk.ghost} /> : null}
      {a.now ? (
        <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: 0.3, color: tk.accentInk, background: tk.accent, padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', whiteSpace: 'nowrap' }}>
          {t('today.agenda.nowBadge')}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Agenda du jour — câblé `useCalendarSugar` (mêmes events que le desktop),
 * filtré au jour, marquage fait/maintenant en temps réel. Empty-state honnête
 * (« journée dégagée ») ; seeds derrière `demo`. Lecture seule (pas de mutation
 * persistée — comme le desktop).
 */
export function MobileAgenda({ demo = false, onSeeAll }: { demo?: boolean; onSeeAll?: () => void }) {
  const { t } = useTranslation('dashboard')
  const { tk } = useMobileTokens()
  const { events } = useCalendarSugar()

  let rows: AgendaRow[]
  if (demo) {
    rows = DEMO_ROWS
  } else {
    const now = new Date()
    const today = events
      .filter((e) => e.start instanceof Date && sameDay(e.start, now))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
    // Index du 1er RDV à venir = « maintenant » (calculé sans mutation au render).
    const nowIdx = today.findIndex((e) => e.start.getTime() >= now.getTime())
    rows = today.map((e, i) => ({
      time: fmtTime(e.start),
      label: e.title,
      meta: e.contact?.name ?? e.location ?? '',
      color: e.type === 'visite' ? '#0E7490' : '#5b6cff',
      done: e.start.getTime() < now.getTime(),
      now: i === nowIdx,
    }))
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, padding: '0 var(--crm-space-2xs)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, letterSpacing: -0.4, color: tk.ink }}>{t('today.cockpit.tiles.agenda')}</h3>
        <button
          type="button"
          onClick={onSeeAll}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--crm-space-xs)',
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-md)',
            fontWeight: 600,
            color: tk.muted,
            flexShrink: 0,
          }}
        >
          {t('common:actions.viewAll')}
          <MEIcon name="arrow-right" size={13} color={tk.muted} />
        </button>
      </div>
      {rows.length === 0 ? (
        <div
          style={{
            background: tk.card,
            border: `1px solid ${tk.cardBorder}`,
            borderRadius: 'var(--crm-radius-3xl)',
            boxShadow: tk.shadowSm,
            padding: 'var(--crm-space-6xl) var(--crm-space-4xl)',
            fontSize: 'var(--crm-text-lg)',
            fontWeight: 600,
            color: tk.muted,
            textAlign: 'center',
          }}
        >
          {t('today.agenda.empty')}
        </div>
      ) : (
        <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-3xl)', boxShadow: tk.shadowSm, overflow: 'hidden' }}>
          {rows.map((a, i) => (
            <Row key={i} a={a} last={i === rows.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
}
