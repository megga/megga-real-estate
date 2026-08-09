// Matching · Recherche — lightbox photo (fiche annonce). Portée dans document.body.
// Vraies photos market_listings. Clavier : Échap ferme, ←/→ navigue.

import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import RechIcon from './RechIcon'
import MrhPhoto from './MrhPhoto'

const NAV: CSSProperties = { width: 48, height: 48, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0, display: 'grid', placeItems: 'center', padding: 0, background: 'rgba(255,255,255,.12)' }

interface Props {
  photos: string[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}

export default function MrhLightbox({ photos, index, onIndex, onClose }: Props) {
  const { t } = useTranslation('matching')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); onIndex((index + 1) % photos.length) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); onIndex((index - 1 + photos.length) % photos.length) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, photos.length, onIndex, onClose])
  const go = (d: number) => onIndex((index + d + photos.length) % photos.length)

  const overlay = (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(6,7,9,.94)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif', animation: 'sgFadeUp .22s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'rgba(255,255,255,.9)', fontVariantNumeric: 'tabular-nums' }}>{t('recherche.detail.lbCounter', { index: index + 1, total: photos.length })}</span>
        <button onClick={onClose} title={t('recherche.detail.close')} style={{ ...NAV, width: 40, height: 40 }}><RechIcon name="close" size={17} stroke="#fff" /></button>
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 18px' }}>
        <button onClick={() => go(-1)} title={t('recherche.detail.prev')} style={NAV}><RechIcon name="chevronL" size={22} stroke="#fff" /></button>
        <div style={{ position: 'relative', flex: 1, maxWidth: 1160, height: '100%', maxHeight: '76vh', borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
          <MrhPhoto url={photos[index]} dark alt="" fallbackBg="#101019" fallbackInk="rgba(255,255,255,.5)" />
        </div>
        <button onClick={() => go(1)} title={t('recherche.detail.next')} style={NAV}><RechIcon name="chevronR" size={22} stroke="#fff" /></button>
      </div>
      <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0, display: 'flex', gap: 8, justifyContent: 'center', padding: '16px 18px 22px', overflowX: 'auto' }}>
        {photos.map((p, i) => (
          <button key={p + i} onClick={() => onIndex(i)} style={{ position: 'relative', width: 76, height: 52, borderRadius: 8, overflow: 'hidden', border: 0, cursor: 'pointer', padding: 0, flexShrink: 0, boxShadow: i === index ? '0 0 0 2px #fff' : '0 0 0 1px rgba(255,255,255,.18)', opacity: i === index ? 1 : 0.55, transition: 'opacity .15s' }}>
            <MrhPhoto url={p} dark alt="" fallbackBg="#101019" fallbackInk="rgba(255,255,255,.4)" />
          </button>
        ))}
      </div>
    </div>
  )
  return createPortal(overlay, document.body)
}
