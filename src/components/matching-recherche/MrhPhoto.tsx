// Matching · Recherche — photo d'annonce (vraies URLs market_listings).
// Le proto synthétisait des vignettes (GalPhoto) ; en LIVE on rend la vraie photo
// (R2 `photos_cf` prioritaire, sinon portail `photos`). `referrerPolicy=no-referrer`
// contre l'anti-hotlink Flatfox. Repli propre si absente / cassée.

import { useState } from 'react'
import RechIcon from './RechIcon'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

interface Props {
  url?: string | null
  dark: boolean
  alt?: string
  /** couleur du repli (sub) */
  fallbackBg: string
  fallbackInk: string
}

export default function MrhPhoto({ url, dark, alt = '', fallbackBg, fallbackInk }: Props) {
  // L'échec est mémorisé PAR URL, pas en booléen : la même instance rend les
  // photos successives d'un carrousel (carte de résultat, aperçu carte, lightbox).
  // Avec un simple `broken`, une seule photo cassée condamnait toutes les
  // suivantes au repli — sans jamais retenter, puisque rien ne remet l'état à zéro.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  const broken = !!url && brokenUrl === url
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
      onError={() => setBrokenUrl(url)}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', display: 'block',
        background: dark ? MXC_COLOR.n400 : '#E7ECF2',
      }}
    />
  )
}
