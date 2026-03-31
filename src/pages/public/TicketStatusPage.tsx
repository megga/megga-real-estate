import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useTicketByToken, useAddMessage } from '@/hooks/useTickets'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: 'Nouveau', color: 'bg-blue-500' },
  open: { label: 'En cours', color: 'bg-amber-500' },
  pending: { label: 'En attente', color: 'bg-gray-400' },
  on_hold: { label: 'En pause', color: 'bg-gray-400' },
  resolved: { label: 'Résolu', color: 'bg-emerald-500' },
  closed: { label: 'Fermé', color: 'bg-gray-300' },
}

export default function TicketStatusPage() {
  const { ticketNumber } = useParams<{ ticketNumber: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { data, isLoading } = useTicketByToken(ticketNumber, token)
  const addMessage = useAddMessage()
  const [reply, setReply] = useState('')

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!reply.trim() || !data) return
    await addMessage.mutateAsync({
      ticketId: data.ticket.id,
      authorType: 'customer',
      authorName: data.ticket.submitter_name,
      body: reply.trim(),
    })
    setReply('')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
        <Footer />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <p className="text-gray-500">Ticket introuvable ou lien invalide.</p>
        </div>
        <Footer />
      </div>
    )
  }

  const { ticket, messages } = data
  const status = STATUS_LABELS[ticket.status] || STATUS_LABELS.new

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">MEGGA Support</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Ticket {ticket.ticket_number}</h1>
        <p className="text-sm text-gray-700 mb-2">{ticket.subject}</p>
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-8">
          <span className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', status.color)} />
            {status.label}
          </span>
          <span>Créé le {new Date(ticket.created_at).toLocaleDateString('fr-CH')}</span>
        </div>

        {/* Messages */}
        <div className="space-y-4 mb-8">
          {messages.map(msg => {
            const isCustomer = msg.author_type === 'customer'
            return (
              <div key={msg.id} className={cn('rounded-lg p-4 border', isCustomer ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100')}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {isCustomer ? 'Vous' : 'Équipe MEGGA'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.created_at).toLocaleDateString('fr-CH')} à {new Date(msg.created_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.body}</p>
              </div>
            )
          })}
        </div>

        {/* Reply form */}
        {ticket.status !== 'closed' && (
          <form onSubmit={handleReply} className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Votre réponse</label>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={4}
              placeholder="Écrivez votre message..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
            />
            <button
              type="submit"
              disabled={addMessage.isPending || !reply.trim()}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {addMessage.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Envoyer
            </button>
          </form>
        )}
      </div>
      <Footer />
    </div>
  )
}
