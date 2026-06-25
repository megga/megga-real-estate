import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCalendarSugar } from '@/hooks/useCalendarSugar'
import MEIcon from '@/components/propertyx/MEIcon'
import { openSugarSearch } from '@/components/crm-sugar/search/openSearch'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import MeggaWordmark from '../shell/MeggaWordmark'
import AgWeekStrip from './AgWeekStrip'
import AgEventCard from './AgEventCard'
import AgTimeGrid from './AgTimeGrid'
import AgEventSheet from './AgEventSheet'
import { calEventToVM, demoEvents, fmtDur, minutesOf, sameDay, type AgEventVM } from './vm'

type AgView = 'list' | 'block'
const NOW_RED = '#E54D38'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Agenda mobile (onglet 4) — sélecteur de jour + bascule Liste ↔ Bloc
 * (time-block). Câblé `useCalendarSugar` (visites + reminders, mêmes events que
 * le desktop, lecture seule). Création = flux visite réel (`/dashboard/visits/new`).
 * Seeds derrière `demo`. v1 : édition inline (replanifier/supprimer) différée.
 */
export function MobileAgendaScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('calendar')
  const { tk } = useMobileTokens()
  const { events, isLoading, isError, refetch } = useCalendarSugar()

  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()))
  const [view, setView] = useState<AgView>('list')
  const [detail, setDetail] = useState<AgEventVM | null>(null)

  const allVMs = useMemo<AgEventVM[]>(
    () => (demo ? demoEvents() : events.map(calEventToVM)),
    [demo, events],
  )

  const days = useMemo<Date[]>(() => {
    const base = startOfDay(new Date())
    return Array.from({ length: 29 }, (_, i) => {
      const d = new Date(base)
      d.setDate(d.getDate() + i - 7)
      return d
    })
  }, [])

  const dayVMs = useMemo(
    () => allVMs.filter((v) => sameDay(v.start, selected)).sort((a, b) => a.startMin - b.startMin),
    [allVMs, selected],
  )
  const countFor = (d: Date): number => allVMs.filter((v) => sameDay(v.start, d)).length
  const totalMin = dayVMs.reduce((s, v) => s + v.durMin, 0)

  const now = new Date()
  const isTodaySel = sameDay(selected, now)
  const nowMin = minutesOf(now)
  const nowIdx = isTodaySel ? dayVMs.findIndex((v) => v.startMin >= nowMin) : -1

  const openVisit = (id: string) => { setDetail(null); navigate(`/dashboard/visits/${id}`) }
  const openProperty = (id: string) => { setDetail(null); navigate(`/dashboard/listings/${id}`) }

  const showLoading = !demo && isLoading && allVMs.length === 0
  const showError = !demo && isError

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, position: 'relative', minHeight: '70vh' }}>
      {/* En-tête */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 14px) 18px 6px' }}>
        <MeggaWordmark color={tk.ink} height={22} />
        <button
          type="button"
          onClick={() => openSugarSearch()}
          aria-label={t('common:nav.search')}
          style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, display: 'grid', placeItems: 'center' }}
        >
          <MEIcon name="search" size={18} color={tk.ink} />
        </button>
      </header>

      <div style={{ padding: '4px 18px 0' }}>
        <h1 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: -1, color: tk.ink, lineHeight: 1.05 }}>
          {t('common:nav.calendar')}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 7 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: tk.inkSoft }}>{t('views.eventCount', { count: dayVMs.length })}</span>
          {totalMin > 0 ? <span style={{ fontSize: 13, fontWeight: 600, color: tk.muted }}>· {fmtDur(totalMin, t)}</span> : null}
        </div>
      </div>

      {/* Sélecteur de jour */}
      <div style={{ padding: '14px 18px 0' }}>
        <AgWeekStrip days={days} selected={selected} onSelect={setSelected} countFor={countFor} />
      </div>

      {/* Bascule Liste / Bloc */}
      <div style={{ display: 'flex', gap: 6, margin: '4px 18px 0', padding: 4, borderRadius: 999, background: tk.cardSubtle, width: 'fit-content' }}>
        {(['list', 'block'] as AgView[]).map((v) => {
          const on = v === view
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={{ height: 34, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 800 : 700, letterSpacing: -0.2, background: on ? tk.card : 'transparent', color: on ? tk.ink : tk.muted, boxShadow: on ? tk.shadowSm : 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <MEIcon name={v === 'list' ? 'menu' : 'layers'} size={15} color={on ? tk.ink : tk.muted} />
              {v === 'list' ? t('mobile.viewList') : t('mobile.viewBlock')}
            </button>
          )
        })}
      </div>

      {/* Contenu */}
      <div style={{ padding: '16px 18px 0' }}>
        {showLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 76, borderRadius: 18, background: tk.cardSubtle, boxShadow: tk.shadowSm }} />
            ))}
          </div>
        ) : showError ? (
          <div style={{ textAlign: 'center', padding: '48px 12px' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: tk.ink, letterSpacing: -0.3 }}>{t('page.error.title')}</div>
            <button
              type="button"
              onClick={refetch}
              style={{ marginTop: 16, height: 44, padding: '0 22px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, background: tk.accent, color: tk.accentInk }}
            >
              {t('mobile.retry')}
            </button>
          </div>
        ) : dayVMs.length === 0 ? (
          <div style={{ marginTop: 6, padding: '44px 24px', textAlign: 'center', background: tk.card, borderRadius: 18, boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: tk.cardSubtle, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
              <MEIcon name="calendar" size={24} color={tk.muted} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.4, color: tk.ink, marginTop: 14 }}>{t('mobile.dayFreeTitle')}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: tk.muted, marginTop: 5, maxWidth: 240, marginInline: 'auto', lineHeight: 1.45 }}>{t('mobile.dayFreeDesc')}</div>
          </div>
        ) : view === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {dayVMs.map((v, i) => (
              <div key={v.id}>
                {i === nowIdx ? (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ width: 46, flexShrink: 0, textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: NOW_RED, fontVariantNumeric: 'tabular-nums' }}>
                      {`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: NOW_RED, flexShrink: 0, boxShadow: '0 0 0 4px rgba(229,77,56,0.16)' }} />
                      <span style={{ flex: 1, height: 2, background: NOW_RED, borderRadius: 999 }} />
                    </div>
                  </div>
                ) : null}
                <AgEventCard event={v} past={isTodaySel && v.startMin + v.durMin < nowMin} onTap={() => setDetail(v)} />
              </div>
            ))}
          </div>
        ) : (
          <AgTimeGrid events={dayVMs} isToday={isTodaySel} nowMin={nowMin} onTap={(e) => setDetail(e)} />
        )}
      </div>

      {/* FAB — créer (flux visite réel) */}
      {!showError ? (
        <button
          type="button"
          onClick={() => navigate('/dashboard/visits/new')}
          aria-label={t('createVisit.title')}
          style={{ position: 'fixed', right: 18, bottom: 'calc(100px + env(safe-area-inset-bottom))', zIndex: 54, width: 56, height: 56, borderRadius: 999, border: 0, cursor: 'pointer', background: tk.accent, color: tk.accentInk, boxShadow: tk.shadowLg, display: 'grid', placeItems: 'center' }}
        >
          <MEIcon name="plus" size={24} color={tk.accentInk} strokeWidth={2.2} />
        </button>
      ) : null}

      <AgEventSheet event={detail} onClose={() => setDetail(null)} onOpenVisit={openVisit} onOpenProperty={openProperty} />
    </div>
  )
}
