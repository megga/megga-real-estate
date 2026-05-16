// MEGGA Marketplace — Property X "Single Property — Breadcrumb" section.
//
// Anatomie : container 1200 centré, padding y 16-24, fil d'Ariane sémantique
// (<nav aria-label="breadcrumb"><ol>) avec liens cliquables vers les niveaux
// parents et le bien courant en dernier (non-cliquable, aria-current).
//
// Hiérarchie : Accueil → Acheter/Louer → Canton → Ville → Titre
// Le canton et la ville sont rendus en texte (pas de page dédiée à ce stade) ;
// seuls "Accueil" et "Acheter"/"Louer" sont des liens.

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PX, PxIcon } from '..'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface Props {
  listing?: ListingCardData
}

const CANTONS: Record<string, string> = {
  GE: 'Genève', VD: 'Vaud', VS: 'Valais', NE: 'Neuchâtel', FR: 'Fribourg',
  BE: 'Berne', JU: 'Jura', BS: 'Bâle-Ville', BL: 'Bâle-Campagne',
  AG: 'Argovie', SO: 'Soleure', ZH: 'Zurich', LU: 'Lucerne', ZG: 'Zoug',
  SZ: 'Schwytz', NW: 'Nidwald', OW: 'Obwald', UR: 'Uri', GL: 'Glaris',
  SH: 'Schaffhouse', TG: 'Thurgovie', AR: 'Appenzell Rh.-Ext.',
  AI: 'Appenzell Rh.-Int.', SG: 'Saint-Gall', GR: 'Grisons', TI: 'Tessin',
}

export default function PxSinglePropertyBreadcrumb({ listing }: Props) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  if (!listing) return null

  const isRent = listing.context === 'rent'
  const segmentLabel = isRent ? t('marketplaceProperty.breadcrumb.rent') : t('marketplaceProperty.breadcrumb.buy')
  const segmentHref = isRent ? '/louer' : '/acheter'
  const cantonLabel = listing.canton ? CANTONS[listing.canton] ?? listing.canton : null

  const items: Array<{ label: string; href?: string }> = [
    { label: t('marketplaceProperty.breadcrumb.home'), href: '/' },
    { label: segmentLabel, href: segmentHref },
  ]
  if (cantonLabel) items.push({ label: cantonLabel })
  if (listing.city) items.push({ label: listing.city })

  // Sur mobile on tronque : seulement les 2 derniers niveaux + home
  const visible = isMobile && items.length > 3
    ? [items[0], { label: '…' }, items[items.length - 1]]
    : items

  return (
    <nav
      aria-label="breadcrumb"
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        background: PX.pageBg,
      }}
    >
      <ol style={{
        width: isMobile ? 'calc(100% - 32px)' : 'min(1200px, calc(100% - 48px))',
        margin: 0,
        padding: isMobile ? '12px 0' : '20px 0',
        listStyle: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 13,
        lineHeight: 1.4,
        letterSpacing: '-0.3px',
        color: PX.neutral400,
      }}>
        {visible.map((item, idx) => {
          const isLast = idx === visible.length - 1
          return (
            <li key={`${item.label}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  style={{
                    color: PX.neutral500,
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} style={{ color: isLast ? PX.neutral700 : PX.neutral400 }}>
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <PxIcon name="chevron-right" size={12} color={PX.neutral400} />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
