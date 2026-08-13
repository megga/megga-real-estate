// Matching · Recherche — marque de la régie sur une carte de résultat.
// Vrai logo depuis `market_listings.agency_logo_url` (sync Flatfox / RealAdvisor),
// repli sur le NOM quand la colonne est vide ou que l'image ne charge pas.
//
// Choix non évidents :
//  · Le nom est TOUJOURS écrit ; le logo est une plaque qui le PRÉCÈDE quand la
//    base en a un. La maquette prévoyait un monogramme seul, mais elle a été
//    dessinée sur un jeu de démo où chaque annonce avait un logo : mesuré le
//    13.08.2026, 40 452 annonces actives sur 77 632 n'en ont pas (68,0 % de
//    couverture côté Flatfox, 31,3 % côté RealAdvisor). Un logo SEUL ferait donc
//    disparaître « qui commercialise ce bien » de la majorité de la grille, et un
//    monogramme seul le rendrait indéchiffrable.
//  · C'est le NOM qui cède à l'ellipse, jamais la plaque : une marque à moitié
//    rognée ne se reconnaît plus, un nom tronqué se lit encore.
//  · `no-referrer` : l'URL pointe un CDN tiers, on ne lui envoie pas l'URL de l'app.
//  · `loading="lazy"` OBLIGATOIRE, comme MrhPhoto : la grille de résultats monte
//    jusqu'à 400 cartes sans virtualisation, dont ~145 portent un logo (76 URL
//    distinctes sur 2 CDN). En eager, autant de requêtes cross-origin partent au
//    montage pour des cartes situées des dizaines d'écrans plus bas.
//  · L'échec est mémorisé PAR URL (et non par un booléen) — sinon une carte
//    recyclée sur une autre annonce resterait bloquée sur le repli.

import { useState } from 'react'
import type { ReactNode } from 'react'
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
  /**
   * Où la marque est posée — les deux emplacements n'ont ni le même gabarit ni
   * le même repli.
   *
   * `carte` (défaut) : pied d'une carte de résultat. Plaque en bandeau, et le
   * repli est le NOM en toutes lettres, parce que rien d'autre ne le porte.
   *
   * `fiche` : bloc « Régie » de la fiche annonce. Plaque CARRÉE, alignée sur le
   * monogramme qu'elle remplace, et le repli est ce monogramme — le nom est déjà
   * écrit juste à côté, le répéter ne dirait rien de plus.
   */
  gabarit?: 'carte' | 'fiche'
  /**
   * Repli du gabarit `fiche`. Fourni par l'appelant parce que la pastille porte
   * l'ACCENT, et que l'accent appartient à l'écran, pas à ce composant.
   */
  monogramme?: ReactNode
}

export default function MrhAgencyLogo({ name, logoUrl, sp, line, gabarit = 'carte', monogramme }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const label = name?.trim()
  if (!label) return gabarit === 'fiche' ? <>{monogramme}</> : null

  // ⚠ Le gabarit `fiche` est CARRÉ (40 px) : il prend la place exacte du
  // monogramme, sinon la ligne d'à côté — nom + portail + date — se décalerait
  // selon que la régie a un logo ou non.
  const carre = gabarit === 'fiche'
  const plaque = logoUrl && failedUrl !== logoUrl
    ? (
      <span style={{
        flexShrink: 0,
        ...(carre
          ? { width: 40, height: 40, borderRadius: 12, padding: 4 }
          : { height: 22, borderRadius: 6, padding: '0 5px' }),
        display: 'grid', placeItems: 'center',
        background: LOGO_PLATE_BG,
        boxShadow: 'inset 0 0 0 1px ' + line,
      }}>
        <img
          src={logoUrl}
          alt={carre ? label : ''}
          title={label}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(logoUrl)}
          style={carre
            ? { maxHeight: 32, maxWidth: 32, objectFit: 'contain', display: 'block' }
            : { height: 15, maxWidth: 74, objectFit: 'contain', display: 'block' }}
        />
      </span>
    )
    : null

  // Sur la FICHE, le nom est déjà écrit à côté : la plaque le remplace, et à
  // défaut c'est le monogramme fourni par l'appelant.
  if (carre) return plaque ?? <>{monogramme}</>

  // Sur une CARTE, la plaque PRÉCÈDE le nom au lieu de s'y substituer. ⚠ `alt`
  // est vide sur cette variante : le nom qui suit porte déjà l'information, et un
  // `alt` la ferait annoncer deux fois.
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {plaque}
      {/* ⚠ 120 px de plafond, conservés de la version « nom seul ». Des régies
          portent 86 à 95 caractères (des agences générales d'assurance, qui ont
          un logo) : sans borne, le nom mangerait la date de publication. */}
      <span title={label} style={{ minWidth: 0, maxWidth: 120, fontSize: 'var(--crm-text-xs)', color: sp.sub, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
    </span>
  )
}
