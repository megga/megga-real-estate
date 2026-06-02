import { useCallback, useState } from 'react'
import ComingSoonSplash from './ComingSoonSplash'

const SITE_PASSWORD = 'gg'
const STORAGE_KEY = 'megga-site-access'

// Bypass en dev si VITE_PASSWORD_GATE_BYPASS=true dans .env.local (utile pour tests E2E)
const BYPASS_GATE = import.meta.env.DEV && import.meta.env.VITE_PASSWORD_GATE_BYPASS === 'true'

// Routes publiques accessibles sans gate :
// - /kyc/* : parcours client KYC magic link (Sprint 4.7.C) — le client
//   n'a pas de compte MEGGA, il ne doit pas voir le splash Coming Soon.
// - /kyc-report/* : rendu PDF tokenisé du rapport KYC pour WhatsApp (Sprint 4.7.D),
//   chargé par Cloudflare Browser Rendering (headless, sans session). S'il voit le
//   splash, le PDF ne se génère jamais. ⚠️ '/kyc-report/' ne matche PAS le préfixe
//   '/kyc/' (startsWith) → entrée distincte obligatoire.
// - /dev/* : routes de preview/showcase pour itération design — UNIQUEMENT
//   accessibles en dev. En production, elles sont bloquées par le gate pour
//   éviter de leaker l'esthétique interne / mock data avant lancement.
const PUBLIC_ROUTE_PREFIXES = import.meta.env.DEV
  ? ['/kyc/', '/kyc-report/', '/dev/']
  : ['/kyc/', '/kyc-report/']
const isPublicRoute = (): boolean => {
  if (typeof window === 'undefined') return false
  return PUBLIC_ROUTE_PREFIXES.some((p) => window.location.pathname.startsWith(p))
}

interface PasswordGateProps {
  children: React.ReactNode
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const [authorized, setAuthorized] = useState(() =>
    BYPASS_GATE || isPublicRoute() || sessionStorage.getItem(STORAGE_KEY) === 'true'
  )

  const verify = useCallback((password: string) => password === SITE_PASSWORD, [])

  const unlock = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, 'true')
    setAuthorized(true)
  }, [])

  if (authorized) return <>{children}</>

  return <ComingSoonSplash verify={verify} onUnlock={unlock} />
}
