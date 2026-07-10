// MEGGA CRM Sugar — Calendrier (refonte « façon Google »)
// Gate d'écran : décide entre l'onboarding « Première connexion » (aucun agenda
// connecté et jamais passé) et le calendrier. Porte l'état de thème partagé.

import { useEffect, useState } from 'react'
import { CRM_TOKENS, crmSugarPalette } from '@/components/crm-sugar/tokens'
import { CalendarApp } from '@/components/crm-sugar/calendar/CalendarApp'
import { CalendarOnboarding } from '@/components/crm-sugar/calendar/CalendarOnboarding'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'

const ONBOARDED_KEY = 'megga.calendar.onboarded'

function useDarkPref(): [boolean, (v: boolean) => void] {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
  }, [dark])
  return [dark, setDark]
}

export default function CalendarSugarV2Page() {
  const [dark, setDark] = useDarkPref()
  const google = useGoogleCalendar()
  const outlook = useOutlookCalendar()

  const statusLoading = google.isLoading || outlook.isLoading
  const anyConnected = google.isConnected || outlook.isConnected

  const [seen, setSeen] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem(ONBOARDED_KEY) === '1',
  )

  // Un agenda connecté → on mémorise (l'onboarding ne se réaffiche plus au prochain
  // montage). Le render masque déjà l'onboarding tant que `anyConnected` est vrai.
  useEffect(() => {
    if (anyConnected) window.localStorage.setItem(ONBOARDED_KEY, '1')
  }, [anyConnected])

  const dismiss = () => {
    window.localStorage.setItem(ONBOARDED_KEY, '1')
    setSeen(true)
  }

  // Évite le flash calendrier → onboarding pendant la résolution du statut.
  if (statusLoading && !seen) {
    const tk = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
    const sp = crmSugarPalette(tk, dark, 'meggaAi')
    return <div style={{ height: '100vh', background: sp.pageBg }} />
  }

  if (!anyConnected && !seen) {
    return (
      <CalendarOnboarding
        dark={dark}
        setDark={setDark}
        onDismiss={dismiss}
        onConnectGoogle={google.connectGoogleCalendar}
        onConnectOutlook={outlook.connectOutlookCalendar}
      />
    )
  }

  return <CalendarApp dark={dark} setDark={setDark} />
}
