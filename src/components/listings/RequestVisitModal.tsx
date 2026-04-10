import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, CalendarDays, Check, Loader2, Video, MapPin, ArrowRight, ArrowLeft, Building2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { useBookVisit } from '@/hooks/useVisits'

interface RequestVisitModalProps {
  listingAddress: string
  propertyId: string
  agencyId: string
  listingPhoto?: string
  listingPrice?: string
  open: boolean
  onClose: () => void
}

const MORNING_SLOTS = ['09:00', '10:00', '11:00']
const AFTERNOON_SLOTS = ['14:00', '15:00', '16:00', '17:00']

const BUDGET_OPTIONS = ['< CHF 500K', 'CHF 500K – 1M', 'CHF 1M – 2M', '> CHF 2M']
const FINANCING_KEYS = ['financingNotYet', 'financingInProgress', 'financingPreApproved'] as const

type VisitType = 'sur_place' | 'video'
type VideoPlatform = 'google_meet' | 'facetime'

// ── Pill helper (must be outside component to avoid re-creation on render) ──
function Pill({ selected, onClick, children, className }: {
  selected: boolean; onClick: () => void; children: React.ReactNode; className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg border text-xs transition-colors',
        selected ? 'border-accent bg-accent/5 text-accent font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300',
        className
      )}
    >
      {children}
    </button>
  )
}

function isTomorrow(date: Date): boolean {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return date.toDateString() === tomorrow.toDateString()
}

export default function RequestVisitModal({ listingAddress, propertyId, agencyId, listingPhoto, listingPrice, open, onClose }: RequestVisitModalProps) {
  const { t } = useTranslation('common')
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [message, setMessage] = useState('')
  const [budget, setBudget] = useState('')
  const [financing, setFinancing] = useState('')
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null)
  const [visitType, setVisitType] = useState<VisitType>('sur_place')
  const [videoPlatform, setVideoPlatform] = useState<VideoPlatform>('google_meet')
  const [submitted, setSubmitted] = useState(false)
  const [messageFocused, setMessageFocused] = useState(false)
  const submitRef = useRef<HTMLButtonElement>(null)

  const bookVisit = useBookVisit()

  // [Fix 6] Scroll submit button into view on mobile when step 2 loads
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => submitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    }
  }, [step])

  const dates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return d
  })

  const canGoStep2 = !!selectedDate
  const canSubmit = !!name && !!email

  // [Fix 3] Build summary text for "Continuer" button
  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T12:00:00') : null
  const summaryParts: string[] = []
  if (selectedDateObj) {
    summaryParts.push(selectedDateObj.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric' }))
  }
  if (selectedTime) summaryParts.push(`à ${selectedTime}`)
  if (visitType === 'video') summaryParts.push(t('listing.videoCall'))
  else summaryParts.push(t('listing.onSite'))
  const continueLabel = canGoStep2 ? summaryParts.join(' · ') : t('listing.continue')

  function resetForm() {
    setStep(1)
    setName(''); setEmail(''); setPhone(''); setMessage('')
    setSelectedDate(''); setSelectedTime('')
    setBudget(''); setFinancing(''); setFirstVisit(null)
    setVisitType('sur_place'); setVideoPlatform('google_meet')
    setMessageFocused(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !selectedDate) return

    const scheduledAt = selectedTime
      ? new Date(`${selectedDate}T${selectedTime}:00`).toISOString()
      : new Date(`${selectedDate}T10:00:00`).toISOString()

    await bookVisit.mutateAsync({
      propertyId,
      agencyId,
      scheduledAt,
      buyerName: name,
      buyerEmail: email,
      buyerPhone: phone || undefined,
      buyerMessage: message || undefined,
      visitType,
      videoPlatform: visitType === 'video' ? videoPlatform : undefined,
      qualification: {
        budget: budget || undefined,
        financing: financing || undefined,
        firstVisit: firstVisit ?? undefined,
      },
    })

    setSubmitted(true)
    setTimeout(() => { onClose(); setSubmitted(false); resetForm() }, 2500)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      hideCloseButton
      ariaLabel={t('listing.requestVisit')}
      contentClassName="flex flex-col"
    >
      <>
        {/* ── Success state ── */}
        {submitted ? (
          <div className="p-10 text-center">
            <div className="h-14 w-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{t('listing.requestSent')}</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('listing.confirmationSent', { email }) }} />
          </div>
        ) : (
          <>
            {/* ── Header with property photo ── */}
            {/* [Fix 1] Taller photo on mobile: h-32 sm:h-24 */}
            <div className="relative flex-shrink-0">
              <div className="h-32 sm:h-24 bg-gray-100 overflow-hidden">
                {listingPhoto ? (
                  <img src={listingPhoto} alt="" className="w-full h-full object-cover opacity-80" decoding="async" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-gray-500" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10" />
              </div>

              {/* Title overlay */}
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-3">
                <h3 className="text-base font-semibold text-white">{t('listing.requestVisit')}</h3>
                <p className="text-xs text-white/80 truncate">{listingAddress}{listingPrice ? ` — ${listingPrice}` : ''}</p>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
                aria-label={t('listing.close')}
              >
                <X className="h-4 w-4 text-white" />
              </button>

              {/* Step indicator */}
              <div className="absolute top-3 left-5 flex gap-1.5">
                <div className={cn('h-1 rounded-full transition-all duration-300', step === 1 ? 'w-6 bg-white' : 'w-3 bg-white/40')} />
                <div className={cn('h-1 rounded-full transition-all duration-300', step === 2 ? 'w-6 bg-white' : 'w-3 bg-white/40')} />
              </div>
            </div>

            {/* [Fix 5] Social proof bar */}
            <div className="flex items-center gap-1.5 px-5 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
              <Clock className="h-3 w-3 text-emerald-500" />
              <span className="text-xs text-gray-500">{t('listing.avgResponseTime')}</span>
              <span className="text-xs text-gray-500 mx-1">·</span>
              <span className="text-xs text-gray-500">{t('listing.freeVisit')}</span>
            </div>

            {/* Scrollable content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto scrollbar-hide">
              {/* ══════ STEP 1: Date, créneau, type ══════ */}
              {step === 1 && (
                <div className="p-5 space-y-5 animate-in fade-in duration-200">
                  {/* Date */}
                  <div>
                    <label className="text-sm font-medium text-gray-900 mb-2.5 block">{t('listing.whenVisit')}</label>
                    <div className="grid grid-cols-5 gap-2">
                      {dates.map((d) => {
                        const key = d.toISOString().split('T')[0]
                        const dayName = d.toLocaleDateString('fr-CH', { weekday: 'short' })
                        const dayNum = d.getDate()
                        const monthName = d.toLocaleDateString('fr-CH', { month: 'short' })
                        const tomorrow = isTomorrow(d)
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedDate(key)}
                            className={cn(
                              'flex flex-col items-center py-2.5 rounded-xl border text-xs transition-all relative',
                              selectedDate === key
                                ? 'border-accent bg-accent/5 text-accent ring-1 ring-accent/20'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            )}
                          >
                            {/* [Fix 2] "Demain" label on first date */}
                            {tomorrow && (
                              <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs font-medium text-accent bg-white px-1">{t('listing.tomorrow')}</span>
                            )}
                            <span className="capitalize text-xs">{dayName}</span>
                            <span className="text-lg font-bold mt-0.5">{dayNum}</span>
                            <span className="text-gray-500 text-xs">{monthName}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Time — morning / afternoon */}
                  {selectedDate && (
                    <div className="animate-in slide-in-from-bottom-2 duration-200">
                      <label className="text-sm font-medium text-gray-900 mb-2.5 block">{t('listing.preferredSlot')}</label>
                      <div className="space-y-2.5">
                        <div>
                          <p className="text-xs text-gray-500 mb-1.5">{t('listing.morning')}</p>
                          <div className="flex gap-2">
                            {MORNING_SLOTS.map(t => (
                              <Pill key={t} selected={selectedTime === t} onClick={() => setSelectedTime(selectedTime === t ? '' : t)} className="flex-1 text-center">
                                {t}
                              </Pill>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1.5">{t('listing.afternoon')}</p>
                          <div className="flex gap-2">
                            {AFTERNOON_SLOTS.map(t => (
                              <Pill key={t} selected={selectedTime === t} onClick={() => setSelectedTime(selectedTime === t ? '' : t)} className="flex-1 text-center">
                                {t}
                              </Pill>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Visit type */}
                  {selectedDate && (
                    <div className="animate-in slide-in-from-bottom-2 duration-200">
                      <label className="text-sm font-medium text-gray-900 mb-2.5 block">{t('listing.howVisit')}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setVisitType('sur_place')}
                          className={cn(
                            'h-11 rounded-xl border text-sm flex items-center justify-center gap-2 transition-all',
                            visitType === 'sur_place' ? 'border-accent bg-accent/5 text-accent font-medium ring-1 ring-accent/20' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          )}
                        >
                          <MapPin className="h-4 w-4" />
                          {t('listing.onSite')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisitType('video')}
                          className={cn(
                            'h-11 rounded-xl border text-sm flex items-center justify-center gap-2 transition-all',
                            visitType === 'video' ? 'border-accent bg-accent/5 text-accent font-medium ring-1 ring-accent/20' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          )}
                        >
                          <Video className="h-4 w-4" />
                          {t('listing.videoCall')}
                        </button>
                      </div>

                      {visitType === 'video' && (
                        <div className="mt-3 animate-in fade-in duration-150">
                          <div className="flex gap-2">
                            <Pill selected={videoPlatform === 'google_meet'} onClick={() => setVideoPlatform('google_meet')} className="flex-1 text-center">
                              Google Meet
                            </Pill>
                            <Pill selected={videoPlatform === 'facetime'} onClick={() => setVideoPlatform('facetime')} className="flex-1 text-center">
                              FaceTime
                            </Pill>
                          </div>
                          <p className="text-xs text-gray-500 mt-1.5">
                            {videoPlatform === 'google_meet'
                              ? t('listing.meetLinkInfo')
                              : t('listing.facetimeInfo')
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* [Fix 3] Next button with inline summary */}
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!canGoStep2}
                    className={cn(
                      'w-full h-11 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2',
                      canGoStep2
                        ? 'border border-gray-900 text-gray-900 hover:bg-gray-50'
                        : 'border border-gray-200 text-gray-500 cursor-not-allowed'
                    )}
                  >
                    {continueLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* ══════ STEP 2: Contact + pré-qualification ══════ */}
              {/* [Fix 7] Slide animation from right */}
              {step === 2 && (
                <div className="p-5 space-y-4 animate-in slide-in-from-right-4 duration-250">
                  {/* Back link */}
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors -mt-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    {t('listing.changeDate')}
                  </button>

                  {/* Summary of step 1 */}
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 text-sm">
                    <CalendarDays className="h-4 w-4 text-accent flex-shrink-0" />
                    <span className="text-gray-700">
                      {selectedDateObj?.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {selectedTime && ` à ${selectedTime}`}
                      {visitType === 'video' && ` · Vidéo`}
                    </span>
                  </div>

                  {/* Contact info with labels */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900 block">{t('listing.yourDetails')}</label>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('listing.fullNameLabel')}</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jean Dupont"
                        required
                        autoComplete="name"
                        className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">{t('listing.emailLabel')}</label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="jean@exemple.ch"
                          required
                          autoComplete="email"
                          className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">{t('listing.phoneLabel')}</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+41 79..."
                          autoComplete="tel"
                          className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pré-qualification — human-friendly */}
                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <p className="text-sm font-medium text-gray-900">{t('listing.prepareVisitTitle')}</p>
                    <p className="text-xs text-gray-500 -mt-2">{t('listing.prepareVisitOptional')}</p>

                    {/* [Fix 4] Budget pills in 2x2 grid on mobile */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1.5 block">{t('listing.estimatedBudget')}</label>
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
                        {BUDGET_OPTIONS.map(b => (
                          <Pill key={b} selected={budget === b} onClick={() => setBudget(budget === b ? '' : b)} className="text-center">
                            {b}
                          </Pill>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 mb-1.5 block">{t('listing.mortgageFinancing')}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {FINANCING_KEYS.map(key => {
                          const label = t(`listing.${key}`)
                          return (
                            <Pill key={key} selected={financing === key} onClick={() => setFinancing(financing === key ? '' : key)}>
                              {label}
                            </Pill>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 mb-1.5 block">{t('listing.firstVisitQuestion')}</label>
                      <div className="flex gap-1.5">
                        {[{ label: t('listing.yes'), val: true }, { label: t('listing.no'), val: false }].map(({ label, val }) => (
                          <Pill key={label} selected={firstVisit === val} onClick={() => setFirstVisit(firstVisit === val ? null : val)}>
                            {label}
                          </Pill>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* [Fix 8] Message — 1 row, expands on focus */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('listing.messageForAgent')}</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onFocus={() => setMessageFocused(true)}
                      onBlur={() => { if (!message) setMessageFocused(false) }}
                      placeholder={t('listing.messagePlaceholder')}
                      rows={messageFocused || message ? 3 : 1}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none transition-all duration-200"
                    />
                  </div>

                  {/* [Fix 6] Submit — with ref for scroll-into-view on mobile */}
                  <button
                    ref={submitRef}
                    type="submit"
                    disabled={!canSubmit || bookVisit.isPending}
                    className={cn(
                      'w-full h-11 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2',
                      canSubmit && !bookVisit.isPending
                        ? 'border border-gray-900 text-gray-900 hover:bg-gray-50'
                        : 'border border-gray-200 text-gray-500 cursor-not-allowed'
                    )}
                  >
                    {bookVisit.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CalendarDays className="h-4 w-4" />
                    )}
                    {bookVisit.isPending ? t('listing.submitting') : t('listing.submitRequest')}
                  </button>

                  {bookVisit.isError && (
                    <p className="text-xs text-red-500 text-center">
                      {t('listing.errorOccurred')}
                    </p>
                  )}
                </div>
              )}
            </form>
          </>
        )}
      </>
    </Modal>
  )
}
