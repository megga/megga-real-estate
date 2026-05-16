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

import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import { lazy, Suspense } from 'react'
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

// Mapbox embarque ~250KB — lazy-loadé pour ne pas alourdir le bundle initial
// quand le bien n'a pas de coordonnées (cas fréquent sur les imports Flatfox).
const PxSinglePropertyMap = lazy(() => import('@/components/propertyx/sections/PxSinglePropertyMap'))

function StatusScreen({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '120px 24px',
      fontFamily: PX.font.sans,
      fontSize: 18,
      color: PX.neutral400,
    }}>
      {message}
    </div>
  )
}

export default function PropertyXSinglePropertyPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
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
      {id && isLoading && <StatusScreen message={t('marketplaceProperty.loading')} />}
      {id && isError && <StatusScreen message={t('marketplaceProperty.notFound')} />}
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
          {listing?.lat && listing?.lng ? (
            <Suspense fallback={null}>
              <PxSinglePropertyMap listing={listing} />
            </Suspense>
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
