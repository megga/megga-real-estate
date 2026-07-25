// Matching · Recherche — carte annonce (grille). Port du proto handoff `MrhCard`,
// adapté aux vraies photos market_listings + i18n + icônes SgaIcon.

import { useMemo, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import RechIcon from './RechIcon'
import MrhPhoto from './MrhPhoto'
import MrhAgencyLogo from './MrhAgencyLogo'
import { formatCHF } from '@/lib/utils'
import type { MrhBien } from './types'
import type { MrhCtx } from './mrhCtx'

interface Props {
  bien: MrhBien
  score: number | null
  /** texte d'explication déjà résolu (raisons du match, ou motif « proche ») */
  reasonText: string | null
  useMiss?: boolean
  index: number
  ctx: MrhCtx
}

export default function MrhCard({ bien, score, reasonText, useMiss, index, ctx }: Props) {
  const { t } = useTranslation('matching')
  const { sp, surf, dark, ACC, ONACC, line, chipBg, sel, buyer, toggleSel, onOpen, onAskAi, animate } = ctx
  // L'entrée « sgFadeUp » ne se joue qu'au 1er affichage (capture au montage), et
  // seulement sur les premières cartes : le délai plafonne à `index 8`, donc au-delà
  // toutes les suivantes démarreraient leur animation au même instant — à 400 cartes
  // ça fait ~390 animations simultanées pour un effet que personne ne voit, la carte
  // étant hors écran.
  const [doAnim] = useState(() => animate && index < 12)
  const [hov, setHov] = useState(false)
  const photos = useMemo(() => (bien.photos.length ? bien.photos : [null]), [bien.photos])
  const [pi, setPi] = useState(0)
  const goPhoto = (e: ReactMouseEvent, d: number) => { e.stopPropagation(); setPi((i) => (i + d + photos.length) % photos.length) }
  const isRent = bien.transaction === 'location'
  const price = isRent ? bien.rent : bien.price
  // Signal « prix baissé » (trigger ra_price_status) — même seuil anti-bruit ≥2%
  // que le bonus de scoring ; la fiche détail affiche le prix barré + le chip.
  const dropPct = bien.price_original && price && bien.price_original > price
    ? Math.round((1 - price / bien.price_original) * 100)
    : null
  const on = sel.includes(bien.id)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onOpen(bien)}
      style={{
        background: surf.card, borderRadius: 18, overflow: 'hidden', cursor: 'pointer', border: surf.hairline,
        boxShadow: (on ? '0 0 0 2px ' + ACC + ' inset, ' : '') + (hov ? surf.shadowHov : surf.shadow),
        display: 'flex', flexDirection: 'column', transition: 'box-shadow .2s',
        animation: doAnim ? 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' : 'none',
        animationDelay: doAnim ? Math.min(index, 8) * 40 + 'ms' : '0ms',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 10', background: surf.cardSub, flexShrink: 0 }}>
        <MrhPhoto url={photos[pi]} dark={dark} alt={bien.title} fallbackBg={surf.cardSub} fallbackInk={sp.sub} />
        {photos.length > 1 && (
          <>
            <button onClick={(e) => goPhoto(e, -1)} title={t('recherche.card.prevPhoto')} aria-label={t('recherche.card.prevPhoto')}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: 999, border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, background: 'rgba(11,12,14,.55)', opacity: hov ? 1 : 0, transition: 'opacity .18s' }}>
              <RechIcon name="chevronL" size={15} stroke="#fff" />
            </button>
            <button onClick={(e) => goPhoto(e, 1)} title={t('recherche.card.nextPhoto')} aria-label={t('recherche.card.nextPhoto')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: 999, border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, background: 'rgba(11,12,14,.55)', opacity: hov ? 1 : 0, transition: 'opacity .18s' }}>
              <RechIcon name="chevronR" size={15} stroke="#fff" />
            </button>
            <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, alignItems: 'center', opacity: hov ? 1 : 0, transition: 'opacity .18s' }}>
              {photos.map((_, i) => (
                <span key={i} style={{ width: i === pi ? 12 : 5, height: 5, borderRadius: 999, background: i === pi ? '#fff' : 'rgba(255,255,255,.55)', transition: 'width .15s', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
              ))}
            </div>
          </>
        )}
        {score != null && (
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 999, background: dark ? sp.solidBg : '#FFFFFF', color: sp.ink, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', boxShadow: '0 2px 10px rgba(15,23,42,.22)' }}>
            {score}<span style={{ fontSize: 10, fontWeight: 700, color: sp.sub }}>%</span>
          </div>
        )}
      </div>
      <div style={{ padding: '13px 16px 15px', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: sp.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bien.title}</div>
        <div style={{ fontSize: 12.5, color: sp.sub, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bien.addr}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
          <span style={{ minWidth: 0, flex: 1, fontSize: 11.5, color: sp.sub, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bien.postedAt}</span>
          <MrhAgencyLogo name={bien.agency} logoUrl={bien.agency_logo_url} sp={sp} line={line} />
        </div>
        {reasonText && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: sp.sub, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <RechIcon name={useMiss ? 'info' : 'spark'} size={12} stroke={sp.sub} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{reasonText}</span>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 10 }} />
        <div style={{ borderTop: '1px solid ' + line, marginTop: 12, paddingTop: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18.5, fontWeight: 800, color: sp.ink, letterSpacing: -0.6, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {price ? formatCHF(price) : t('recherche.card.estimate')}
              {isRent && price ? <span style={{ fontSize: 11.5, color: sp.sub, fontWeight: 600 }}> {t('recherche.card.perMonth')}</span> : null}
              {dropPct != null && dropPct >= 2 ? (
                <span title={t('recherche.card.priceDrop')} style={{ fontSize: 11.5, fontWeight: 800, color: '#C45A00', marginLeft: 7, letterSpacing: 0 }}>
                  {'−' + dropPct + ' %'}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 11.5, color: sp.sub, fontWeight: 600, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
              {t('recherche.card.roomsArea', { rooms: bien.rooms ?? '—', area: bien.area ?? '—' })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button onClick={(e) => { e.stopPropagation(); onAskAi(bien, score) }}
              title={buyer && score != null ? t('recherche.card.aiMatch') : t('recherche.card.aiAnalyze')} aria-label="MEGGA AI"
              className="mrh-ai-btn"
              style={{ width: 30, height: 30, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0, display: 'grid', placeItems: 'center', padding: 0, background: chipBg, boxShadow: 'inset 0 0 0 1px ' + line }}>
              <RechIcon name="spark" size={13} stroke={sp.soft} />
            </button>
            {buyer && (
              <button onClick={(e) => { e.stopPropagation(); toggleSel(bien.id) }} title={on ? t('recherche.card.remove') : t('recherche.card.add')}
                style={{ width: 30, height: 30, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0, display: 'grid', placeItems: 'center', padding: 0, background: on ? ACC : chipBg, boxShadow: on ? 'none' : 'inset 0 0 0 1px ' + line, transition: 'background .15s' }}>
                <RechIcon name={on ? 'check' : 'plus'} size={13} stroke={on ? ONACC : sp.soft} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
