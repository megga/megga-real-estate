// Atelier Matching — COL 1 · file d'acheteurs scorés + parking « Reportés ».
// Port hi-fi du handoff (SgaQueue / SgaQueueRow / parking snooze repliable).

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import SgaIcon from './SgaIcon'
import { sgaInitials, sgaScoreColor } from './format'
import type { AtelierBuyer, AtelierTab } from './types'

interface SgaQueueRowProps {
  b: AtelierBuyer
  selected: boolean
  exiting: string | null
  onClick: () => void
}

function SgaQueueRow({ b, selected, exiting, onClick }: SgaQueueRowProps) {
  return (
    <div className={'sga-row' + (exiting ? ` exit-${exiting}` : '')} data-sel={selected} onClick={onClick}>
      <span className="flash" />
      <div className="av" style={{ width: 38, height: 38, background: b.av, fontSize: 13.5 }}>
        {sgaInitials(b.first, b.last)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="nm">{b.first} {b.last}</div>
      </div>
      <span className="sc" style={{ color: sgaScoreColor(b.score) }}>{b.score}</span>
    </div>
  )
}

export interface SnoozedEntry {
  b: AtelierBuyer
  until: string
}

interface SgaQueueProps {
  filtered: AtelierBuyer[]
  selectedId: string | null
  exiting: { id: string; dir: string } | null
  query: string
  setQuery: (q: string) => void
  onPick: (id: string) => void
  snoozed: SnoozedEntry[]
  onWake: (matchId: string) => void
  tab: AtelierTab
}

const listV = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.03 } } }
const rowV = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.2, 0.8, 0.2, 1] as const } },
}

export default function SgaQueue({ filtered, selectedId, exiting, query, setQuery, onPick, snoozed, onWake, tab }: SgaQueueProps) {
  const { t } = useTranslation('matching')
  const [snzOpen, setSnzOpen] = useState(true)
  const prevSnz = useRef(snoozed.length)

  useEffect(() => {
    if (snoozed.length > prevSnz.current) setSnzOpen(true) // nouvel arrivé → déplier
    prevSnz.current = snoozed.length
  }, [snoozed.length])

  return (
    <section className="sga-panel sga-enter" aria-label={t('atelier.buyerQueue')}>
      <div className="sga-queue-h">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <SgaIcon d="search" size={16} style={{ position: 'absolute', left: 15, color: 'var(--ink-dim)' }} />
          <input
            className="field"
            style={{ paddingLeft: 40 }}
            placeholder={t('atelier.searchBuyer')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="sga-queue-list">
        {filtered.length === 0 && (
          <div className="sga-empty">
            <div>
              <div className="t4 med" style={{ marginBottom: 6, color: 'var(--ink)' }}>{t('atelier.queueEmpty')}</div>
              <div className="t1 muted">{t('atelier.noBuyerLeft')}</div>
            </div>
          </div>
        )}
        <motion.div key={tab} className="sga-queue-stagger" variants={listV} initial="hidden" animate="show">
          {filtered.map(b => (
            <motion.div key={b.matchId} variants={rowV}>
              <SgaQueueRow
                b={b}
                selected={b.matchId === selectedId}
                exiting={exiting && exiting.id === b.matchId ? exiting.dir : null}
                onClick={() => onPick(b.matchId)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
      {snoozed.length > 0 && (
        <div className="sga-snoozed" data-open={snzOpen}>
          <button
            className="sga-snoozed-h"
            onClick={() => setSnzOpen(o => !o)}
            aria-expanded={snzOpen}
            aria-label={t('atelier.snoozedCount', { count: snoozed.length })}
          >
            <SgaIcon d="clock" size={13} />
            <span>{t('atelier.snoozed')}</span>
            <span className="cnt nums">{snoozed.length}</span>
            <SgaIcon d="chevron-down" size={14} className="chev" />
          </button>
          <div className="sga-snoozed-body">
            <div className="inner">
              {snoozed.map(({ b, until }, i) => (
                <div
                  className="sga-snooze-row"
                  key={b.matchId}
                  style={{ animationDelay: `${i * 40}ms` }}
                  onClick={() => onWake(b.matchId)}
                  title={t('atelier.reactivateNow')}
                >
                  <div className="av" style={{ width: 32, height: 32, background: b.av, fontSize: 11.5 }}>
                    {sgaInitials(b.first, b.last)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nm">{b.first} {b.last}</div>
                    <div className="ret"><SgaIcon d="clock" size={11} /> {t('atelier.backOn', { date: until })}</div>
                  </div>
                  <button className="wake" onClick={e => { e.stopPropagation(); onWake(b.matchId) }}>
                    {t('atelier.reactivate')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
