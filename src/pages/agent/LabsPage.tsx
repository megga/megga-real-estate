/**
 * MEGGA CRM — Labs (studio de génération : images Nano Banana 2, vidéos Seedance).
 * Route : `/dashboard/labs`.
 * Écran d'entrée : monte l'app et porte la préférence sombre, comme `MessageriePage`.
 */
import { LabsApp } from '@/components/crm/labs/LabsApp'
import { useCrmDarkPref } from '@/lib/crmDark'

export default function LabsPage() {
  const [dark, setDark] = useCrmDarkPref()
  return <LabsApp dark={dark} setDark={setDark} />
}
