/** Route `/portal` (dev, sans token) : rend le portail vendeur sur données mock. */
import { SellerPortalProvider } from '@/hooks/useSellerPortalContext'
import { MOCK_SELLER_DATA } from '@/lib/mockSellerData'
import VotreVentePage from './VotreVentePage'

/**
 * Dev-only wrapper for the /portal route (no token).
 *
 * The production route /portal/:token uses PortalGateway, which fetches
 * real seller data and wraps the page in a SellerPortalProvider. This
 * wrapper injects MOCK_SELLER_DATA so dev/test navigation works without a
 * valid token.
 */
export default function PortalDevWrapper() {
  return (
    <SellerPortalProvider data={MOCK_SELLER_DATA}>
      <VotreVentePage />
    </SellerPortalProvider>
  )
}
