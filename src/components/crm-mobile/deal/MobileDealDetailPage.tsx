/**
 * Page mobile (route /dashboard/transactions/:id) : coque de détail + retour
 * pipeline. L'UI et le câblage données vivent dans MobileDealDetailScreen.
 */
import { useNavigate } from 'react-router-dom'
import MobileShell from '../shell/MobileShell'
import MobileHeaderBack from '../shell/MobileHeaderBack'
import { MobileDealDetailScreen } from './MobileDealDetailScreen'

/** Route /dashboard/transactions/:id (mobile) — détail deal, vue détail (header retour, sans barre d'onglets). */
export default function MobileDealDetailPage() {
  const navigate = useNavigate()
  return (
    <MobileShell variant="detail" header={<MobileHeaderBack onBack={() => navigate('/dashboard/pipeline')} />}>
      <MobileDealDetailScreen />
    </MobileShell>
  )
}
