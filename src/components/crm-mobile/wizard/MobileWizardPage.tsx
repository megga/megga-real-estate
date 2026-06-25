import MobileShell from '../shell/MobileShell'
import { MobileWizardScreen } from './MobileWizardScreen'

/** Route /dashboard/listings/new (mobile) — wizard de création, vue détail (en-tête interne). */
export default function MobileWizardPage() {
  return (
    <MobileShell variant="detail">
      <MobileWizardScreen />
    </MobileShell>
  )
}
