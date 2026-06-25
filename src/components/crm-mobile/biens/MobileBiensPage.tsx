import MobileShell from '../shell/MobileShell'
import { MobileBiensScreen } from './MobileBiensScreen'

/** Route /dashboard/listings (mobile) — galerie « Mes biens », coque à onglets (« Plus »). */
export default function MobileBiensPage() {
  return (
    <MobileShell variant="tabs">
      <MobileBiensScreen />
    </MobileShell>
  )
}
