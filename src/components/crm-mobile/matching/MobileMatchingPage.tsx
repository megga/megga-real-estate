/** Page mobile Matching — monte `MobileMatchingScreen` dans la coque à onglets. */
import MobileShell from '../shell/MobileShell'
import { MobileMatchingScreen } from './MmMatchingScreen'

/** Route /dashboard/matching (mobile) — inbox acheteurs + focus, dans la coque à onglets. */
export default function MobileMatchingPage() {
  return (
    <MobileShell variant="tabs">
      <MobileMatchingScreen />
    </MobileShell>
  )
}
