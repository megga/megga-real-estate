import MobileShell from '../shell/MobileShell'
import { MobileBienVitrineScreen } from './MobileBienVitrineScreen'

/** Route /dashboard/listings/:id (mobile) — fiche bien, vue détail (en-tête interne, sans barre d'onglets). */
export default function MobileBienVitrinePage() {
  return (
    <MobileShell variant="detail">
      <MobileBienVitrineScreen />
    </MobileShell>
  )
}
