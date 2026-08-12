/**
 * Héros Focus de l'écran « Aujourd'hui » mobile (crm-mobile/today) : traite la
 * file de priorités une situation à la fois, en carte photo plein cadre.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { focusTagKey, focusTy, type FocusItem, type FocusTypeDef } from '@/components/crm-sugar/today/focusQueue'
import { useMobileTokens } from '../useMobileTokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

// Icônes des types Focus (RXIcon desktop) → MEIcon (source unique mobile).
const FOCUS_ICON: Record<string, MEIconName> = {
  phone: 'phone',
  shield: 'shield',
  doc: 'file',
  offer: 'banknote',
  cal: 'calendar',
  flame: 'flame',
  clock: 'clock',
  building: 'building',
}

/**
 * Héros « file de priorités » mobile — une situation à la fois (carte photo
 * plein-cadre). La LOGIQUE est reproduite à l'identique de `FocusColumn`
 * (desktop) pour préserver les gestes HITL audités : `onDone`/`onSnooze` sont
 * appelés sur l'item courant aux mêmes moments (clôt le reminder / reporte /
 * audit `activity_events`). Resync de la file source par `key` côté parent.
 */
export function MobileFocusHero({
  baseQueue,
  onDone,
  onSnooze,
  isLoading = false,
}: {
  baseQueue: FocusItem[]
  onDone?: (item: FocusItem) => void
  onSnooze?: (item: FocusItem) => void
  isLoading?: boolean
}) {
  const { t } = useTranslation('dashboard')
  const { tk } = useMobileTokens()
  const [queue, setQueue] = useState<FocusItem[]>(baseQueue)
  const [idx, setIdx] = useState(0)
  const [calling, setCalling] = useState(false)
  const [secs, setSecs] = useState(0)
  const [vis, setVis] = useState(true)

  const total = queue.length
  const allDone = idx >= total
  const f = allDone ? null : queue[idx]
  const ty = f ? focusTy(f.type) : null

  useEffect(() => {
    if (!calling) return
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [calling])
  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

  const swap = (mutate: () => void) => {
    setCalling(false)
    setVis(false)
    setTimeout(() => {
      mutate()
      requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
    }, 300)
  }
  const done = () => {
    const cur = queue[idx]
    if (cur) onDone?.(cur)
    setCalling(false)
    setVis(false)
    setTimeout(() => {
      setIdx((i) => i + 1)
      requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
    }, 300)
  }
  const snooze = () => {
    const cur = queue[idx]
    if (cur) onSnooze?.(cur)
    swap(() =>
      setQueue((q) => {
        const n = [...q]
        const [it] = n.splice(idx, 1)
        n.push(it)
        return n
      }),
    )
  }
  const reset = () =>
    swap(() => {
      setQueue(baseQueue)
      setIdx(0)
    })
  const onPrimary = () => {
    if (ty && ty.live) {
      if (calling) done()
      else {
        setSecs(0)
        setCalling(true)
      }
    } else {
      done()
    }
  }

  const rise = (i: number): CSSProperties => ({
    opacity: vis ? 1 : 0,
    transform: vis ? 'none' : 'translateY(12px)',
    transition: `opacity .45s ease ${i * 55}ms, transform .5s cubic-bezier(.22,1,.36,1) ${i * 55}ms`,
  })

  // ── Chargement (évite le faux « File traitée ») ──
  if (isLoading && total === 0) {
    return (
      <div
        style={{
          marginTop: 18,
          borderRadius: 'var(--crm-radius-5xl)',
          minHeight: 240,
          display: 'grid',
          placeItems: 'center',
          background: tk.card,
          border: `1px solid ${tk.cardBorder}`,
          boxShadow: tk.shadowLg,
          color: tk.muted,
          fontSize: 'var(--crm-text-lg)',
          fontWeight: 600,
        }}
      >
        {t('today.focus.loading')}
      </div>
    )
  }

  // ── File vide ──
  if (allDone) {
    return (
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--crm-radius-5xl)',
          overflow: 'hidden',
          marginTop: 18,
          background: tk.card,
          border: `1px solid ${tk.cardBorder}`,
          boxShadow: tk.shadowLg,
          padding: '40px 26px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{ width: 58, height: 58, borderRadius: 'var(--crm-radius-pill)', background: tk.goal, display: 'grid', placeItems: 'center' }}>
          <MEIcon name="check" size={28} strokeWidth={2.4} color="#FFFFFF" />
        </div>
        <h2 style={{ margin: '16px 0 0', fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.6, color: tk.ink }}>
          {t('today.focus.queueDone')}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--crm-text-lg)', color: tk.muted, fontWeight: 600, maxWidth: 240, lineHeight: 1.45 }}>
          {t('today.focus.queueDoneSub')}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--crm-space-md)',
            height: 44,
            padding: '0 var(--crm-space-5xl)',
            borderRadius: 'var(--crm-radius-pill)',
            border: 0,
            cursor: 'pointer',
            background: tk.cardSubtle,
            color: tk.ink,
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-xl)',
            fontWeight: 600,
          }}
        >
          <MEIcon name="arrow-right" size={16} color={tk.ink} />
          {t('today.focus.reviewQueue')}
        </button>
      </div>
    )
  }

  // ── Situation courante ──
  const item = f as FocusItem
  const tyy = ty as FocusTypeDef
  const tagLabel = t(`today.tags.${focusTagKey(item.category)}`)
  const primaryLabel = t(tyy.labelKey, { name: item.contact.split(' ')[0] })
  const typeIcon = FOCUS_ICON[tyy.icon] ?? 'sparkle'

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--crm-radius-5xl)',
        overflow: 'hidden',
        marginTop: 18,
        minHeight: 430,
        boxShadow: tk.shadowLg,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {item.bien.photo ? (
        <img
          key={item.id}
          src={item.bien.photo}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(3px)',
            transform: 'scale(1.06)',
            opacity: vis ? 1 : 0,
            transition: 'opacity .4s ease',
          }}
        />
      ) : (
        <div key={item.id} style={{ position: 'absolute', inset: 0, background: '#1A1B22', opacity: vis ? 1 : 0, transition: 'opacity .4s ease' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,9,12,.58) 0%, rgba(8,9,12,.30) 30%, rgba(8,9,12,.95) 100%)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', flex: 1, padding: 'var(--crm-space-4xl)' }}>
        {/* progression */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--crm-space-xs)', flex: 1 }}>
            {queue.map((_, i) => (
              <span
                key={i}
                style={{
                  height: 3,
                  flex: 1,
                  borderRadius: 'var(--crm-radius-pill)',
                  background: i < idx ? '#34C796' : i === idx ? '#fff' : 'rgba(255,255,255,.28)',
                  transition: 'background .3s ease',
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: 'rgba(255,255,255,.78)', fontVariantNumeric: 'tabular-nums' }}>
            {idx + 1}
            <span style={{ color: 'rgba(255,255,255,.45)' }}> / {total}</span>
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* badge + heure + estimation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', flexWrap: 'wrap', ...rise(0) }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--crm-space-sm)',
              padding: 'var(--crm-space-xs) var(--crm-space-lg)',
              borderRadius: 'var(--crm-radius-pill)',
              background: 'rgba(8,8,12,.5)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,.18)',
              fontSize: 'var(--crm-text-sm)',
              fontWeight: 600,
              letterSpacing: 0.3,
              color: '#fff',
              whiteSpace: 'nowrap',
            }}
          >
            <MEIcon name={typeIcon} size={12} strokeWidth={2.1} color={tyy.badge} />
            {tagLabel}
          </span>
          {item.time ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--crm-space-xs)',
                fontSize: 'var(--crm-text-sm)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                color: item.urgent ? '#F7B0AA' : 'rgba(255,255,255,.72)',
              }}
            >
              <MEIcon name="clock" size={12} color={item.urgent ? '#F7B0AA' : 'rgba(255,255,255,.6)'} />
              {item.time}
            </span>
          ) : null}
          <span
            title={t('today.focus.estimatedPriority')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap', color: 'rgba(255,255,255,.62)' }}
          >
            <MEIcon name="sparkle" size={12} color="#9b7cf0" />
            {t('today.focus.estimate')} · {item.displayScore}
          </span>
        </div>

        <h2 style={{ margin: '12px 0 0', fontSize: 'var(--crm-text-5xl)', fontWeight: 500, letterSpacing: -0.8, lineHeight: 1.04, ...rise(1) }}>{item.contact}</h2>
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,.84)', lineHeight: 1.42, fontWeight: 500, fontSize: 'var(--crm-text-xl)', ...rise(2) }}>{item.sub}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-md)', color: 'rgba(255,255,255,.66)', marginTop: 6, ...rise(2) }}>
          <MEIcon name="sparkle" size={12} color="#9b7cf0" />
          <span>{item.reason}</span>
        </div>

        {/* prix + actions */}
        <div style={{ marginTop: 15, paddingTop: 'var(--crm-space-2xl)', borderTop: '1px solid rgba(255,255,255,.18)', ...rise(3) }}>
          <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: -0.4, marginBottom: 12 }}>{item.bien.price}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
            <button
              type="button"
              onClick={onPrimary}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--crm-space-md)',
                height: 50,
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-xl)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                background: calling ? '#0B7A4B' : '#fff',
                color: calling ? MXC_COLOR.n1000 : MXC_COLOR.n100,
                boxShadow: '0 10px 26px -10px rgba(0,0,0,.55)',
                transition: 'background .25s ease',
              }}
            >
              {calling ? (
                <>
                  <span style={{ position: 'relative', display: 'inline-flex', width: 9, height: 9 }}>
                    <span style={{ position: 'absolute', inset: 0, borderRadius: 'var(--crm-radius-pill)', background: '#34C796', animation: 'mfHeroPing 1.4s cubic-bezier(0,0,.2,1) infinite' }} />
                    <span style={{ position: 'relative', width: 9, height: 9, borderRadius: 'var(--crm-radius-pill)', background: '#34C796' }} />
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {t('today.focus.finish')} · {mmss}
                  </span>
                </>
              ) : (
                <>
                  <MEIcon name={typeIcon} size={18} strokeWidth={2} color={MXC_COLOR.n100} />
                  {primaryLabel}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={snooze}
              aria-label={t('today.focus.reschedule')}
              style={{
                width: 50,
                height: 50,
                borderRadius: 'var(--crm-radius-pill)',
                flexShrink: 0,
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,.22)',
                background: 'rgba(8,9,12,.42)',
                backdropFilter: 'blur(8px)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <MEIcon name="calendar" size={18} color="#fff" />
            </button>
            <button
              type="button"
              onClick={done}
              aria-label={t('today.focus.markDone')}
              style={{
                width: 50,
                height: 50,
                borderRadius: 'var(--crm-radius-pill)',
                flexShrink: 0,
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,.22)',
                background: 'rgba(8,9,12,.42)',
                backdropFilter: 'blur(8px)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <MEIcon name="check" size={19} strokeWidth={2.3} color="#fff" />
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes mfHeroPing { 0% { transform: scale(1); opacity: .7 } 75%,100% { transform: scale(2.4); opacity: 0 } }`}</style>
    </div>
  )
}
