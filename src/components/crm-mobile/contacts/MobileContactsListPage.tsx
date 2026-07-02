import MobileShell from '../shell/MobileShell'
import { MobileContactsListScreen } from './MobileContactsListScreen'

/** Route /dashboard/contacts (mobile) — liste contacts, coque à onglets (« Plus »). */
export default function MobileContactsListPage() {
  return (
    <MobileShell variant="tabs">
      <MobileContactsListScreen />
    </MobileShell>
  )
}
