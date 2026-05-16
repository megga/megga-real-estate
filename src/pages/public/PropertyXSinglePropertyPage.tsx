// MEGGA Marketplace — Property X "Single Property" page (route /propriete/:id).
// Source : Figma node 9552:21451.
//
// Composition (top → bottom) :
//   1. PxNav
//   2. PxSinglePropertyHero — photos du bien
//   3. PxSinglePropertyBody — titre, location, prix, description, amenities
//   4. PxSinglePropertyCTA — bandeau "Demander une visite"
//   5. PxSinglePropertyRelated — biens similaires
//   6. PxFooterPropertyX
//
// Sans `:id` (route demo `/propriete`), les composants utilisent leurs
// données Figma par défaut. Avec un `:id`, on fetch depuis Supabase via
// useListingDetail et on injecte les vraies données dans Hero + Body.

import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PX, PxIcon } from '@/components/propertyx'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxSinglePropertyBreadcrumb from '@/components/propertyx/sections/PxSinglePropertyBreadcrumb'
import PxSinglePropertyHero from '@/components/propertyx/sections/PxSinglePropertyHero'
import PxSinglePropertyBody from '@/components/propertyx/sections/PxSinglePropertyBody'
import PxSinglePropertyEnergy from '@/components/propertyx/sections/PxSinglePropertyEnergy'
import PxSinglePropertyMortgage from '@/components/propertyx/sections/PxSinglePropertyMortgage'
import PxSinglePropertyRelated from '@/components/propertyx/sections/PxSinglePropertyRelated'
import PxSinglePropertyCTA from '@/components/propertyx/sections/PxSinglePropertyCTA'
import PxSinglePropertyMobileBar from '@/components/propertyx/sections/PxSinglePropertyMobileBar'
import PxSinglePropertySeo from '@/components/propertyx/sections/PxSinglePropertySeo'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import { useListingDetail } from '@/hooks/useListingDetail'

// ─── Loading skeleton ──────────────────────────────────────────────────
// Squelette qui reproduit l'ossature de la page (hero grid 1+4, title bar,
// sidebar) en remplaçant le contenu par des blocs gris animés. Évite le
// CLS et donne un signal "ça arrive" plus rassurant qu'un texte centré.

function shimmerStyle(): React.CSSProperties {
  return {
    background: `linear-gradient(90deg, ${PX.neutral200} 0%, ${PX.neutral300} 50%, ${PX.neutral200} 100%)`,
    backgroundSize: '200% 100%',
    animation: 'pxShimmer 1.4s ease-in-out infinite',
    borderRadius: PX.radius.small,
  }
}

function LoadingSkeleton() {
  return (
    <>
      {/* Keyframes for shimmer animation. Inline so we don't depend on global CSS. */}
      <style>{`@keyframes pxShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        background: PX.pageBg,
        paddingTop: 12,
      }}>
        <div style={{
          width: 'min(1200px, calc(100% - 48px))',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 594.7fr) minmax(0, 593.2fr)',
          gap: 12,
        }}>
          <div style={{ aspectRatio: '594.7 / 435.4', ...shimmerStyle() }} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: 12,
          }}>
            <div style={shimmerStyle()} />
            <div style={shimmerStyle()} />
            <div style={shimmerStyle()} />
            <div style={shimmerStyle()} />
          </div>
        </div>
      </div>
      <div style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        background: PX.pageBg,
        paddingTop: 64,
        paddingBottom: 64,
      }}>
        <div style={{
          width: 'min(1200px, calc(100% - 48px))',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 670fr) minmax(0, 412fr)',
          columnGap: 118,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 20, width: 220, ...shimmerStyle() }} />
            <div style={{ height: 56, width: '70%', ...shimmerStyle() }} />
            <div style={{ height: 18, width: '100%', ...shimmerStyle() }} />
            <div style={{ height: 18, width: '95%', ...shimmerStyle() }} />
            <div style={{ height: 18, width: '85%', ...shimmerStyle() }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 140, ...shimmerStyle(), borderRadius: PX.radius.large }} />
            <div style={{ height: 280, ...shimmerStyle(), borderRadius: PX.radius.large }} />
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Error fallback ────────────────────────────────────────────────────
// 404 enrichi : titre + hint + CTA vers /acheter et /louer pour ne pas
// laisser l'utilisateur sur un cul-de-sac.

function NotFoundFallback() {
  const { t } = useTranslation()
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '120px 24px',
    }}>
      <div style={{
        maxWidth: 480,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: PX.neutral200,
          display: 'grid',
          placeItems: 'center',
        }}>
          <PxIcon name="search" size={28} color={PX.neutral500} />
        </div>
        <h1 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 28,
          lineHeight: 1.25,
          letterSpacing: '-0.84px',
          color: PX.neutral700,
        }}>
          {t('marketplaceProperty.notFound')}
        </h1>
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>
          {t('marketplaceProperty.notFoundHint')}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 8 }}>
          <Link
            to="/acheter"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 18,
              paddingRight: 14,
              paddingTop: 10,
              paddingBottom: 10,
              background: PX.neutral700,
              color: PX.neutral100,
              borderRadius: PX.radius.pill,
              textDecoration: 'none',
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 14,
              letterSpacing: '-0.4px',
            }}
          >
            <span style={{ paddingTop: 2 }}>{t('marketplaceProperty.breadcrumb.buy')}</span>
            <PxIcon name="arrow-right" size={14} color={PX.neutral100} />
          </Link>
          <Link
            to="/louer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 18,
              paddingRight: 14,
              paddingTop: 10,
              paddingBottom: 10,
              background: PX.neutral100,
              border: `1px solid ${PX.neutral300}`,
              color: PX.neutral700,
              borderRadius: PX.radius.pill,
              textDecoration: 'none',
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 14,
              letterSpacing: '-0.4px',
            }}
          >
            <span style={{ paddingTop: 2 }}>{t('marketplaceProperty.breadcrumb.rent')}</span>
            <PxIcon name="arrow-right" size={14} color={PX.neutral700} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PropertyXSinglePropertyPage() {
  const { id } = useParams<{ id: string }>()
  const { data: listing, isLoading, isError } = useListingDetail(id)

  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxSinglePropertySeo listing={listing ?? undefined} />
      <PxNav glass />
      {id && isLoading && <LoadingSkeleton />}
      {id && isError && <NotFoundFallback />}
      {(!id || (!isLoading && !isError)) && (
        <>
          <PxSinglePropertyBreadcrumb listing={listing ?? undefined} />
          <PxSinglePropertyHero
            photos={listing?.photos ?? undefined}
            title={listing?.title}
            listingId={listing?.id}
          />
          <PxSinglePropertyBody listing={listing ?? undefined} />
          {listing?.energy_label ? (
            <PxSinglePropertyEnergy listing={listing} />
          ) : null}
          {listing?.context === 'buy' ? (
            <PxSinglePropertyMortgage listing={listing} />
          ) : null}
          <PxSinglePropertyCTA />
          <PxSinglePropertyRelated currentListing={listing ?? undefined} />
        </>
      )}
      <PxFooterPropertyX />
      <PxSinglePropertyMobileBar listing={listing ?? undefined} />
    </div>
  )
}
