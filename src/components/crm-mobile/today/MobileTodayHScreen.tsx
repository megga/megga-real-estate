/**
 * « Aujourd'hui » mobile — traduction du concept H (< 768 px).
 *
 * Port de `resp-today-mobile.jsx` (pack Today V2, 3 août 2026) : le dossier du
 * moment en héros, la journée en fil vertical (blocs aplat plein couleur
 * fonctionnelle + texte blanc), « Pendant ton absence » en fil + feuille du bas
 * groupée. Remplace le cockpit mobile, qui reflétait l'écran d'avant la refonte.
 *
 * Il lit les MÊMES hooks que le desktop (`useTodayH`, `useAbsenceSignals`) : il
 * hérite donc sans rien recoder de la journée réelle, de la fenêtre libre, du
 * fil d'absence et de la présence.
 *
 * Une seule chose que le desktop n'a pas : le bouton « fait ». C'est la maquette
 * mobile qui le porte, et c'est cohérent — le mobile est la surface de terrain,
 * celle où l'on coche en marchant. Il n'ouvre AUCUN chemin d'écriture nouveau :
 * `markBlockDone` emprunte ceux du Calendrier, et refuse les rendez-vous de
 * vérification, que le Calendrier refuse déjà.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { HL_TYPES, HL_KIND_TYPE } from '@/components/crm-sugar/today/dataH'
import {
  useTodayH, canMarkDone, markBlockDone,
  type TodayHBlock,
} from '@/components/crm-sugar/today/useTodayH'
import { useAbsenceSignals, type AbsenceSignal } from '@/components/crm-sugar/today/useAbsenceSignals'
import { openSugarSearch } from '@/components/crm-sugar/search/openSearch'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import MeggaWordmark from '../shell/MeggaWordmark'

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Couleur fonctionnelle du bloc, selon l'ambiance (mêmes hex que le desktop). */
function blockColor(kind: string, dark: boolean): string {
  const ty = HL_TYPES[HL_KIND_TYPE[kind]] || HL_TYPES.relance
  return dark ? ty.d : ty.l
}

/** Route de détail d'un signal du fil d'absence. */
type Nav = (route: string, ref?: string) => void

function SignalRow({ s, first, onCta, tk }: {
  s: AbsenceSignal
  first: boolean
  onCta: (s: AbsenceSignal) => void
  tk: ReturnType<typeof useMobileTokens>['tk']
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-lg) 0', borderTop: first ? 'none' : `1px solid ${tk.hair}`, minWidth: 0 }}>
      <span style={{ position: 'relative', width: 30, height: 30, flexShrink: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', background: s.av, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-sm)', fontWeight: 700 }}>{s.initials}</span>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.inkSoft, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
          <span style={{ fontWeight: 800, color: tk.ink }}>{s.who.split(' ')[0]}</span> {s.text}
        </div>
        <div style={{ marginTop: 2, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: s.late ? '#C45A00' : tk.muted, fontVariantNumeric: 'tabular-nums' }}>{s.meta}</div>
      </div>
      <button
        onClick={() => onCta(s)}
        style={{ flexShrink: 0, border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 800, color: tk.ink, padding: 'var(--crm-space-lg) 0 var(--crm-space-lg) var(--crm-space-md)', whiteSpace: 'nowrap' }}
      >{s.cta}</button>
    </div>
  )
}

export function MobileTodayHScreen() {
  const navigate = useNavigate()
  const { t } = useTranslation('dashboard')
  const { tk, isDark } = useMobileTokens()
  const { day, isLoading, refetch } = useTodayH()
  const {
    signals: absenceSignals, groups: absenceGroups, total: absenceTotal,
    sinceLabel, markAllSeen, resumeReminder,
  } = useAbsenceSignals()

  const [selId, setSelId] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const say = useCallback((msg: string) => {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2200)
  }, [])

  const nav: Nav = (route, ref) => {
    switch (route) {
      case 'contact-detail': navigate(ref ? `/dashboard/contacts/${ref}` : '/dashboard/contacts'); break
      case 'visite-detail': navigate(ref ? `/dashboard/visits/${ref}` : '/dashboard/calendar'); break
      case 'deal-detail': navigate(ref ? `/dashboard/transactions/${ref}` : '/dashboard/pipeline'); break
      case 'biens-detail': navigate(ref ? `/dashboard/listings/${ref}` : '/dashboard/listings'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      default: navigate('/dashboard')
    }
  }

  // Dossier du moment : le créneau en cours, sinon le prochain, sinon le premier.
  const sel = useMemo<TodayHBlock | null>(() => {
    const blocks = day.blocks
    if (!blocks.length) return null
    if (selId) { const found = blocks.find((b) => b.id === selId); if (found) return found }
    const current = blocks.find((b) => day.nowMin >= b.from && day.nowMin < b.from + b.dur)
    return current ?? blocks.find((b) => b.from >= day.nowMin) ?? blocks[0]
  }, [day.blocks, day.nowMin, selId])

  const onDone = async (b: TodayHBlock) => {
    const next = !b.done
    const ok = await markBlockDone(b, next)
    if (!ok) { say(t('today.h.toast.doneFailed')); return }
    refetch()
    say(next ? t('today.h.toast.markedDone', { name: b.contact.split(' ')[0] }) : t('today.h.toast.reopened'))
  }

  const onSignal = async (s: AbsenceSignal) => {
    if (s.type === 'rappel') {
      const ok = await resumeReminder(s)
      if (!ok) { say(t('today.h.toast.resumeFailed')); return }
    }
    setSheet(false)
    nav(s.route, s.navRef)
  }

  const feed = absenceSignals.slice(0, 3)
  const secTitle = { margin: '18px 4px 8px', fontSize: 'var(--crm-text-xs)', fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' as const, color: tk.muted }
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ borderRadius: 'var(--crm-radius-3xl)', background: tk.card, boxShadow: tk.shadow, ...extra })

  // Fil chronologique : les blocs + la fenêtre libre, intercalée à sa place.
  const timeline = useMemo(() => {
    const items: Array<{ kind: 'block'; from: number; b: TodayHBlock } | { kind: 'free'; from: number }> =
      day.blocks.map((b) => ({ kind: 'block' as const, from: b.from, b }))
    if (day.free) items.push({ kind: 'free' as const, from: day.free.from })
    return items.sort((a, z) => a.from - z.from)
  }, [day.blocks, day.free])

  return (
    <div style={{ padding: '0 var(--crm-space-3xl)', fontFamily: MOBILE_FONT }}>
      <style>{'@keyframes mthIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes mthSheet{from{transform:translateY(28px);opacity:0}to{transform:none;opacity:1}}'}</style>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 14px) 2px 6px' }}>
        <MeggaWordmark color={tk.ink} height={22} />
        <button
          onClick={() => openSugarSearch()} aria-label={t('today.h.searchAria')}
          style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-pill)', border: 0, background: tk.cardSubtle, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
        >
          <MEIcon name="search" size={18} color={tk.ink} strokeWidth={2.1} />
        </button>
      </header>

      <h1 style={{ margin: '6px 0 0', fontSize: 'var(--crm-text-5xl)', fontWeight: 800, letterSpacing: -0.7, color: tk.ink, lineHeight: 1.1 }}>{t('today.h.mobileTitle')}</h1>
      <div style={{ marginTop: 3, fontSize: 'var(--crm-text-md)', fontWeight: 700, color: tk.muted, fontVariantNumeric: 'tabular-nums' }}>
        {day.nowLabel} · {t('today.h.slots', { count: day.blocks.length })}
      </div>

      {/* Dossier du moment */}
      {sel && (
        <div key={sel.id} style={card({ marginTop: 14, overflow: 'hidden', boxShadow: tk.shadowLg, animation: 'mthIn .3s cubic-bezier(.2,.8,.2,1) both' })}>
          {sel.photo && (
            <div style={{ position: 'relative', aspectRatio: '16 / 7.5', overflow: 'hidden' }}>
              <img src={sel.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              {sel.price && (
                <span style={{ position: 'absolute', left: 12, bottom: 10, padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: 'rgba(11,12,14,0.78)', color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {sel.price}{sel.place ? ` · ${sel.place}` : ''}
                </span>
              )}
            </div>
          )}
          <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-3xl) var(--crm-space-3xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
              <span style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, display: 'grid', placeItems: 'center', background: sel.av, color: '#fff', fontSize: 'var(--crm-text-md)', fontWeight: 800 }}>{sel.initials}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 800, letterSpacing: -0.3, color: tk.ink }}>{sel.contact}</div>
                {sel.role && <div style={{ marginTop: 1, fontSize: 'var(--crm-text-sm)', fontWeight: 700, color: tk.muted }}>{sel.role}</div>}
              </div>
              <span style={{ flexShrink: 0, padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: blockColor(sel.kind, isDark), color: '#fff', fontSize: 'var(--crm-text-xs)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {sel.time} · {t('today.h.minutes', { count: sel.dur })}
              </span>
            </div>
            {sel.line && (
              <div style={{ marginTop: 11, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.inkSoft, lineHeight: 1.55, textDecoration: sel.done ? 'line-through' : 'none', opacity: sel.done ? 0.6 : 1 }}>{sel.line}</div>
            )}
            <div style={{ display: 'flex', gap: 'var(--crm-space-md)', marginTop: 14 }}>
              <button
                onClick={() => nav(sel.route, sel.navRef)}
                style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 800, background: tk.accent, color: tk.accentInk }}
              >{sel.cta}</button>
              {/* Le ✓ n'apparaît QUE si le geste existe pour cette source : un
                  bouton qui ne peut rien faire ne doit pas s'afficher. */}
              {canMarkDone(sel) && (
                <button
                  onClick={() => { void onDone(sel) }}
                  aria-label={sel.done ? t('today.h.reopenAria') : t('today.h.markDoneAria')}
                  style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', flexShrink: 0, display: 'grid', placeItems: 'center', background: sel.done ? '#059669' : tk.cardSubtle, color: sel.done ? '#fff' : tk.ink }}
                >
                  <MEIcon name="check" size={18} color={sel.done ? '#fff' : tk.ink} strokeWidth={2.4} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Journée */}
      <div style={secTitle}>{t('today.h.mobileDay')}</div>
      {!isLoading && !day.blocks.length ? (
        <div style={card({ padding: 'var(--crm-space-5xl) var(--crm-space-3xl)', textAlign: 'center' })}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 800, color: tk.ink }}>{t('today.h.day.emptyTitle')}</div>
          <div style={{ marginTop: 4, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, lineHeight: 1.5 }}>{t('today.h.day.emptyDesc')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          {timeline.map((it) => {
            if (it.kind === 'free') {
              const mins = day.free ? day.free.to - day.free.from : 0
              const label = mins % 60 === 0 ? `${mins / 60} h` : `${Math.floor(mins / 60)} h ${mins % 60}`
              return (
                <div key="free" style={{ display: 'flex', gap: 'var(--crm-space-lg)', alignItems: 'stretch' }}>
                  <span style={{ width: 40, flexShrink: 0, paddingTop: 'var(--crm-space-xl)', fontSize: 'var(--crm-text-xs)', fontWeight: 800, color: tk.muted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{hm(it.from)}</span>
                  <div style={{ flex: 1, minWidth: 0, borderRadius: 'var(--crm-radius-xl)', border: `1.5px dashed ${tk.hair}`, padding: 'var(--crm-space-lg) var(--crm-space-xl)' }}>
                    <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 800, color: tk.ink }}>{t('today.h.freeWindow', { duration: label })}</span>
                    {day.free && (
                      <span style={{ display: 'block', marginTop: 1, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted, fontVariantNumeric: 'tabular-nums' }}>
                        {hm(day.free.from)} – {hm(day.free.to)}
                      </span>
                    )}
                  </div>
                </div>
              )
            }
            const b = it.b
            const col = blockColor(b.kind, isDark)
            const on = sel?.id === b.id
            const current = day.nowMin >= b.from && day.nowMin < b.from + b.dur
            return (
              <div key={b.id} style={{ display: 'flex', gap: 'var(--crm-space-lg)', alignItems: 'stretch' }}>
                <span style={{ width: 40, flexShrink: 0, paddingTop: 'var(--crm-space-xl)', fontSize: 'var(--crm-text-xs)', fontWeight: 800, color: current ? tk.ink : tk.muted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{b.time}</span>
                <button
                  onClick={() => setSelId(b.id)}
                  style={{ flex: 1, minWidth: 0, borderRadius: 'var(--crm-radius-xl)', border: 0, cursor: 'pointer', fontFamily: 'inherit', padding: 'var(--crm-space-lg) var(--crm-space-xl)', textAlign: 'left', background: col, color: '#fff', opacity: b.done ? 0.55 : 1, boxShadow: on ? '0 0 0 2px rgba(255,255,255,0.92) inset' : 'none' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', minWidth: 0 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 800, letterSpacing: -0.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: b.done ? 'line-through' : 'none' }}>{b.contact}</span>
                    {b.done && <MEIcon name="check" size={13} color="#fff" strokeWidth={2.6} />}
                  </span>
                  <span style={{ display: 'block', marginTop: 1, fontSize: 'var(--crm-text-xs)', fontWeight: 600, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.role ? `${b.role} · ` : ''}{t('today.h.minutes', { count: b.dur })}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Pendant ton absence */}
      <div style={{ ...secTitle, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--crm-space-lg)' }}>
        <span>{t('today.h.absence.title')}</span>
        {absenceTotal > 0 && (
          <button
            onClick={() => setSheet(true)}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 800, color: tk.ink, padding: 0, textTransform: 'none', letterSpacing: 0 }}
          >{t('today.h.absence.seeAll', { count: absenceTotal })}</button>
        )}
      </div>
      <div style={card({ padding: 'var(--crm-space-2xs) var(--crm-space-2xl)' })}>
        {feed.length
          ? feed.map((s, i) => <SignalRow key={s.id} s={s} first={i === 0} onCta={(x) => { void onSignal(x) }} tk={tk} />)
          : <div style={{ padding: 'var(--crm-space-3xl) 0', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, textAlign: 'center' }}>{t('today.h.absence.emptyTitle')}</div>}
      </div>

      {/* Feuille « Voir les N » */}
      {sheet && (
        <div onClick={() => setSheet(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: tk.overlay }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', left: 10, right: 10, bottom: 'calc(94px + env(safe-area-inset-bottom, 0px))', maxHeight: '70%', overflowY: 'auto', background: tk.sheetBg, borderRadius: 'var(--crm-radius-5xl)', boxShadow: tk.shadowLg, padding: 'var(--crm-space-3xl) var(--crm-space-3xl) var(--crm-space-2xl)', animation: 'mthSheet .28s cubic-bezier(.2,.8,.2,1) both' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-lg)' }}>
              <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 800, letterSpacing: -0.4, color: tk.ink }}>{t('today.h.absence.title')}</div>
              <button
                onClick={() => { void markAllSeen().then(() => { setSheet(false); say(t('today.h.toast.allUpToDate')) }) }}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 800, color: tk.muted, padding: 'var(--crm-space-sm) 0' }}
              >{t('today.h.absence.markAll')}</button>
            </div>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, marginTop: 1 }}>
              {sinceLabel ? t('today.h.absence.countSince', { count: absenceTotal, since: sinceLabel }) : t('today.h.absence.count', { count: absenceTotal })}
            </div>
            {absenceGroups.map((g) => (
              <div key={g.name} style={{ marginTop: 14 }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: tk.muted }}>{g.name}</div>
                <div>{g.items.map((s, i) => <SignalRow key={s.id} s={s} first={i === 0} onCta={(x) => { void onSignal(x) }} tk={tk} />)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(104px + env(safe-area-inset-bottom, 0px))', zIndex: 70, background: tk.accent, color: tk.accentInk, borderRadius: 'var(--crm-radius-pill)', padding: 'var(--crm-space-lg) var(--crm-space-3xl)', fontSize: 'var(--crm-text-md)', fontWeight: 700, whiteSpace: 'nowrap', maxWidth: '86%', overflow: 'hidden', textOverflow: 'ellipsis', boxShadow: tk.shadowLg, animation: 'mthIn .25s cubic-bezier(.2,.8,.2,1) both' }}>{toast}</div>
      )}
    </div>
  )
}
