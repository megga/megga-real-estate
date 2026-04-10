import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X, Send, Mail, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import AgentCard from './AgentCard'

interface Agent {
  name: string
  agency: string
  phone: string
  email: string
  photo: string
}

interface ContactAgentModalProps {
  open: boolean
  onClose: () => void
  agent: Agent
  listingAddress: string
  listingTitle: string
}

export default function ContactAgentModal({
  open,
  onClose,
  agent,
  listingAddress,
  listingTitle,
}: ContactAgentModalProps) {
  const { t } = useTranslation('common')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState(
    `Bonjour,\n\nJe suis intéressé(e) par le bien "${listingTitle}" situé au ${listingAddress}.\n\nMerci de me recontacter.`
  )
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) return

    setSending(true)
    setError('')

    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: agent.email || 'contact@megga.ch',
          subject: `Demande de contact — ${listingTitle}`,
          template: 'contact_agent',
          data: {
            agent_name: agent.name,
            buyer_name: name,
            buyer_email: email,
            buyer_phone: phone,
            message,
            listing_title: listingTitle,
            listing_address: listingAddress,
          },
        },
      })
      setSent(true)
    } catch {
      setError(t('listing.errorOccurred'))
    } finally {
      setSending(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-sm w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t('listing.contactAgent')}</h2>
          <button
            onClick={onClose}
            aria-label={t('actions.close')}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-gray-900 mb-1">{t('listing.messageSent')}</p>
            <p className="text-sm text-gray-500">
              {t('listing.agentWillContact', { name: agent.name })}
            </p>
            <button
              onClick={onClose}
              className="mt-6 h-10 px-6 text-sm font-medium border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              {t('actions.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Agent card */}
            <div className="px-6 py-4 bg-gray-50">
              <AgentCard variant="default" agent={agent} />
            </div>

            {/* Form fields */}
            <div className="px-6 py-5 space-y-4">
              {/* Name + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">
                    {t('listing.fullName')} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jean Dupont"
                    required
                    className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">
                    {t('listing.phone')}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+41 79 000 00 00"
                    className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.ch"
                    required
                    className="w-full h-9 pl-9 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">
                  Message <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  required
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              {/* Consent */}
              <p className="text-xs text-gray-500 leading-relaxed">
                {t('listing.consentMessage')}
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 pb-5">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={sending || !name || !email || !message}
                className={cn(
                  'h-9 px-5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
                  'border border-gray-200 text-gray-900 hover:border-accent hover:text-accent',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {sending ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                    {t('listing.sending')}
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    {t('actions.send')}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
