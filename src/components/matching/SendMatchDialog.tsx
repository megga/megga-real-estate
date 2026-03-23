import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { useSendMatchToClient } from '@/hooks/useMatching'
import type { MatchWithRelations } from '@/types/matching'

interface SendMatchDialogProps {
  open: boolean
  match: MatchWithRelations | null
  onClose: () => void
}

type Channel = 'email' | 'whatsapp'

export default function SendMatchDialog({ open, match, onClose }: SendMatchDialogProps) {
  const [channel, setChannel] = useState<Channel>('email')
  const [message, setMessage] = useState('')
  const sendMutation = useSendMatchToClient()

  const contactName = match?.contact
    ? `${match.contact.first_name} ${match.contact.last_name}`
    : 'Contact'
  const property = match?.property

  const template = match && property ? generateTemplate(channel, contactName, property) : ''

  function generateTemplate(
    ch: Channel,
    name: string,
    prop: NonNullable<MatchWithRelations['property']>,
  ): string {
    const firstName = name.split(' ')[0]
    if (ch === 'whatsapp') {
      return `Bonjour ${firstName}, j'ai un bien qui pourrait vous intéresser : ${prop.title}, ${prop.address} à ${prop.city}. Prix : ${formatCHF(prop.price)}. ${prop.rooms} pièces, ${prop.surface_m2} m². Souhaitez-vous planifier une visite ?`
    }
    return `Bonjour ${firstName},\n\nSuite à notre échange, j'ai le plaisir de vous présenter un bien qui correspond à vos critères :\n\n${prop.title}\n${prop.address}, ${prop.city}\nPrix : ${formatCHF(prop.price)}\n${prop.rooms} pièces · ${prop.surface_m2} m²\n\nSouhaitez-vous organiser une visite ? Je reste à votre disposition.\n\nCordialement,\nGregory Lyonnet\nMEGGA Immobilier`
  }

  function handleSend() {
    if (!match) return
    const finalMessage = message || template
    sendMutation.mutate(
      { matchId: match.id, channel, message: finalMessage },
      { onSuccess: () => onClose() },
    )
  }

  if (!open || !match || !property) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-theme-card border border-theme-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <div>
            <h3 className="text-base font-semibold text-theme-primary">Envoyer le bien à {contactName}</h3>
            <p className="text-xs text-theme-tertiary mt-0.5">
              {property.title} — {formatCHF(property.price)} — Score {match.score}%
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Channel selector */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Canal d&apos;envoi</label>
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

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Message</label>
            <textarea
              value={message || template}
              onChange={(e) => setMessage(e.target.value)}
              rows={channel === 'whatsapp' ? 4 : 10}
              className="w-full text-sm text-theme-primary bg-transparent border border-theme-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none placeholder:text-theme-tertiary"
            />
          </div>

          {sendMutation.isError && (
            <p className="text-xs text-red-500">Erreur lors de l&apos;envoi. Réessayez.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-theme-border">
          <button
            onClick={onClose}
            className="text-sm text-theme-secondary hover:text-theme-primary transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={sendMutation.isPending}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {sendMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Envoyer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
