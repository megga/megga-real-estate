import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, CalendarDays, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RequestVisitModalProps {
  listingAddress: string
  open: boolean
  onClose: () => void
}

const TIME_SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']

export default function RequestVisitModal({ listingAddress, open, onClose }: RequestVisitModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!open) return null

  // Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return d
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: connect to Supabase visits table + send-email Edge Function
    setSubmitted(true)
    setTimeout(() => { onClose(); setSubmitted(false) }, 2000)
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl border border-gray-100 shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {submitted ? (
          <div className="p-8 text-center">
            <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Demande envoyee</h3>
            <p className="text-sm text-gray-500 mt-1">L'agent vous contactera rapidement pour confirmer.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Demander une visite</h3>
                <p className="text-sm text-gray-500 mt-0.5 truncate max-w-[280px]">{listingAddress}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Date selection */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Date souhaitee</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dates.map((d) => {
                    const key = d.toISOString().split('T')[0]
                    const dayName = d.toLocaleDateString('fr-CH', { weekday: 'short' })
                    const dayNum = d.getDate()
                    const monthName = d.toLocaleDateString('fr-CH', { month: 'short' })
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDate(key)}
                        className={cn(
                          'flex flex-col items-center min-w-[56px] px-2 py-2 rounded-lg border text-xs transition-colors',
                          selectedDate === key
                            ? 'border-accent bg-accent/5 text-accent font-medium'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        <span className="capitalize">{dayName}</span>
                        <span className="text-base font-semibold mt-0.5">{dayNum}</span>
                        <span className="text-gray-400">{monthName}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time selection */}
              {selectedDate && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Creneau horaire</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TIME_SLOTS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTime(t)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                          selectedTime === t
                            ? 'border-accent bg-accent/5 text-accent'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom"
                    required
                    className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telephone"
                  className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message (optionnel)"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
              />

              <button
                type="submit"
                disabled={!name || !email || !selectedDate}
                className={cn(
                  'w-full h-10 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2',
                  name && email && selectedDate
                    ? 'bg-accent text-white hover:bg-accent/90'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                <CalendarDays className="h-4 w-4" />
                Envoyer la demande
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
