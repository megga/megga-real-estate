import { useParams } from 'react-router-dom'
import { useSellerPortalAccess } from '@/hooks/useSellerPortal'
import { SellerPortalProvider } from '@/hooks/useSellerPortalContext'
import SellerLayout from './SellerLayout'
import PortalInvalidPage from './PortalInvalidPage'

export default function PortalGateway() {
  const { token } = useParams<{ token: string }>()
  const { isValid, isExpired, isRevoked, isLoading, data } = useSellerPortalAccess(token)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-section">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-theme-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-theme-tertiary mt-4">Chargement de votre espace...</p>
        </div>
      </div>
    )
  }

  if (isRevoked) return <PortalInvalidPage reason="revoked" />
  if (isExpired) return <PortalInvalidPage reason="expired" />
  if (!isValid || !data) return <PortalInvalidPage reason="not_found" />

  return (
    <SellerPortalProvider data={data}>
      <SellerLayout />
    </SellerPortalProvider>
  )
}
