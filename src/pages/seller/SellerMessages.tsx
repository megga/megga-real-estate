import { Send } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { SELLER_MESSAGES } from './sellerMockData'

export default function SellerMessages() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Messages</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Conversation avec votre agent
        </p>
      </div>

      {/* Chat thread */}
      <div className="bg-white rounded-card border border-border">
        {/* Messages */}
        <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
          {SELLER_MESSAGES.map((msg) => {
            const isAgent = msg.sender === 'agent'
            return (
              <div key={msg.id} className={cn('flex', isAgent ? 'justify-start' : 'justify-end')}>
                <div className={cn('max-w-[80%] space-y-1')}>
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
                    <span>{formatRelativeDate(msg.timestamp)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Écrire un message..."
              className="flex-1 h-10 px-4 bg-section rounded-input text-sm text-primary-900 placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-accent/20"
              disabled
            />
            <button
              className="h-10 w-10 rounded-button bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-colors opacity-50 cursor-not-allowed"
              disabled
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            La messagerie sera disponible prochainement.
          </p>
        </div>
      </div>
    </div>
  )
}
