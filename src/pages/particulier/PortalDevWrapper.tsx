import { SellerPortalProvider } from '@/hooks/useSellerPortalContext'
import { MOCK_SELLER_DATA } from '@/lib/mockSellerData'
import SellerLayout from './SellerLayout'

/**
 * Dev-only wrapper for the /portail route (no token).
 *
 * The production route /portail/:token uses PortalGateway, which fetches
 * real seller data and wraps SellerLayout in a SellerPortalProvider.
 *
 * Without this wrapper, hitting /portail directly crashed all 7 child pages
 * with "useSellerPortalData must be used inside SellerPortalProvider"
 * (audit bug A2). This wrapper injects MOCK_SELLER_DATA so dev/test
 * navigation works end-to-end without needing a valid token.
 */
export default function PortalDevWrapper() {
  return (
    <SellerPortalProvider data={MOCK_SELLER_DATA}>
      <SellerLayout />
    </SellerPortalProvider>
  )
}
