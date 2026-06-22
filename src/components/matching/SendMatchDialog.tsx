import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { useSendMatchToClient, type MatchResult } from '@/hooks/useMatching'
import Modal from '@/components/ui/modal'

interface SendMatchDialogProps {
  open: boolean
  match: MatchResult | null
  contactName?: string
  onSend?: (matchId: string, channel: 'email' | 'whatsapp' | 'both') => void
  onClose: () => void
}

type Channel = 'email' | 'whatsapp'

export default function SendMatchDialog({ open, match, contactName: propContactName, onSend, onClose }: SendMatchDialogProps) {
  const { t } = useTranslation('matching')
  const [channel, setChannel] = useState<Channel>('email')
  const [message, setMessage] = useState('')
  const sendMutation = useSendMatchToClient()

  const name = propContactName || match?.contactName || t('send.fallbackName')
  const listing = match?.listing

  const template = match && listing ? generateTemplate(channel, name, listing) : ''

  function generateTemplate(
    ch: Channel,
    n: string,
    l: MatchResult['listing'],
  ): string {
    const firstName = n.split(' ')[0]
    const vars = {
      firstName,
      title: l.title,
      address: l.address,
      city: l.city,
      price: formatCHF(l.price),
      rooms: l.rooms,
      surface: l.surface_m2,
    }
    if (ch === 'whatsapp') {
      return t('send.template.whatsapp', vars)
    }
    return t('send.template.email', vars)
  }

  function handleSend() {
    if (!match) return
    const finalMessage = message || template
    if (onSend) {
      onSend(match.id, channel)
      onClose()
    } else {
      sendMutation.mutate(
        { matchId: match.id, channel, message: finalMessage },
        { onSuccess: () => onClose() },
      )
    }
  }

  if (!match || !listing) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('send.title', { name })}
      description={t('send.description', { title: listing.title, price: formatCHF(listing.price), score: match.score })}
      size="md"
    >
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">{t('send.channelLabel')}</label>
            <div className="flex gap-1.5">
              {([
                { value: 'email' as Channel, label: 'Email' },
                { value: 'whatsapp' as Channel, label: 'WhatsApp' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setChannel(opt.value); setMessage('') }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    channel === opt.value
                      ? 'bg-theme-active text-theme-primary border-theme-active'
                      : 'border-theme-border text-theme-tertiary hover:text-theme-secondary'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">{t('send.messageLabel')}</label>
            <textarea
              value={message || template}
              onChange={(e) => setMessage(e.target.value)}
              rows={channel === 'whatsapp' ? 4 : 10}
              className="w-full text-sm text-theme-primary bg-transparent border border-theme-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none placeholder:text-theme-tertiary"
            />
          </div>

          {sendMutation.isError && (
            <p className="text-xs text-red-500">{t('send.error')}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="text-sm text-theme-secondary hover:text-theme-primary transition-colors">
            {t('common:actions.cancel')}
          </button>
          <button
            onClick={handleSend}
            disabled={sendMutation.isPending}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {sendMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('common:actions.send')}
          </button>
        </div>
    </Modal>
  )
}
