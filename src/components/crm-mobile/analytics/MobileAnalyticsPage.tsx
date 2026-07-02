import MobileShell from '../shell/MobileShell'
import { MobileAnalyticsScreen } from './MobileAnalyticsScreen'

/** Route /dashboard/analytics (mobile) — cockpit commission, coque à onglets (« Plus »). */
export default function MobileAnalyticsPage() {
  return (
    <MobileShell variant="tabs">
      <MobileAnalyticsScreen />
    </MobileShell>
  )
}
