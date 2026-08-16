// Matching · Recherche — marque de la régie sur une carte de résultat.
// Vrai logo depuis `market_listings.agency_logo_url` (sync Flatfox / RealAdvisor),
// repli sur le NOM quand la colonne est vide ou que l'image ne charge pas.
//
// Choix non évidents :
//  · Sur une CARTE, la marque est le logo SEUL quand la base en a un, et le nom en
//    toutes lettres sinon. Jamais les deux : la plaque et le nom disent la même
//    chose, et les empiler mange la largeur d'une rangée qui porte déjà la date.
//  · ⛔ LE REPLI N'EST PAS UN CAS DE BORD, et c'est ce qui interdit de retirer le
//    nom. Mesuré le 13.08.2026 APRÈS la reprise de `agency_profiles` : 61,2 % des
//    76 648 annonces actives ont un logo (contre 47,9 % avant). Des 29 730 qui
//    n'en ont pas, 17 496 portent un NOM — presque toutes chez RealAdvisor. Les
//    laisser sans marque effacerait « qui commercialise ce bien » de 23 % du
//    marché actif. Les 11 185 restantes (Flatfox pour l'essentiel) n'ont ni logo
//    ni nom : il n'y a rien à afficher, le composant rend `null`.
//  · Le logo est résolu à DEUX niveaux : la colonne de l'annonce d'abord, puis
//    l'embed `agency_profile` (cf. `CARD_COLS`) — c'est ce second niveau qu'a
//    rempli la reprise des agences, et il arrive jusqu'ici sans code nouveau.
//  · `no-referrer` : l'URL pointe un CDN tiers, on ne lui envoie pas l'URL de l'app.
//  · `loading="lazy"` OBLIGATOIRE, comme MrhPhoto : la grille de résultats monte
//    jusqu'à 400 cartes sans virtualisation, dont ~145 portent un logo (76 URL
//    distinctes sur 2 CDN). En eager, autant de requêtes cross-origin partent au
//    montage pour des cartes situées des dizaines d'écrans plus bas.
//  · L'échec est mémorisé PAR URL (et non par un booléen) — sinon une carte
//    recyclée sur une autre annonce resterait bloquée sur le repli.

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { CrmPalette } from '@/components/crm/tokens'

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
  sp: CrmPalette
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
  /**
   * Le NOM écrit, gabarit `fiche` — rendu uniquement dans la branche de repli.
   *
   * ⛔ C'est le composant qui doit décider de l'afficher, pas l'appelant : lui
   * seul sait si l'image a ÉCHOUÉ. Un appelant qui masquerait le nom sur la
   * simple présence d'une URL laisserait un bloc « Régie » entièrement vide le
   * jour où le CDN ne répond pas.
   */
  nom?: ReactNode
}

export default function MrhAgencyLogo({ name, logoUrl, sp, line, gabarit = 'carte', monogramme, nom }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const label = name?.trim()
  if (!label) return gabarit === 'fiche' ? <>{monogramme}{nom}</> : null

  // ⚠ Le gabarit `fiche` est CARRÉ (40 px) : il prend la place exacte du
  // monogramme, sinon la ligne d'à côté — nom + portail + date — se décalerait
  // selon que la régie a un logo ou non.
  // ⛔ UNE SEULE TAILLE DE PLAQUE POUR LES DEUX EMPLACEMENTS. La fiche et la carte
  // en portaient deux (image 44 contre 56, plaque à hauteur mini contre hauteur
  // fixe) : deux nombres pour une seule intention, donc deux nombres qui
  // dérivent. Ils sont fondus ici. Ce que le `gabarit` distingue encore est REEL
  // — le REPLI, pas la taille : une carte retombe sur le nom en toutes lettres,
  // la fiche sur le monogramme ET le nom.
  //
  // ⚠ La plaque ÉPOUSE le logo (`inline-grid`, largeur au contenu). Elle a barré
  // la carte sur toute sa largeur le temps d'un essai : en sombre, la bande
  // blanche pesait alors autant que la photo du bien.
  const plaque = logoUrl && failedUrl !== logoUrl
    ? (
      <span style={{
        display: 'inline-grid', placeItems: 'center', flexShrink: 0,
        height: 72, maxWidth: '100%', borderRadius: 12, padding: '0 14px',
        background: LOGO_PLATE_BG,
        boxShadow: 'inset 0 0 0 1px ' + line,
      }}>
        <img
          src={logoUrl}
          alt={label}
          title={label}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(logoUrl)}
          style={{ height: 56, maxWidth: 200, objectFit: 'contain', display: 'block' }}
        />
      </span>
    )
    : null

  // Sur la FICHE, la marque parle seule quand elle existe. Sinon le monogramme
  // ET le nom reviennent ensemble — c'est le composant qui en décide, parce que
  // lui seul sait si l'image a échoué.
  if (gabarit === 'fiche') return plaque ?? <>{monogramme}{nom}</>

  // Sur une CARTE : le logo SEUL s'il existe, le nom sinon.
  if (plaque) return plaque

  // ⚠ 120 px de plafond. Des régies portent 86 à 95 caractères — des agences
  // générales d'assurance — et sans borne le nom mangerait la date de
  // publication, qui partage la rangée.
  return (
    <span title={label} style={{ flexShrink: 0, maxWidth: 120, fontSize: 'var(--crm-text-xs)', color: sp.sub, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {label}
    </span>
  )
}
