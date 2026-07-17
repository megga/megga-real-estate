/**
 * Page mobile (route /dashboard/kyc/:dossierId) : coque de détail + retour vers
 * la liste. L'UI et le câblage données vivent dans MobileKycDetailScreen.
 */
import { useNavigate } from 'react-router-dom'
import MobileShell from '../shell/MobileShell'
import MobileHeaderBack from '../shell/MobileHeaderBack'
import { MobileKycDetailScreen } from './MobileKycDetailScreen'

/** Route /dashboard/kyc/:dossierId (mobile) — détail dossier KYC, vue détail (header retour vers la liste). */
export default function MobileKycDetailPage() {
  const navigate = useNavigate()
  return (
    <MobileShell variant="detail" header={<MobileHeaderBack onBack={() => navigate('/dashboard/kyc')} />}>
      <MobileKycDetailScreen />
    </MobileShell>
  )
}
