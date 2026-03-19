import { useState } from 'react'
import { Mail, MessageCircle, Send } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import type { MatchResult } from '@/lib/matching'

interface SendMatchDialogProps {
  open: boolean
  match: MatchResult | null
  contactName: string
  onSend: (matchId: string, channel: 'email' | 'whatsapp' | 'both') => void
  onClose: () => void
}

export default function SendMatchDialog({ open, match, contactName, onSend, onClose }: SendMatchDialogProps) {
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email')
  const [message, setMessage] = useState('')

  // Generate template when match changes
  const template = match ? generateTemplate(channel, contactName, match) : ''

  function generateTemplate(ch: 'email' | 'whatsapp', name: string, m: MatchResult): string {
    const firstName = name.split(' ')[0]
    const listing = m.listing
    if (ch === 'whatsapp') {
      return `Bonjour ${firstName}, j'ai un bien qui pourrait vous intéresser : ${listing.title}, ${listing.address} à ${listing.city}. Prix : ${formatCHF(listing.price)}. ${listing.rooms} pièces, ${listing.surface_m2} m². Souhaitez-vous planifier une visite ?`
    }
    return `Bonjour ${firstName},\n\nSuite à notre échange, j'ai le plaisir de vous présenter un bien qui correspond à vos critères :\n\n${listing.title}\n${listing.address}, ${listing.city}\nPrix : ${formatCHF(listing.price)}\n${listing.rooms} pièces · ${listing.surface_m2} m²\n\nCe bien présente les caractéristiques suivantes :\n- ${Object.entries(listing.features).slice(0, 4).map(([k, v]) => `${k} : ${v}`).join('\n- ')}\n\nSouhaitez-vous organiser une visite ? Je reste à votre disposition.\n\nCordialement,\nGregory Lyonnet\nMEGGA Immobilier`
  }

  function handleSend() {
    if (!match) return
    onSend(match.id, channel)
    onClose()
  }

  if (!match) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Envoyer le bien à {contactName}</DialogTitle>
          <DialogDescription>
            {match.listing.title} — {formatCHF(match.listing.price)} — Score {match.score}%
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Channel selector */}
          <div>
            <p className="text-xs font-medium text-primary-700 mb-2">Canal d'envoi</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setChannel('email'); setMessage('') }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-button text-sm font-medium border transition-colors',
                  channel === 'email'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-primary-600 hover:bg-section'
                )}
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
              <button
                onClick={() => { setChannel('whatsapp'); setMessage('') }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-button text-sm font-medium border transition-colors',
                  channel === 'whatsapp'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-border text-primary-600 hover:bg-section'
                )}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </button>
            </div>
          </div>

          {/* Message preview / edit */}
          <div>
            <p className="text-xs font-medium text-primary-700 mb-2">Message</p>
            <textarea
              value={message || template}
              onChange={(e) => setMessage(e.target.value)}
              rows={channel === 'whatsapp' ? 4 : 10}
              className="w-full text-sm text-primary-700 bg-section border border-border rounded-input p-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-primary-700 border border-border rounded-button hover:bg-section transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSend}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-button transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              Envoyer
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
