// Atelier Matching — galerie photo, concept « lightbox » (seul retenu en
// prod, handoff §6.7). Plein écran, navigation ←/→, fermeture Esc, filmstrip.

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SgaIcon from './SgaIcon'
import type { AtelierGalleryPhoto, AtelierListing } from './types'

function SgaGalPhoto({ p, className, big, idx, total }: {
  p: AtelierGalleryPhoto | undefined
  className?: string
  big?: boolean
  idx?: number
  total?: number
}) {
  const { t } = useTranslation('matching')
  if (p?.url) {
    return (
      <div className={'sgal-img-wrap' + (className ? ` ${className}` : '')}>
        <img className="sgal-img" src={p.url} alt={p.label} loading="lazy" draggable="false" />
        {idx != null && !big && (
          <div className="sgal-img-cap"><em className="nums">{String(idx + 1).padStart(2, '0')}</em></div>
        )}
      </div>
    )
  }
  return (
    <div className={'sgal-ph' + (className ? ` ${className}` : '')}>
      <div className="sgal-ph-grain" />
      <div className="sgal-ph-lbl">
        <SgaIcon d="camera" size={big ? 30 : 17} sw={1.5} />
        <span>{p?.label ?? t('atelier.photo')}</span>
        {idx != null && total != null && (
          <em className="nums">{String(idx + 1).padStart(2, '0')} / {total}</em>
        )}
      </div>
    </div>
  )
}

interface SgaGalleryProps {
  L: AtelierListing
  openIndex: number
  onClose: () => void
}

export default function SgaGallery({ L, openIndex, onClose }: SgaGalleryProps) {
  const { t } = useTranslation('matching')
  const photos = L.gallery
  const count = Math.max(photos.length, 1)
  const [index, setIndex] = useState(Math.min(Math.max(openIndex, 0), count - 1))

  const prev = useCallback(() => setIndex(i => (i - 1 + count) % count), [count])
  const next = useCallback(() => setIndex(i => (i + 1) % count), [count])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); prev() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); next() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, prev, next])

  const cur = photos[index]

  return (
    <div className="sgal sgal-lightbox" role="dialog" aria-label={t('atelier.photoGallery')}>
      <div className="sgal-lb-top">
        <div className="sgal-lb-meta">
          <span className="eyebrow">{cur?.room ?? t('atelier.photos')}</span>
          <span className="sgal-lb-title">{cur?.label ?? L.title}</span>
        </div>
        <span className="sgal-counter nums">{index + 1} / {count}</span>
        <button className="sgal-circle" title={t('atelier.closeEsc')} onClick={onClose}>
          <SgaIcon d="close" size={18} />
        </button>
      </div>
      <div className="sgal-lb-stage">
        <button className="sgal-nav prev" onClick={prev} aria-label={t('atelier.previous')}>
          <SgaIcon d="chevron-left" size={24} />
        </button>
        <SgaGalPhoto p={cur} className="sgal-lb-photo" big idx={index} total={count} key={index} />
        <button className="sgal-nav next" onClick={next} aria-label={t('atelier.next')}>
          <SgaIcon d="chevron-right" size={24} />
        </button>
      </div>
      <div className="sgal-filmstrip">
        {photos.map((p, i) => (
          <button key={i} className="sgal-film" data-sel={i === index} onClick={() => setIndex(i)}>
            <SgaGalPhoto p={p} />
          </button>
        ))}
      </div>
    </div>
  )
}
