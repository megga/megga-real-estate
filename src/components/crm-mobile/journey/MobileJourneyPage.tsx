import MobileShell from '../shell/MobileShell'
import { MobileJourneyScreen } from './MobileJourneyScreen'

/** Route /dashboard/journey (mobile) — parcours des dossiers, coque à onglets (« Plus »). */
export default function MobileJourneyPage() {
  return (
    <MobileShell variant="tabs">
      <MobileJourneyScreen />
    </MobileShell>
  )
}
