/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : vue Timeline.
 * Port 1:1 du handoff crm-screen-pipeline-sugar.jsx §SugarPipelineTimeline
 * (concept C « Aujourd'hui au centre ») : barre par deal de la dernière
 * activité (updatedAt, gris) à l'échéance (teinte SG_STAGE_HUE), fenêtre
 * bornée ~14 j (hors cadre → chevrons + date complète), axe sticky avec le
 * repère « Aujourd'hui », groupes temporels repliables (En retard / Aujourd'hui /
 * Cette semaine / Ce mois / Plus tard) avec somme CHF et pile d'avatars.
 *
 * Écart prod assumé : la poignée d'échéance PERSISTE la replanification
 * (useRescheduleReminder via onReschedule — granularité jour, heure d'origine
 * conservée, borne ≥ aujourd'hui). Le proto ne gardait qu'un état local.
 * Libellés de dates via Intl (langue active), plus de tables FR codées en dur.
 */

import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CRM_STAGES, SG_STAGE_HUE, crmFmtCHF, crmInitials, type SugarPalette } from '../tokens'
import { crmContactById, type CrmContact, type CrmDeal } from '../mockData'

interface Props {
  sp: SugarPalette
  dark: boolean
  deals: CrmDeal[]
  onOpenDeal: (id: string) => void
  /** Persiste la replanification (reminder → trigger_at). Rejet = rollback visuel. */
  onReschedule: (reminderId: string, triggerAtIso: string) => Promise<void>
}

type TlDeal = CrmDeal & { c: CrmContact }

const DAY_MS = 864e5

export function PipelineTimeline({ sp, dark, deals, onOpenDeal, onReschedule }: Props) {
  const { t, i18n } = useTranslation('pipeline')
  const surface = dark ? sp.cardBg : '#FFFFFF'
  const weekdayFmt = useMemo(() => new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }), [i18n.language])
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: 'short' }), [i18n.language])
  const todayLine = dark ? 'rgba(255,255,255,0.55)' : '#0B0C0E'
  const axisText = dark ? 'rgba(255,255,255,0.34)' : '#B5BAC2'

  const withDates = useMemo<TlDeal[]>(
    () => deals
      .filter(d => d.nextAction?.dueAt)
      .map(d => ({ ...d, c: crmContactById(d.contactId) as CrmContact }))
      .filter(d => !!d.c),
    [deals],
  )
  const now = Date.now()

  // Replanification : override optimiste local + persistance (rollback si échec).
  const [tlDueOverride, setTlDueOverride] = useState<Record<string, string>>({})
  const [tlDrag, setTlDrag] = useState<{ id: string; day: number } | null>(null)
  const tlDraggedRef = useRef(false)

  // Fenêtre temps dérivée des données + du repère « maintenant » (bornée ~14 j).
  const times = withDates.flatMap(d => [
    new Date(d.updatedAt).getTime(),
    new Date(d.nextAction!.dueAt).getTime(),
  ]).concat([now])
  const minT = times.length ? Math.min(...times) : now
  const maxT = times.length ? Math.max(...times) : now
  const nowDay0 = new Date(now); nowDay0.setHours(0, 0, 0, 0)
  const startD = new Date(minT); startD.setHours(0, 0, 0, 0)
  let start = startD.getTime()
  const endD = new Date(maxT); endD.setHours(0, 0, 0, 0)
  let DAYS = Math.max(7, Math.round((endD.getTime() - start) / DAY_MS) + 1)
  const TL_MAXD = 14
  if (DAYS > TL_MAXD) { start = Math.max(start, nowDay0.getTime() - 7 * DAY_MS); DAYS = TL_MAXD }
  const idx = (tVal: string | number) => Math.max(0, Math.min(DAYS, (new Date(tVal).getTime() - start) / DAY_MS))
  const nowIdx = (now - start) / DAY_MS
  const nowOn = nowIdx >= 0 && nowIdx <= DAYS
  const todayIdx = Math.round((nowDay0.getTime() - start) / DAY_MS)
  const dayMonth = (i: number) => {
    const d = new Date(start + i * DAY_MS)
    return `${d.getDate()} ${monthFmt.format(d)}`
  }

  const WHO = 208, ACT = 168, ROW = 58
  const pct = (v: number) => `${(v / DAYS) * 100}%`

  const todayD = new Date(now)
  const todayLabel = `${weekdayFmt.format(todayD)} ${todayD.getDate()} ${monthFmt.format(todayD)}`

  const fmtFullDT = (s: string) => {
    const d = new Date(s)
    return `${d.getDate()} ${monthFmt.format(d)}, ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`
  }
  const hm = (s: string) => {
    const d = new Date(s)
    return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`
  }

  const cRows = useMemo(() => withDates.map(d => {
    const due = tlDueOverride[d.id] || d.nextAction!.dueAt
    const f = idx(d.updatedAt)
    const rawT = (new Date(due).getTime() - start) / DAY_MS
    const over = rawT > DAYS
    let tPos = Math.max(0, Math.min(DAYS, rawT))
    if (!over && tPos - f < 0.9) tPos = Math.min(DAYS, f + 0.9)
    const due0 = new Date(due); due0.setHours(0, 0, 0, 0)
    const di = Math.round((due0.getTime() - start) / DAY_MS)
    return { ...d, due, f, t: tPos, di, over }
  }).sort((a, b) => a.di - b.di || a.t - b.t),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [withDates, tlDueOverride, start, DAYS])

  const jj = (di: number) => di - todayIdx
  const jLabel = (di: number) => {
    const j = jj(di)
    return j < 0 ? t('board.card.overdue') : j === 0 ? t('board.card.today') : t('timeline.jMinus', { count: j })
  }
  const pastTrack = dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'
  const pastZone = dark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.022)'
  const [tlClosed, setTlClosed] = useState<Record<string, boolean>>({})
  const stickyBg = sp.pageBg

  // Groupes temporels repliables — tient de 2 à 50+ deals sans perdre l'axe.
  const TL_GROUPS: { k: string; l: string; test: (j: number) => boolean }[] = [
    { k: 'late', l: t('timeline.groups.late'), test: j => j < 0 },
    { k: 'today', l: t('timeline.groups.today'), test: j => j === 0 },
    { k: 'week', l: t('timeline.groups.week'), test: j => j >= 1 && j <= 6 },
    { k: 'month', l: t('timeline.groups.month'), test: j => j >= 7 && j <= 30 },
    { k: 'later', l: t('timeline.groups.later'), test: j => j > 30 },
  ]
  const tlGroups = TL_GROUPS
    .map(g => ({ ...g, rows: cRows.filter(d => g.test(jj(d.di))) }))
    .filter(g => g.rows.length)

  const renderTlRow = (deal: typeof cRows[number]) => {
    const sColor = SG_STAGE_HUE[deal.stage] || CRM_STAGES[deal.stage].color
    const isDrag = tlDrag?.id === deal.id
    const effT = isDrag ? Math.max(tlDrag.day, deal.f + 0.2) : deal.t
    const effDi = isDrag ? tlDrag.day : deal.di
    const over = isDrag ? false : deal.over
    const j = jj(effDi)
    const past = Math.min(effT, Math.max(deal.f, nowIdx))
    const fut = effT > nowIdx ? effT - Math.max(nowIdx, deal.f) : 0
    const reminderId = deal.nextAction?.reminderId

    const startDrag = (e: React.PointerEvent) => {
      e.stopPropagation(); e.preventDefault()
      const parent = (e.currentTarget as HTMLElement).parentElement
      if (!parent) return
      const r = parent.getBoundingClientRect()
      let lastDay: number | null = null
      const move = (ev: PointerEvent) => {
        // Granularité jour, borné ≥ aujourd'hui (pas de replanification passée).
        const day = Math.max(todayIdx, Math.min(DAYS, Math.round(((ev.clientX - r.left) / r.width) * DAYS)))
        lastDay = day; tlDraggedRef.current = true
        setTlDrag({ id: deal.id, day })
      }
      const up = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
        if (lastDay != null) {
          // Nouvelle date au jour choisi, heure d'origine conservée.
          const od = new Date(deal.due)
          const nd = new Date(start + lastDay * DAY_MS)
          nd.setHours(od.getHours(), od.getMinutes(), 0, 0)
          const iso = nd.toISOString()
          setTlDueOverride(o => ({ ...o, [deal.id]: iso }))
          if (reminderId) {
            onReschedule(reminderId, iso).catch(() => {
              // Échec de persistance → rollback de l'override optimiste.
              setTlDueOverride(o => {
                const next = { ...o }
                delete next[deal.id]
                return next
              })
            })
          }
        }
        setTlDrag(null)
      }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    }

    return (
      <div key={deal.id}
        onClick={() => {
          if (tlDraggedRef.current) { tlDraggedRef.current = false; return }
          onOpenDeal(deal.id)
        }}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', height: ROW, cursor: 'pointer' }}>
        {/* Contact */}
        <div style={{
          width: WHO, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
          paddingRight: 14, minWidth: 0, zIndex: 1,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 999, background: deal.c.avatarBg || '#0B0C0E',
            color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>{crmInitials(`${deal.c.firstName} ${deal.c.lastName}`)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: sp.ink,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{deal.c.firstName} {deal.c.lastName}</div>
            {deal.value ? (
              <div style={{ fontSize: 11, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                {crmFmtCHF(deal.value)}
              </div>
            ) : null}
          </div>
        </div>
        {/* Piste : passé grisé → futur coloré → point d'échéance (glissable) */}
        <div style={{ flex: 1, position: 'relative', height: '100%' }}>
          {past > deal.f && (
            <div style={{
              position: 'absolute', top: '50%', transform: 'translateY(-50%)',
              left: pct(deal.f), width: pct(past - deal.f), height: 6, borderRadius: 99, background: pastTrack,
            }} />
          )}
          <div title={t('timeline.lastActivity', { date: dayMonth(Math.floor(deal.f)) })}
            style={{
              position: 'absolute', top: '50%', transform: 'translate(-50%,-50%)',
              left: pct(deal.f), width: 18, height: 22, zIndex: 1,
            }} />
          {fut > 0 && (
            <div style={{
              position: 'absolute', top: '50%', transform: 'translateY(-50%)',
              left: pct(Math.max(nowIdx, deal.f)), width: pct(fut), height: 6, borderRadius: 99, background: sColor,
            }} />
          )}
          {isDrag && (
            <div style={{
              position: 'absolute', top: -4, bottom: -4, left: pct(tlDrag.day), width: 1,
              background: dark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.25)',
            }} />
          )}
          {over ? (
            <svg width="14" height="14" viewBox="0 0 14 14" style={{
              position: 'absolute', top: '50%', right: -2, transform: 'translateY(-50%)', zIndex: 2,
            }}>
              <path d="M3 2.5L7.5 7L3 11.5M8 2.5L12.5 7L8 11.5" fill="none" stroke={sColor}
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <div onPointerDown={startDrag} onClick={e => e.stopPropagation()} title={t('timeline.dragHint')}
              style={{
                position: 'absolute', top: '50%', transform: 'translate(-50%,-50%)', left: pct(effT),
                zIndex: 3, width: 28, height: 28, display: 'grid', placeItems: 'center',
                cursor: isDrag ? 'grabbing' : 'grab', touchAction: 'none',
              }}>
              <span style={{
                width: 13, height: 13, borderRadius: 99, background: surface,
                boxShadow: `inset 0 0 0 3px ${sColor}${isDrag ? `, 0 0 0 4px ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)'}` : ''}`,
              }} />
              {isDrag && (
                <span style={{
                  position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                  background: dark ? 'rgba(255,255,255,0.92)' : '#0B0C0E',
                  color: dark ? '#0B0C0E' : '#fff', whiteSpace: 'nowrap',
                }}>{dayMonth(tlDrag.day)}</span>
              )}
            </div>
          )}
        </div>
        {/* Échéance : distance + action */}
        <div style={{ width: ACT, flexShrink: 0, paddingLeft: 16, textAlign: 'right', minWidth: 0, zIndex: 1 }}>
          <span style={{
            display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '3px 10px',
            borderRadius: 999, fontVariantNumeric: 'tabular-nums',
            ...(j <= 0
              ? { background: todayLine, color: dark ? '#0B0C0E' : '#fff' }
              : { background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)', color: sp.ink }),
          }}>{jLabel(effDi)}</span>
          <div style={{
            fontSize: 11, fontWeight: 600, color: sp.sub, marginTop: 3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {t(`timeline.kind.${deal.nextAction!.kind}`, { defaultValue: t('timeline.kind.fallback') })}
            {' · '}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{over ? fmtFullDT(deal.due) : hm(deal.due)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      userSelect: tlDrag ? 'none' : 'auto',
    }}>
      {/* Axe sticky : le repère « aujourd'hui » reste visible en scrollant */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, background: stickyBg,
        padding: '0 24px 10px', display: 'flex', alignItems: 'flex-end',
      }}>
        <div style={{ width: WHO, flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: axisText,
          }}>{t('timeline.axis.contact')}</span>
        </div>
        <div style={{ flex: 1, position: 'relative', height: 34 }}>
          {nowOn && (
            <div style={{
              position: 'absolute', left: pct(nowIdx), transform: 'translateX(-50%)', bottom: -2,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            }}>
              <span style={{
                fontSize: 10.5, fontWeight: 800, padding: '2px 9px', borderRadius: 999,
                background: todayLine, color: dark ? '#0B0C0E' : '#fff', whiteSpace: 'nowrap',
              }}>{t('timeline.todayChip', { date: todayLabel })}</span>
              <span style={{ width: 1.5, height: 8, background: todayLine }} />
            </div>
          )}
        </div>
        <div style={{ width: ACT, flexShrink: 0, textAlign: 'right' }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: axisText,
          }}>{t('timeline.axis.due')}</span>
        </div>
      </div>

      {cRows.length === 0 && (
        <div style={{
          background: surface, borderRadius: 22, boxShadow: sp.shadow,
          padding: '40px 18px', textAlign: 'center', fontSize: 13, color: sp.sub,
        }}>{t('timeline.emptySearch')}</div>
      )}

      {tlGroups.map(g => {
        const isClosed = !!tlClosed[g.k]
        const groupValue = g.rows.reduce((x, d) => x + (d.value || 0), 0)
        return (
          <div key={g.k}>
            <button onClick={() => setTlClosed(c => ({ ...c, [g.k]: !c[g.k] }))}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
                cursor: 'pointer', padding: '12px 4px 8px', font: 'inherit',
              }}>
              <svg width="12" height="12" viewBox="0 0 12 12"
                style={{ transform: isClosed ? 'rotate(-90deg)' : 'none', flexShrink: 0 }}>
                <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke={sp.ink}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: sp.ink }}>{g.l}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                {t('timeline.dealsCount', { count: g.rows.length })}
              </span>
              {groupValue > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                  {crmFmtCHF(groupValue)}
                </span>
              )}
              {isClosed && (
                <span style={{ display: 'flex', marginLeft: 4 }}>
                  {g.rows.slice(0, 4).map((d, i) => (
                    <span key={d.id} style={{
                      width: 22, height: 22, borderRadius: 999, background: d.c.avatarBg || '#0B0C0E',
                      color: '#fff', fontSize: 8, fontWeight: 700, display: 'grid', placeItems: 'center',
                      boxShadow: `0 0 0 2px ${stickyBg}`, marginLeft: i ? -6 : 0,
                    }}>{crmInitials(`${d.c.firstName} ${d.c.lastName}`)}</span>
                  ))}
                  {g.rows.length > 4 && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, color: sp.sub, marginLeft: 6,
                      alignSelf: 'center', fontVariantNumeric: 'tabular-nums',
                    }}>+{g.rows.length - 4}</span>
                  )}
                </span>
              )}
            </button>
            {!isClosed && (
              <div style={{
                position: 'relative', background: surface, borderRadius: 22, boxShadow: sp.shadow,
                padding: '10px 24px 12px', boxSizing: 'border-box',
              }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: WHO, right: ACT, top: 0, bottom: 0,
                    pointerEvents: 'none', zIndex: 0,
                  }}>
                    {nowOn && (
                      <div style={{
                        position: 'absolute', top: 0, bottom: 0, left: 0, width: pct(nowIdx),
                        background: pastZone, borderRadius: 14,
                      }} />
                    )}
                    {nowOn && (
                      <div style={{
                        position: 'absolute', top: -10, bottom: -12, left: pct(nowIdx),
                        width: 1.5, background: todayLine,
                      }} />
                    )}
                  </div>
                  {g.rows.map(renderTlRow)}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
