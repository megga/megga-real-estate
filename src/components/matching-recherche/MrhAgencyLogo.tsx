// Matching · Recherche — pastille « régie » d'une annonce du marché.
// Vrai logo depuis `market_listings.agency_logo_url` (sync Flatfox / RealAdvisor),
// repli monogramme quand la colonne est vide (~52 % des annonces actives) ou que
// l'image ne charge pas.
//
// Choix non évidents :
//  · Plaque de fond BLANCHE assumée, thème sombre compris : un logo de régie est
//    dessiné pour du blanc et disparaîtrait sur fond noir. Même exception que la
//    couverture de MatchingFirstRun — ne pas « corriger » vers les tokens.
//  · `no-referrer` : l'URL pointe un CDN tiers, on ne lui envoie pas l'URL de l'app.
//  · `loading="lazy"` OBLIGATOIRE, comme MrhPhoto : la grille de résultats monte
//    jusqu'à 400 cartes sans virtualisation, dont ~145 portent un logo (76 URL
//    distinctes sur 2 CDN). En eager, autant de requêtes cross-origin partent au
//    montage pour des cartes situées des dizaines d'écrans plus bas.
//  · L'échec est mémorisé PAR URL (et non par un booléen) — sinon une carte
//    recyclée sur une autre annonce resterait bloquée sur le monogramme.

import { useState } from 'react'
import type { SugarPalette } from '@/components/crm-sugar/tokens'

interface Props {
  name: string | null
  logoUrl: string | null
  sp: SugarPalette
  chipBg: string
  line: string
}

/** Initiales de la régie — « Régie du Rhône SA (Genève) » → « RD ». */
function monogram(name: string): string {
  return name
    .replace(/\(.*$/, '')
    .split(/[\s&—-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function MrhAgencyLogo({ name, logoUrl, sp, chipBg, line }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!name) return null

  if (logoUrl && failedUrl !== logoUrl) {
    return (
      <span style={{ flexShrink: 0, height: 22, display: 'grid', placeItems: 'center', background: '#FFFFFF', borderRadius: 6, padding: '0 5px', boxShadow: 'inset 0 0 0 1px ' + line }}>
        <img
          src={logoUrl}
          alt={name}
          title={name}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(logoUrl)}
          style={{ height: 15, maxWidth: 74, objectFit: 'contain', display: 'block' }}
        />
      </span>
    )
  }

  return (
    <span title={name} style={{ flexShrink: 0, height: 22, minWidth: 22, padding: '0 6px', borderRadius: 6, background: chipBg, color: sp.soft, fontSize: 10, fontWeight: 800, letterSpacing: 0.3, display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px ' + line }}>
      {monogram(name)}
    </span>
  )
}
