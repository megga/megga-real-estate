import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, MapPin, Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePublicVisit, useRescheduleVisit, useCancelVisit } from '@/hooks/useVisits'
import Navbar from '@/components/layout/Navbar'

const TIME_SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']

export default function VisitManagePage() {
  // Visit ID from URL (used for display, token used for auth)
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || undefined

  const { data: visit, isLoading } = usePublicVisit(token)
  const reschedule = useRescheduleVisit()
  const cancel = useCancelVisit()

  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancelled' | 'rescheduled'>('view')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="h-8 w-8 border-2 border-gray-200 border-t-accent rounded-full animate-spin mb-4" />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!visit || !token) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-xl font-semibold text-gray-900 mb-2">Lien invalide</p>
          <p className="text-sm text-gray-500">Ce lien de gestion de visite est expiré ou invalide.</p>
        </div>
      </div>
    )
  }

  const visitDate = new Date(visit.scheduled_at)
  const dateFR = visitDate.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeFR = visitDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
  const property = visit.property
  const photo = property?.photos?.[0]

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return d
  })

  async function handleReschedule() {
    if (!newDate || !token) return
    const scheduledAt = newTime
      ? new Date(`${newDate}T${newTime}:00`).toISOString()
      : new Date(`${newDate}T10:00:00`).toISOString()
    await reschedule.mutateAsync({ token, newDate: scheduledAt })
    setMode('rescheduled')
  }

  async function handleCancel() {
    if (!token) return
    await cancel.mutateAsync(token)
    setMode('cancelled')
  }

  if (mode === 'cancelled') {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="h-12 w-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Visite annulée</h2>
          <p className="text-sm text-gray-500 mt-2">L'agent a été notifié de l'annulation.</p>
        </div>
      </div>
    )
  }

  if (mode === 'rescheduled') {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Visite reportée</h2>
          <p className="text-sm text-gray-500 mt-2">L'agent a été notifié du nouveau créneau.</p>
        </div>
      </div>
    )
  }

  if (visit.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <p className="text-lg font-semibold text-gray-900">Cette visite a été annulée</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Visit summary card */}
        <div className="rounded-xl border border-gray-200 overflow-hidden mb-8">
          {photo && (
            <div className="aspect-[16/9]">
              <img src={photo} alt="" className="w-full h-full object-cover" decoding="async" />
            </div>
          )}
          <div className="p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">{property?.title || 'Visite planifiée'}</h2>
            {property?.address && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                {property.address}, {property.city}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CalendarDays className="h-4 w-4 flex-shrink-0 text-accent" />
              <span className="font-medium capitalize">{dateFR}</span> à <span className="font-medium">{timeFR}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {mode === 'view' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('reschedule')}
              className="w-full h-11 text-sm font-medium border border-gray-200 rounded-xl hover:border-gray-300 transition-colors text-gray-700"
            >
              Reporter la visite
            </button>
            <button
              onClick={handleCancel}
              disabled={cancel.isPending}
              className="w-full h-11 text-sm font-medium text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
            >
              {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Annuler la visite
            </button>
          </div>
        )}

        {/* Reschedule form */}
        {mode === 'reschedule' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Choisir une nouvelle date</h3>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {dates.map((d) => {
                const key = d.toISOString().split('T')[0]
                const dayName = d.toLocaleDateString('fr-CH', { weekday: 'short' })
                const dayNum = d.getDate()
                return (
                  <button
                    key={key}
                    onClick={() => setNewDate(key)}
                    className={cn(
                      'flex flex-col items-center min-w-[56px] px-2 py-2 rounded-lg border text-xs transition-colors',
                      newDate === key ? 'border-accent bg-accent/5 text-accent font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    <span className="capitalize">{dayName}</span>
                    <span className="text-base font-semibold mt-0.5">{dayNum}</span>
                  </button>
                )
              })}
            </div>

            {newDate && (
              <div className="flex flex-wrap gap-1.5">
                {TIME_SLOTS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewTime(t)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                      newTime === t ? 'border-accent bg-accent/5 text-accent' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setMode('view')}
                className="flex-1 h-10 text-sm text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                Retour
              </button>
              <button
                onClick={handleReschedule}
                disabled={!newDate || reschedule.isPending}
                className={cn(
                  'flex-1 h-10 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2',
                  newDate && !reschedule.isPending ? 'border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active' : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                )}
              >
                {reschedule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
