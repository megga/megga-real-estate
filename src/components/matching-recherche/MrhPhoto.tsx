// Matching · Recherche — photo d'annonce (vraies URLs market_listings).
// Le proto synthétisait des vignettes (GalPhoto) ; en LIVE on rend la vraie photo
// (R2 `photos_cf` prioritaire, sinon portail `photos`). `referrerPolicy=no-referrer`
// contre l'anti-hotlink Flatfox. Repli propre si absente / cassée.

import { useState } from 'react'
import RechIcon from './RechIcon'

interface Props {
  url?: string | null
  dark: boolean
  alt?: string
  /** couleur du repli (sub) */
  fallbackBg: string
  fallbackInk: string
}

export default function MrhPhoto({ url, dark, alt = '', fallbackBg, fallbackInk }: Props) {
  const [broken, setBroken] = useState(false)
  if (!url || broken) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: fallbackBg, display: 'grid', placeItems: 'center' }}>
        <RechIcon name="home" size={22} stroke={fallbackInk} />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setBroken(true)}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', display: 'block',
        background: dark ? '#12151B' : '#E7ECF2',
      }}
    />
  )
}
