/** Page mobile « Plus » — monte `MobileMoreScreen` dans la coque à onglets. */
import MobileShell from '../shell/MobileShell'
import MobileMoreScreen from './MobileMoreScreen'

/** Route /dashboard/more (mobile) — hub « Plus » dans la coque à onglets. */
export default function MobileMorePage() {
  return (
    <MobileShell variant="tabs">
      <MobileMoreScreen />
    </MobileShell>
  )
}
