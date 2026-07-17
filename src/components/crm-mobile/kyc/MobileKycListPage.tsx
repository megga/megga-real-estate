/**
 * Page mobile (route /dashboard/kyc) : coque à onglets. L'UI et le câblage
 * données vivent dans MobileKycListScreen.
 */
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
