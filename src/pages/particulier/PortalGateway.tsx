import { useParams } from 'react-router-dom'
import { useSellerPortalAccess } from '@/hooks/useSellerPortal'
import SellerLayout from './SellerLayout'
import PortalInvalidPage from './PortalInvalidPage'

export default function PortalGateway() {
  const { token } = useParams<{ token: string }>()
  const { isValid, isExpired, isRevoked } = useSellerPortalAccess(token)

  if (isRevoked) return <PortalInvalidPage reason="revoked" />
  if (isExpired) return <PortalInvalidPage reason="expired" />
  if (!isValid) return <PortalInvalidPage reason="not_found" />

  return <SellerLayout />
}
