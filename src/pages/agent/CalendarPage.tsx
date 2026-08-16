// MEGGA CRM — Calendrier (refonte « façon Google »)
// Écran d'entrée : monte le calendrier — toujours, sans condition — et décide
// s'il faut y afficher l'invitation à connecter un agenda externe. Porte l'état
// de thème partagé.

import { useEffect, useState } from 'react'
import { CalendarApp } from '@/components/crm-sugar/calendar/CalendarApp'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'

// Clé de l'ancien onboarding plein écran (retiré : il bloquait l'accès au
// calendrier tant qu'aucun agenda n'était connecté). Conservée telle quelle
// pour que les agents qui l'avaient déjà passé ne revoient pas l'invitation.
const INVITE_DISMISSED_KEY = 'megga.calendar.onboarded'

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

export default function CalendarPage() {
  const [dark, setDark] = useDarkPref()
  const google = useGoogleCalendar()
  const outlook = useOutlookCalendar()

  const anyConnected = google.isConnected || outlook.isConnected

  const [dismissed, setDismissed] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem(INVITE_DISMISSED_KEY) === '1',
  )

  // On attend la résolution des deux statuts avant de proposer la connexion,
  // sinon l'invitation clignote à chaque montage. Le calendrier, lui, s'affiche
  // immédiatement : il ne dépend pas des agendas externes.
  const statusResolved = !google.isLoading && !outlook.isLoading
  const showInvite = statusResolved && !anyConnected && !dismissed

  const dismiss = () => {
    window.localStorage.setItem(INVITE_DISMISSED_KEY, '1')
    setDismissed(true)
  }

  // En cas de succès le navigateur part sur l'OAuth du fournisseur : on ne
  // repasse ici que sur échec (« Manual linking » désactivé côté projet,
  // identité déjà liée à un autre compte…), et le bandeau le dit.
  const [connectError, setConnectError] = useState<string | null>(null)
  const runConnect = (start: () => Promise<{ error: string | null }>) => {
    setConnectError(null)
    void start().then(({ error }) => setConnectError(error))
  }

  return (
    <CalendarApp
      dark={dark}
      setDark={setDark}
      invite={showInvite ? {
        onConnectGoogle: () => runConnect(() => google.connectGoogleCalendar({ from: 'calendar' })),
        onConnectOutlook: () => runConnect(() => outlook.connectOutlookCalendar({ from: 'calendar' })),
        onDismiss: dismiss,
        error: connectError,
      } : undefined}
    />
  )
}
