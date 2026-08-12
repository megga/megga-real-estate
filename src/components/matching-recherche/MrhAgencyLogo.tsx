// Matching · Recherche — marque de la régie sur une carte de résultat.
// Vrai logo depuis `market_listings.agency_logo_url` (sync Flatfox / RealAdvisor),
// repli sur le NOM quand la colonne est vide ou que l'image ne charge pas.
//
// Choix non évidents :
//  · Repli = le nom en toutes lettres, PAS un monogramme. La maquette prévoit un
//    monogramme, mais elle a été dessinée sur un jeu de démo où chaque annonce
//    avait un logo : en production 41 061 annonces actives sur 78 354 n'en ont
//    pas, et « RD » sur une pastille de 22 px ferait disparaître l'information
//    « qui commercialise ce bien » de la majorité de la grille.
//  · `no-referrer` : l'URL pointe un CDN tiers, on ne lui envoie pas l'URL de l'app.
//  · `loading="lazy"` OBLIGATOIRE, comme MrhPhoto : la grille de résultats monte
//    jusqu'à 400 cartes sans virtualisation, dont ~145 portent un logo (76 URL
//    distinctes sur 2 CDN). En eager, autant de requêtes cross-origin partent au
//    montage pour des cartes situées des dizaines d'écrans plus bas.
//  · L'échec est mémorisé PAR URL (et non par un booléen) — sinon une carte
//    recyclée sur une autre annonce resterait bloquée sur le repli.

import { useState } from 'react'
import type { SugarPalette } from '@/components/crm-sugar/tokens'

/**
 * EXCEPTION ASSUMÉE à CLAUDE.md §5 (« Couleurs hardcodées → tokens thème »).
 * Un logo de régie est dessiné pour un fond blanc : le poser sur une surface
 * sombre le rendrait illisible ou invisible. La plaque reste donc blanche dans
 * les deux thèmes, comme la couverture mono-thème de MatchingFirstRun. Toute
 * autre couleur de ce fichier passe par les tokens.
 */
const LOGO_PLATE_BG = '#FFFFFF'

interface Props {
  name: string | null
  logoUrl: string | null
  sp: SugarPalette
  line: string
}

export default function MrhAgencyLogo({ name, logoUrl, sp, line }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const label = name?.trim()
  if (!label) return null

  if (logoUrl && failedUrl !== logoUrl) {
    return (
      <span style={{ flexShrink: 0, height: 22, display: 'grid', placeItems: 'center', background: LOGO_PLATE_BG, borderRadius: 6, padding: '0 5px', boxShadow: 'inset 0 0 0 1px ' + line }}>
        <img
          src={logoUrl}
          alt={label}
          title={label}
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
    <span title={label} style={{ flexShrink: 0, maxWidth: 120, fontSize: 'var(--crm-text-xs)', color: sp.sub, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {label}
    </span>
  )
}
