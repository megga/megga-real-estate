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
import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxSinglePropertyHero from '@/components/propertyx/sections/PxSinglePropertyHero'
import PxSinglePropertyBody from '@/components/propertyx/sections/PxSinglePropertyBody'
import PxSinglePropertyRelated from '@/components/propertyx/sections/PxSinglePropertyRelated'
import PxSinglePropertyCTA from '@/components/propertyx/sections/PxSinglePropertyCTA'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import { useListingDetail } from '@/hooks/useListingDetail'

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
  const { data: listing, isLoading, isError } = useListingDetail(id)

  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav glass />
      {id && isLoading && <StatusScreen message="Chargement du bien…" />}
      {id && isError && <StatusScreen message="Bien introuvable." />}
      {(!id || (!isLoading && !isError)) && (
        <>
          <PxSinglePropertyHero
            photos={listing?.photos ?? undefined}
            title={listing?.title}
          />
          <PxSinglePropertyBody listing={listing ?? undefined} />
          <PxSinglePropertyCTA />
          <PxSinglePropertyRelated currentListing={listing ?? undefined} />
        </>
      )}
      <PxFooterPropertyX />
    </div>
  )
}
