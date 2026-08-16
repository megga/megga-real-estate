// Atelier Matching — COL 1 · file d'acheteurs + parking « À programmer ».
// Port du bundle maquette (variante actée recherche:"auto").
//
// Pourquoi certains choix :
// - La rangée n'affiche plus le score chiffré : le détail du score vit en col 3
//   (« Pourquoi ça matche »), le doublon en file ne portait pas de décision.
//   Le seul signal gardé en liste est le sceau KYC — une info d'identité, pas un
//   accent UI. Le sceau est recopié de MmVerifiedBadge (prod mobile) ; il tire sa
//   couleur de --atl-kyc-seal, aligné sur le token kycSeal de crm-mobile/tokens.
// - recherche:"auto" — au-delà de QUEUE_LONG lignes la file dépasse un écran :
//   la recherche est promue au-dessus de l'en-tête et celui-ci se compacte sur une
//   ligne, pour rendre des acheteurs visibles sans défiler. La recherche reste
//   toujours hors de la zone scrollable.
// - Le parking est replié par défaut et sa hauteur est plafonnée (CSS) : le foyer
//   des rappels reste la page Aujourd'hui, ici ce n'est qu'un écho local.
// - Regroupement temporel : possible seulement si l'appelant fournit `ts`
//   (échéance en ms). Les reports faits dans la session ne portent qu'une date
//   déjà formatée ; dans ce cas on rend une liste plate avec la date par ligne
//   plutôt que de deviner un groupe.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import AtlIcon from './AtlIcon'
import { atlInitials } from './format'
import type { AtelierBuyer, AtelierTab } from './types'
import { encreSur } from '@/components/megga-x-crm/tokens'

/** Au-delà de ce nombre de lignes la file dépasse un écran → en-tête compact. */
const QUEUE_LONG = 10

// Sceau festonné + coche détourée en négatif (evenodd) : la coche ressort en
// blanc sur n'importe quel fond. Tracé identique à MmVerifiedBadge (prod mobile).
const ATL_SEAL_D =
  'M18.0251 7.80663C18.0849 7.86693 18.1447 7.92724 18.2046 7.98756C19.059 8.84386 19.059 10.0393 18.2032 10.8984C18.0802 11.0215 17.9574 11.1449 17.8346 11.2682C17.5398 11.5643 17.2452 11.8603 16.9484 12.1527C16.8508 12.2416 16.7739 12.3508 16.7231 12.4726C16.6722 12.5944 16.6487 12.7258 16.6541 12.8577C16.6664 13.4044 16.6624 13.9516 16.6585 14.4988C16.6581 14.5509 16.6577 14.6031 16.6573 14.6553C16.6485 15.8522 15.8071 16.6912 14.6084 16.6991C14.5622 16.6994 14.516 16.6997 14.4699 16.7C13.9167 16.7036 13.3635 16.7071 12.8108 16.6963C12.5407 16.6926 12.3343 16.786 12.1474 16.9729C11.9929 17.1261 11.8412 17.2821 11.6894 17.4381C11.3474 17.7897 11.0055 18.1413 10.6324 18.4603C10.3688 18.6825 10.0453 18.8218 9.70276 18.8607C9.16599 18.962 8.68108 18.8158 8.26064 18.4949C7.8483 18.1788 7.49077 17.8016 7.13363 17.4248C7.01413 17.2987 6.89467 17.1727 6.77321 17.049C6.53356 16.8038 6.28316 16.6809 5.93232 16.6959C5.48556 16.7146 5.03762 16.7096 4.58968 16.7046C4.46947 16.7032 4.34926 16.7019 4.22907 16.701C3.03875 16.693 2.19039 15.8424 2.18618 14.653C2.18198 14.0387 2.17824 13.4239 2.18618 12.8096C2.18994 12.693 2.16885 12.577 2.1243 12.4692C2.07976 12.3615 2.01279 12.2644 1.92785 12.1845C1.49277 11.7513 1.05846 11.3167 0.624942 10.8807C-0.207067 10.0445 -0.208468 8.84806 0.621672 8.01185C0.656025 7.97727 0.690372 7.94269 0.724717 7.90812C1.11818 7.51201 1.5113 7.11625 1.90916 6.72483C2.00059 6.64067 2.07273 6.53773 2.12063 6.42306C2.16853 6.30839 2.19105 6.18472 2.18665 6.06053C2.179 5.45984 2.18262 4.86001 2.18624 4.26063L2.18665 4.1919C2.19319 3.06325 3.04622 2.20321 4.17861 2.18826C4.78592 2.17751 5.39322 2.17284 6.00053 2.18826C6.29671 2.19573 6.5158 2.09623 6.72276 1.88788C6.85821 1.75166 6.99116 1.61272 7.12412 1.47378C7.47539 1.10671 7.82669 0.739602 8.2242 0.422402C8.65212 0.0804424 9.14917 -0.0657781 9.70276 0.0276535C10.1531 0.0832453 10.5287 0.291598 10.8468 0.606462C11.2738 1.0269 11.7003 1.44735 12.1175 1.87853C12.211 1.98171 12.3259 2.06323 12.4542 2.11737C12.5825 2.17151 12.7211 2.19698 12.8603 2.192C13.0546 2.19161 13.2491 2.18718 13.4437 2.18275C13.9494 2.17124 14.4554 2.15972 14.9588 2.21909C15.4192 2.27434 15.8443 2.49366 16.1562 2.83685C16.468 3.18004 16.6458 3.62412 16.6569 4.08772C16.6714 4.73334 16.6695 5.37988 16.6569 6.0255C16.6512 6.15765 16.6746 6.28944 16.7252 6.41162C16.7759 6.5338 16.8527 6.64341 16.9502 6.73277C17.312 7.0873 17.6682 7.44662 18.0251 7.80663ZM13.7641 7.95458C13.9525 7.73869 14.0659 7.48946 14.0488 7.2273C14.0504 6.56838 13.5703 6.09201 12.9447 6.07909C12.4634 6.0695 12.1733 6.36249 11.889 6.68966C10.9696 7.748 10.0476 8.80383 9.1229 9.85716C8.91993 10.0906 8.82157 10.0922 8.58109 9.89884C8.46389 9.80446 8.34681 9.70993 8.22972 9.61541C7.90422 9.35263 7.57872 9.08985 7.25074 8.83022C7.21668 8.80323 7.18298 8.77572 7.14927 8.7482C7.00604 8.63128 6.86266 8.51422 6.6906 8.43595C6.44505 8.32122 6.16605 8.30011 5.90604 8.37661C5.64603 8.4531 5.42291 8.62192 5.27861 8.85134C5.13431 9.08077 5.07878 9.35499 5.12244 9.62249C5.1661 9.88997 5.30595 10.1323 5.51571 10.3039L5.5854 10.3602C6.47949 11.0825 7.37377 11.8049 8.27518 12.5179C8.83158 12.9584 9.43382 12.9034 9.90061 12.3724C11.1901 10.9015 12.4779 9.42885 13.7641 7.95458Z'

/** Sceau KYC vérifié — recopie de MmVerifiedBadge, couleur via --atl-kyc-seal. */
function AtlVerifiedSeal({ size = 14 }: { size?: number }) {
  const { t } = useTranslation('matching')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      style={{ flexShrink: 0, display: 'block' }}
      role="img"
      aria-label={t('atelierKyc.verified')}
    >
      <circle cx="9.5" cy="9.5" r="5.6" fill="#FFFFFF" />
      <path d={ATL_SEAL_D} fill="var(--atl-kyc-seal)" fillRule="evenodd" clipRule="evenodd" />
    </svg>
  )
}

interface AtlQueueRowProps {
  b: AtelierBuyer
  selected: boolean
  exiting: string | null
  onClick: () => void
}

function AtlQueueRow({ b, selected, exiting, onClick }: AtlQueueRowProps) {
  return (
    <div className={'atl-row' + (exiting ? ` exit-${exiting}` : '')} data-sel={selected} onClick={onClick}>
      <span className="flash" />
      <div className="av" style={{ width: 38, height: 38, background: b.av, color: encreSur(b.av), fontSize: 'var(--crm-text-md)' }}>
        {atlInitials(b.first, b.last)}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="nm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {b.first} {b.last}
        </div>
        {b.kyc === 'verified' && <AtlVerifiedSeal size={14} />}
      </div>
    </div>
  )
}

export interface SnoozedEntry {
  b: AtelierBuyer
  /** échéance déjà formatée (« 17 juin ») */
  until: string
  /** échéance en ms — optionnelle : sans elle, pas de regroupement temporel */
  ts?: number | null
}

interface AtlQueueProps {
  filtered: AtelierBuyer[]
  selectedId: string | null
  exiting: { id: string; dir: string } | null
  query: string
  setQuery: (q: string) => void
  onPick: (id: string) => void
  snoozed: SnoozedEntry[]
  onWake: (matchId: string) => void
  tab: AtelierTab
  /** rouvre le sélecteur de date d'un report ; le bouton « Changer » n'apparaît que si fourni */
  onReschedule?: (matchId: string) => void
}

const listV = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.03 } } }
const rowV = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.2, 0.8, 0.2, 1] as const } },
}

/** true si l'échéance tombe dans les 7 jours (jour calendaire). */
function withinWeek(ts: number): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 864e5) <= 7
}

export default function AtlQueue({
  filtered,
  selectedId,
  exiting,
  query,
  setQuery,
  onPick,
  snoozed,
  onWake,
  tab,
  onReschedule,
}: AtlQueueProps) {
  const { t } = useTranslation('matching')
  // replié par défaut : le foyer des rappels est Aujourd'hui, ici c'est un résumé
  const [snzOpen, setSnzOpen] = useState(false)
  const prevSnz = useRef(snoozed.length)

  useEffect(() => {
    // volontairement sans auto-ouverture : à l'échelle (50 contacts) le parking
    // gonflerait la colonne à chaque report
    prevSnz.current = snoozed.length
  }, [snoozed.length])

  const searchTop = filtered.length >= QUEUE_LONG
  const sortLabel = tab === 'no-reply' ? t('atelier.sortByRelance') : t('atelier.sortByMatch')

  const searchBar = (
    <div className="atl-queue-h" data-pos={searchTop ? 'top' : 'below'}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <AtlIcon d="search" size={16} style={{ position: 'absolute', left: 15, color: 'var(--ink-dim)' }} />
        <input
          className="field"
          style={{ paddingLeft: 40 }}
          placeholder={t('atelier.searchBuyer')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
    </div>
  )

  // groupes temporels : seulement si TOUTES les échéances portent un timestamp
  const grouped = snoozed.length > 0 && snoozed.every(s => typeof s.ts === 'number')
  const groups = grouped
    ? [
        { key: 'week', label: t('atelier.scheduleThisWeek'), rows: snoozed.filter(s => withinWeek(s.ts as number)) },
        { key: 'later', label: t('atelier.scheduleLater'), rows: snoozed.filter(s => !withinWeek(s.ts as number)) },
      ].filter(g => g.rows.length > 0)
    : [{ key: 'all', label: null, rows: snoozed }]

  let rowIndex = 0

  return (
    <section className="atl-panel atl-enter" aria-label={t('atelier.buyerQueue')}>
      {searchTop && searchBar}
      {searchTop ? (
        <div className="atl-queue-head" data-compact="true">
          <span className="eyebrow">{t('atelier.emptyStage.queueEyebrow')}</span>
          <span className="big nums">{filtered.length}</span>
          <span className="lb">{t('atelier.queueSortedBy')} {sortLabel}</span>
        </div>
      ) : (
        <div className="atl-queue-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>{t('atelier.emptyStage.queueEyebrow')}</div>
            <div className="big nums">{filtered.length}</div>
          </div>
          <div className="lb eyebrow" style={{ color: 'var(--ink-muted)' }}>
            {t('atelier.queueSortedBy')}<br />{sortLabel}
          </div>
        </div>
      )}
      {!searchTop && searchBar}
      <div className="atl-queue-list">
        {filtered.length === 0 && (
          <div className="atl-empty">
            <div>
              <div className="t4 med" style={{ marginBottom: 6, color: 'var(--ink)' }}>{t('atelier.queueEmpty')}</div>
              <div className="t1 muted">{t('atelier.noBuyerLeft')}</div>
            </div>
          </div>
        )}
        <motion.div key={tab} className="atl-queue-stagger" variants={listV} initial="hidden" animate="show">
          {filtered.map(b => (
            <motion.div key={b.matchId} variants={rowV}>
              <AtlQueueRow
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
        <div className="atl-snoozed atl-programmer" data-open={snzOpen}>
          <button
            className="atl-snoozed-h"
            onClick={() => setSnzOpen(o => !o)}
            aria-expanded={snzOpen}
            aria-label={t('atelier.toScheduleCount', { count: snoozed.length })}
          >
            <AtlIcon d="clock" size={13} />
            <span>{t('atelier.toSchedule')}</span>
            <span className="cnt nums">{snoozed.length}</span>
            <AtlIcon d="chevron-down" size={14} className="chev" />
          </button>
          <div className="atl-snoozed-body">
            <div className="inner">
              {groups.map(g => (
                <div key={g.key} style={{ display: 'contents' }}>
                  {g.label && (
                    <div className="atl-prog-group">
                      <span>{g.label}</span>
                      <span className="rule" />
                      <span className="nums">{g.rows.length}</span>
                    </div>
                  )}
                  {g.rows.map(({ b, until }) => {
                    const delay = rowIndex++ * 40
                    return (
                      <div
                        className="atl-snooze-row"
                        key={b.matchId}
                        style={{ animationDelay: `${delay}ms` }}
                        onClick={() => (onReschedule ? onReschedule(b.matchId) : onWake(b.matchId))}
                        title={onReschedule ? t('atelier.changeDate') : t('atelier.reactivateNow')}
                      >
                        <div className="av" style={{ width: 32, height: 32, background: b.av, color: encreSur(b.av), fontSize: 'var(--crm-text-xs)' }}>
                          {atlInitials(b.first, b.last)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="nm">{b.first} {b.last}</div>
                          {/* sans groupes de date, la ligne porte elle-même l'échéance */}
                          {!grouped && (
                            <div className="ret"><AtlIcon d="clock" size={11} /> {t('atelier.backOn', { date: until })}</div>
                          )}
                        </div>
                        <div className="atl-prog-actions">
                          {onReschedule && (
                            <button
                              className="wake ghost"
                              onClick={e => { e.stopPropagation(); onReschedule(b.matchId) }}
                            >
                              {t('atelier.changeDate')}
                            </button>
                          )}
                          <button className="wake" onClick={e => { e.stopPropagation(); onWake(b.matchId) }}>
                            {t('atelier.resume')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
