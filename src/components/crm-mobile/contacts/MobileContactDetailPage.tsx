import { useNavigate } from 'react-router-dom'
import MobileShell from '../shell/MobileShell'
import MobileHeaderBack from '../shell/MobileHeaderBack'
import { MobileContactDetailScreen } from './MobileContactDetailScreen'

/** Route /dashboard/contacts/:id (mobile) — fiche contact détail, vue détail (header retour). */
export default function MobileContactDetailPage() {
  const navigate = useNavigate()
  return (
    <MobileShell variant="detail" header={<MobileHeaderBack onBack={() => navigate('/dashboard/contacts')} />}>
      <MobileContactDetailScreen />
    </MobileShell>
  )
}
