import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useMessaging } from '@/hooks/useMessaging'
import { useAuth } from '@/hooks/useAuth'

export default function SellerMessages() {
  const { profile } = useAuth()

  // Get threads first
  const { threads, isLoadingThreads } = useMessaging(null)

  // Find the seller's thread
  const sellerThread = threads.find((t) => t.contact_type === 'seller') ?? threads[0] ?? null
  const threadId = sellerThread?.id ?? null

  // Get messages for that thread
  const { messages: threadMessages, sendMessage, isSending } = useMessaging(threadId)

  const [messageText, setMessageText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [threadMessages])

  async function handleSend() {
    if (!messageText.trim() || !threadId) return
    try {
      await sendMessage({
        content: messageText.trim(),
        senderType: 'contact',
        senderName: profile?.full_name ?? 'Vendeur',
      })
      setMessageText('')
    } catch {
      // Error handled by React Query
    }
  }

  if (isLoadingThreads) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Messages</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {sellerThread ? `Conversation avec ${sellerThread.contact_name === profile?.full_name ? 'votre agent' : sellerThread.contact_name}` : 'Conversation avec votre agent'}
        </p>
      </div>

      <div className="bg-white rounded-card border border-border">
        {/* Messages */}
        <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
          {threadMessages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Aucun message pour le moment.</p>
              <p className="text-xs text-gray-400 mt-1">Envoyez un message à votre agent pour démarrer la conversation.</p>
            </div>
          ) : (
            threadMessages.map((msg) => {
              const isAgent = msg.sender_type === 'agent'
              return (
                <div key={msg.id} className={cn('flex', isAgent ? 'justify-start' : 'justify-end')}>
                  <div className="max-w-[80%] space-y-1">
                    <div
                      className={cn(
                        'rounded-xl px-4 py-2.5 text-sm',
                        isAgent
                          ? 'bg-section text-primary-900 rounded-bl-sm'
                          : 'bg-accent text-white rounded-br-sm'
                      )}
                    >
                      {msg.content}
                    </div>
                    <div className={cn('flex items-center gap-2 text-[10px] text-muted-foreground', !isAgent && 'justify-end')}>
                      <span className="font-medium">{msg.sender_name}</span>
                      <span>·</span>
                      <span>{formatRelativeDate(msg.created_at)}</span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Écrire un message..."
              className="flex-1 h-10 px-4 bg-section rounded-input text-sm text-primary-900 placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/20"
              disabled={!threadId}
            />
            <button
              onClick={handleSend}
              disabled={isSending || !messageText.trim() || !threadId}
              className={cn(
                'h-10 w-10 rounded-button bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-colors',
                (!messageText.trim() || isSending || !threadId) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
