/**
 * MEGGA CRM — Messagerie (boîte mail intégrée).
 * Route : `/dashboard/messagerie`.
 * Écran d'entrée : monte l'app et porte la préférence sombre, comme `CalendarPage`.
 */
import { useEffect, useState } from 'react'
import { MessagerieApp } from '@/components/crm/messagerie/MessagerieApp'
import { CRM_DARK_KEY, readCrmDark } from '@/lib/crmDark'

function useDarkPref(): [boolean, (v: boolean) => void] {
  const [dark, setDark] = useState<boolean>(() => (typeof window === 'undefined' ? false : readCrmDark()))
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(CRM_DARK_KEY, dark ? '1' : '0')
  }, [dark])
  return [dark, setDark]
}

export default function MessageriePage() {
  const [dark, setDark] = useDarkPref()
  return <MessagerieApp dark={dark} setDark={setDark} />
}
