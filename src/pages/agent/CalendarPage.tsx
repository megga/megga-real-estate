// MEGGA CRM — Calendrier (refonte « façon Google »)
// Écran d'entrée : monte le calendrier — toujours, sans condition — et décide
// s'il faut y afficher l'invitation à connecter un agenda externe. Porte l'état
// de thème partagé.

import { useState } from 'react'
import { CalendarApp } from '@/components/crm/calendar/CalendarApp'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'
import { useCrmDarkPref } from '@/lib/crmDark'

// Clé de l'ancien onboarding plein écran (retiré : il bloquait l'accès au
// calendrier tant qu'aucun agenda n'était connecté). Conservée telle quelle
// pour que les agents qui l'avaient déjà passé ne revoient pas l'invitation.
const INVITE_DISMISSED_KEY = 'megga.calendar.onboarded'

export default function CalendarPage() {
  const [dark, setDark] = useCrmDarkPref()
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
