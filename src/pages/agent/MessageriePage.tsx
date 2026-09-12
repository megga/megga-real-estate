/**
 * MEGGA CRM — Messagerie (boîte mail intégrée).
 * Route : `/dashboard/messagerie`.
 * Écran d'entrée : monte l'app et porte la préférence sombre, comme `CalendarPage`.
 */
import { MessagerieApp } from '@/components/crm/messagerie/MessagerieApp'
import { useCrmDarkPref } from '@/lib/crmDark'

export default function MessageriePage() {
  const [dark, setDark] = useCrmDarkPref()
  return <MessagerieApp dark={dark} setDark={setDark} />
}
