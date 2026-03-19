import { useState, useEffect, useCallback } from 'react'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'new_lead'
  | 'message'
  | 'visit_scheduled'
  | 'offer_received'
  | 'kyc_update'
  | 'listing_update'
  | 'calendar_reminder'
  | 'system'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  entity_type?: 'contact' | 'transaction' | 'listing' | 'kyc_case' | 'message_thread'
  entity_id?: string
  link?: string
  created_at: string
}

export interface NotificationPreferences {
  new_leads: { email: boolean; push: boolean }
  messages: { email: boolean; push: boolean }
  visits: { email: boolean; push: boolean }
  offers: { email: boolean; push: boolean }
  kyc: { email: boolean; push: boolean }
  calendar: { email: boolean; push: boolean }
}

// ─── DEV BYPASS ─────────────────────────────────────────────────────────────

const DEV_BYPASS = true

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'new_lead',
    title: 'Nouveau lead qualifié',
    message: 'Sophie Martin s\'intéresse à l\'appartement 4p à Champel.',
    read: false,
    entity_type: 'contact',
    entity_id: 'c1',
    link: '/dashboard/contacts/c1',
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    type: 'message',
    title: 'Nouveau message',
    message: 'Pierre Dubois : "Bonjour, est-il possible de visiter samedi ?"',
    read: false,
    entity_type: 'message_thread',
    entity_id: 't1',
    link: '/dashboard/messages',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: '3',
    type: 'visit_scheduled',
    title: 'Visite confirmée',
    message: 'Visite du 3p Eaux-Vives avec M. Laurent, demain à 14h.',
    read: false,
    entity_type: 'transaction',
    entity_id: 't2',
    link: '/dashboard/calendar',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '4',
    type: 'offer_received',
    title: 'Offre reçue',
    message: 'Offre de CHF 780\'000 pour la villa à Cologny par famille Meier.',
    read: false,
    entity_type: 'transaction',
    entity_id: 't3',
    link: '/dashboard/pipeline',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: '5',
    type: 'kyc_update',
    title: 'Dossier KYC incomplet',
    message: 'Il manque le justificatif de domicile pour le dossier Rossi.',
    read: true,
    entity_type: 'kyc_case',
    entity_id: 'k1',
    link: '/dashboard/kyc/k1',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '6',
    type: 'listing_update',
    title: 'Annonce vue 50 fois',
    message: 'Votre annonce "Loft design Plainpalais" a atteint 50 vues cette semaine.',
    read: true,
    entity_type: 'listing',
    entity_id: 'l1',
    link: '/dashboard/listings',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: '7',
    type: 'calendar_reminder',
    title: 'Rappel : RDV dans 1h',
    message: 'Rendez-vous estimation avec Mme Favre, 15 Rue du Rhône.',
    read: true,
    link: '/dashboard/calendar',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: '8',
    type: 'system',
    title: 'Mise à jour plateforme',
    message: 'Nouvelle fonctionnalité : génération automatique de descriptions IA pour vos annonces.',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
]

// ─── HOOK ───────────────────────────────────────────────────────────────────

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (DEV_BYPASS) {
      setNotifications(MOCK_NOTIFICATIONS)
      setLoading(false)
      return
    }

    // TODO: Supabase realtime subscription
    // const channel = supabase.channel('notifications')
    //   .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, ...)
    //   .subscribe()
    // return () => { supabase.removeChannel(channel) }
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
    // TODO: supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    // TODO: supabase.from('notifications').update({ read: true }).eq('read', false)
  }, [])

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    // TODO: supabase.from('notifications').delete().eq('id', id)
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  }
}
