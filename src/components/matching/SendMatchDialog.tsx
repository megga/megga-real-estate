import { useState } from 'react'
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
  const [channel, setChannel] = useState<Channel>('email')
  const [message, setMessage] = useState('')
  const sendMutation = useSendMatchToClient()

  const name = propContactName || match?.contactName || 'Contact'
  const listing = match?.listing

  const template = match && listing ? generateTemplate(channel, name, listing) : ''

  function generateTemplate(
    ch: Channel,
    n: string,
    l: MatchResult['listing'],
  ): string {
    const firstName = n.split(' ')[0]
    if (ch === 'whatsapp') {
      return `Bonjour ${firstName}, j'ai un bien qui pourrait vous intéresser : ${l.title}, ${l.address} à ${l.city}. Prix : ${formatCHF(l.price)}. ${l.rooms} pièces, ${l.surface_m2} m². Souhaitez-vous planifier une visite ?`
    }
    return `Bonjour ${firstName},\n\nSuite à notre échange, j'ai le plaisir de vous présenter un bien qui correspond à vos critères :\n\n${l.title}\n${l.address}, ${l.city}\nPrix : ${formatCHF(l.price)}\n${l.rooms} pièces · ${l.surface_m2} m²\n\nSouhaitez-vous organiser une visite ? Je reste à votre disposition.\n\nCordialement,\nGregory Lyonnet\nMEGGA Immobilier`
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
      title={`Envoyer le bien à ${name}`}
      description={`${listing.title} — ${formatCHF(listing.price)} — Score ${match.score}%`}
      size="md"
    >
        <div className="p-5 space-y-4">
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

        <div className="flex items-center justify-end gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="text-sm text-theme-secondary hover:text-theme-primary transition-colors">
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
    </Modal>
  )
}
