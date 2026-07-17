/** Wrapper de route mobile : monte `MobileSettingsScreen` dans la coque à onglets. */
import MobileShell from '../shell/MobileShell'
import { MobileSettingsScreen } from './MobileSettingsScreen'

/** Route /dashboard/settings (mobile) — hub de réglages, coque à onglets (« Plus »). */
export default function MobileSettingsPage() {
  return (
    <MobileShell variant="tabs">
      <MobileSettingsScreen />
    </MobileShell>
  )
}
