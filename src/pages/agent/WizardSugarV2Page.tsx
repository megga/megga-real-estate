// MEGGA CRM Sugar v2 — Wizard "Créer un bien" page wrapper.
// Mounts the Sugar v2 wizard shell at /dashboard/listings/new.

import { useNavigate } from 'react-router-dom'
import WizardShell from '@/components/crm-sugar-wizard/WizardShell'

export default function WizardSugarV2Page() {
  const navigate = useNavigate()
  const onClose = () => navigate('/dashboard/listings')
  return <WizardShell onClose={onClose} />
}
