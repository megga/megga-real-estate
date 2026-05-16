// MEGGA Marketplace — Property X "Single Property — Mobile Bottom Bar"
//
// Bar fixe en bas d'écran sur mobile uniquement. Affiche le prix à gauche
// et un bouton "Contacter" qui scrolle vers le formulaire de contact dans
// la sidebar (qui passe en bas de page sur mobile). Disparaît si le
// formulaire de contact est déjà visible à l'écran (évite le doublon).
//
// Pattern observé sur Immoscout/Homegate : mobile-only, sticky, prix +
// CTA primary. Améliore le taux de conversion mobile en gardant le
// pricing visible et le CTA accessible sans scroller.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PX, PxFigmaIcon } from '..'
import { formatCHF, formatRent } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface Props {
  listing?: ListingCardData
}

export default function PxSinglePropertyMobileBar({ listing }: Props) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [hidden, setHidden] = useState(false)

  // Cache la bar quand l'utilisateur a déjà scrollé jusqu'au formulaire
  // (l'élément avec id="contact-form"). IntersectionObserver est cheap.
  useEffect(() => {
    if (!isMobile) return
    const target = document.getElementById('contact-form')
    if (!target) return
    const obs = new IntersectionObserver(
      ([entry]) => setHidden(entry.isIntersecting),
      { threshold: 0.2 },
    )
    obs.observe(target)
    return () => obs.disconnect()
  }, [isMobile])

  if (!isMobile || !listing) return null

  const isRent = listing.context === 'rent'
  const priceLabel = isRent ? formatRent(listing.price) : formatCHF(listing.price)
  const sublabel = isRent
    ? t('marketplaceProperty.pricing.sublabelRent')
    : t('marketplaceProperty.pricing.sublabelSale')

  const handleContactClick = () => {
    const el = document.getElementById('contact-form')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
        background: PX.neutral100,
        borderTop: `1px solid ${PX.neutral300}`,
        boxShadow: '0 -8px 24px rgba(20, 22, 28, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transform: hidden ? 'translateY(110%)' : 'translateY(0)',
        transition: 'transform 0.22s ease',
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 18,
          lineHeight: 1.25,
          letterSpacing: '-0.54px',
          color: PX.neutral700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {priceLabel}
        </span>
        <span style={{
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 12,
          lineHeight: 1.3,
          letterSpacing: '-0.3px',
          color: PX.neutral400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {sublabel}
        </span>
      </div>
      <button
        type="button"
        onClick={handleContactClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 18,
          paddingRight: 12,
          paddingTop: 12,
          paddingBottom: 12,
          background: PX.neutral700,
          color: PX.neutral100,
          border: 0,
          borderRadius: PX.radius.pill,
          cursor: 'pointer',
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 15,
          lineHeight: 1.25,
          letterSpacing: '-0.45px',
          flexShrink: 0,
        }}
      >
        <span style={{ paddingTop: 1 }}>{t('marketplaceProperty.mobileBar.contact')}</span>
        <span style={{
          width: 26,
          height: 26,
          borderRadius: PX.radius.pill,
          background: PX.neutral100,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <PxFigmaIcon name="arrow-right" size={12} color={PX.neutral700} />
        </span>
      </button>
    </div>
  )
}
