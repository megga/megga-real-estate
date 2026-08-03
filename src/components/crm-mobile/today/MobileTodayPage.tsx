import MobileShell from '../shell/MobileShell'
import { MobileTodayHScreen } from './MobileTodayHScreen'

/** Route /dashboard (index, mobile) — « Aujourd'hui » concept H dans la coque à onglets. */
export default function MobileTodayPage() {
  return (
    <MobileShell variant="tabs">
      <MobileTodayHScreen />
    </MobileShell>
  )
}
