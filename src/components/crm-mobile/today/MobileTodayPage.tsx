import MobileShell from '../shell/MobileShell'
import { MobileTodayScreen } from './MobileTodayScreen'

/** Route /dashboard (index, mobile) — cockpit « Aujourd'hui » dans la coque à onglets. */
export default function MobileTodayPage() {
  return (
    <MobileShell variant="tabs">
      <MobileTodayScreen />
    </MobileShell>
  )
}
