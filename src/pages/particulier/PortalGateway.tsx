/**
 * Portail vendeur — porte d'entrée de la route `/portal/:token`.
 * Valide le token (useSellerPortalAccess) puis rend « Votre vente » dans un
 * SellerPortalProvider ; sinon affiche PortalInvalidPage selon le motif
 * (révoqué / expiré / introuvable).
 */
import { useParams } from 'react-router-dom'
import { useSellerPortalAccess } from '@/hooks/useSellerPortal'
import { SellerPortalProvider } from '@/hooks/useSellerPortalContext'
import VotreVentePage from './VotreVentePage'
import PortalInvalidPage from './PortalInvalidPage'

/** Résout l'accès au token et bascule entre la page vente et l'écran d'accès invalide. */
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
      <VotreVentePage token={token} />
    </SellerPortalProvider>
  )
}
