import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import type { MatchResult } from '@/hooks/useMatching'

interface SendMatchDialogProps {
  open: boolean
  match: MatchResult | null
  contactName: string
  onSend: (matchId: string, channel: 'email' | 'whatsapp' | 'both') => void
  onClose: () => void
}

type Channel = 'email' | 'messaging'

export default function SendMatchDialog({ open, match, contactName, onSend, onClose }: SendMatchDialogProps) {
  const [channel, setChannel] = useState<Channel>('email')
  const [message, setMessage] = useState('')

  const template = match ? generateTemplate(channel, contactName, match) : ''

  function generateTemplate(ch: Channel, name: string, m: MatchResult): string {
    const firstName = name.split(' ')[0]
    const listing = m.listing
    if (ch === 'messaging') {
      return `Bonjour ${firstName}, j'ai un bien qui pourrait vous intéresser : ${listing.title}, ${listing.address} à ${listing.city}. Prix : ${formatCHF(listing.price)}. ${listing.rooms} pièces, ${listing.surface_m2} m². Souhaitez-vous planifier une visite ?`
    }
    return `Bonjour ${firstName},\n\nSuite à notre échange, j'ai le plaisir de vous présenter un bien qui correspond à vos critères :\n\n${listing.title}\n${listing.address}, ${listing.city}\nPrix : ${formatCHF(listing.price)}\n${listing.rooms} pièces · ${listing.surface_m2} m²\n\nCe bien présente les caractéristiques suivantes :\n- ${Object.entries(listing.features).slice(0, 4).map(([k, v]) => `${k} : ${v}`).join('\n- ')}\n\nSouhaitez-vous organiser une visite ? Je reste à votre disposition.\n\nCordialement,\nGregory Lyonnet\nMEGGA Immobilier`
  }

  function handleSend() {
    if (!match) return
    onSend(match.id, 'email')
    onClose()
  }

  if (!open || !match) return null

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
              {match.listing.title} — {formatCHF(match.listing.price)} — Score {match.score}%
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Channel selector — pills */}
          <div>
            <label className="block text-sm font-medium text-theme-primary mb-1.5">Canal d'envoi</label>
            <div className="flex gap-1.5">
              {([
                { value: 'email' as Channel, label: 'Email' },
                { value: 'messaging' as Channel, label: 'Messagerie' },
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
              rows={channel === 'messaging' ? 4 : 10}
              className="w-full text-sm text-theme-primary bg-transparent border border-theme-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none placeholder:text-theme-tertiary"
            />
          </div>
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
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
