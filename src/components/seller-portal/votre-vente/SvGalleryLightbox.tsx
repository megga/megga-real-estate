// MEGGA — Espace vendeur — lightbox galerie photos.
// Reçoit les photos réelles du bien (plus de scraping DOM façon maquette).
// Overlay fixed, compteur i/N, flèches, miniatures, navigation clavier (Esc/←/→).
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { SvIcon } from './icons'

interface Props {
  title: string
  photos: string[]
  onClose: () => void
}

export default function SvGalleryLightbox({ title, photos, onClose }: Props) {
  const { t } = useTranslation('common')
  const [idx, setIdx] = useState(0)
  const n = photos.length
  const go = useCallback((d: number) => setIdx((i) => (i + d + n) % Math.max(1, n)), [n])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [go, onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(8,9,12,0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'sgFadeUp .25s ease both',
      }}
    >
      {/* Barre haute */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          flexShrink: 0,
        }}
      >
        <div style={{ color: 'rgba(255,255,255,0.95)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>{title}</div>
          {n > 0 && (
            <div
              className="sg-tnum"
              style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}
            >
              {idx + 1} / {n}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label={t('portal.gallery.close')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: 0,
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <SvIcon name="x" size={20} stroke="#fff" sw={1.8} />
        </button>
      </div>

      {/* Scène */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '0 24px',
        }}
      >
        {n === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
            <div
              style={{
                width: 56,
                height: 56,
                margin: '0 auto 16px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.1)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SvIcon name="grid" size={24} stroke="rgba(255,255,255,0.7)" sw={1.6} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{t('portal.gallery.emptyTitle')}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
              {t('portal.gallery.emptyHint')}
            </div>
          </div>
        ) : (
          <>
            {n > 1 && (
              <button
                onClick={() => go(-1)}
                aria-label={t('portal.gallery.previous')}
                style={arrowBtn('left')}
              >
                <SvIcon name="chevronLeft" size={22} stroke="#fff" sw={1.8} />
              </button>
            )}
            <img
              src={photos[idx]}
              alt={t('portal.gallery.photoAlt', { index: idx + 1 })}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 16,
                boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
              }}
            />
            {n > 1 && (
              <button
                onClick={() => go(1)}
                aria-label={t('portal.gallery.next')}
                style={arrowBtn('right')}
              >
                <SvIcon name="chevronRight" size={22} stroke="#fff" sw={1.8} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Miniatures */}
      {n > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            flexWrap: 'wrap',
            padding: '20px 24px 28px',
            flexShrink: 0,
          }}
        >
          {photos.map((src, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: 72,
                height: 54,
                borderRadius: 10,
                border: 0,
                cursor: 'pointer',
                padding: 0,
                overflow: 'hidden',
                opacity: i === idx ? 1 : 0.5,
                outline: i === idx ? '2px solid #fff' : 'none',
                outlineOffset: 2,
                transition: 'opacity .15s ease',
              }}
            >
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}

function arrowBtn(side: 'left' | 'right'): CSSProperties {
  return {
    position: 'absolute',
    [side]: 20,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 48,
    height: 48,
    borderRadius: 999,
    border: 0,
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
  }
}
