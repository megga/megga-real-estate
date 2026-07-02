import MobileShell from '../shell/MobileShell'
import { MobileKycListScreen } from './MobileKycListScreen'

/** Route /dashboard/kyc (mobile) — liste des dossiers KYC, coque à onglets (« Plus »). */
export default function MobileKycListPage() {
  return (
    <MobileShell variant="tabs">
      <MobileKycListScreen />
    </MobileShell>
  )
}
