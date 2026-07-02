import MobileShell from '../shell/MobileShell'
import { MobileAgendaScreen } from './MobileAgendaScreen'

/** Route /dashboard/calendar (mobile) — agenda jour (liste + time-block), coque à onglets. */
export default function MobileAgendaPage() {
  return (
    <MobileShell variant="tabs">
      <MobileAgendaScreen />
    </MobileShell>
  )
}
