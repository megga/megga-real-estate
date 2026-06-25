import MobileShell from '../shell/MobileShell'
import { MobileNewContactScreen } from './MobileNewContactScreen'

/** Route /dashboard/contacts/new (mobile) — création de contact, vue détail (en-tête interne). */
export default function MobileNewContactPage() {
  return (
    <MobileShell variant="detail">
      <MobileNewContactScreen />
    </MobileShell>
  )
}
