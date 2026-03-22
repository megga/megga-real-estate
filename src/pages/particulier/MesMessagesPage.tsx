import { useState, useRef, useEffect } from 'react'
import { Send, Check, CheckCheck, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_SELLER_DATA, MOCK_SELLER_MESSAGES, type SellerMessage } from '@/lib/mockSellerData'

// ── Date helpers ─────────────────────────────────────────────────────────

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000)

  if (diffDays === 0) return 'Aujourd\'hui'
  if (diffDays === 1) return 'Hier'
  return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
}

function groupMessagesByDay(messages: SellerMessage[]): { label: string; messages: SellerMessage[] }[] {
  const groups: { label: string; messages: SellerMessage[] }[] = []

  for (const msg of messages) {
    const label = formatDayLabel(msg.created_at)
    const existing = groups.find(g => g.label === label)
    if (existing) {
      existing.messages.push(msg)
    } else {
      groups.push({ label, messages: [msg] })
    }
  }

  return groups
}

// ── Main component ───────────────────────────────────────────────────────

export default function MesMessagesPage() {
  const { agent } = MOCK_SELLER_DATA
  const [messages, setMessages] = useState(MOCK_SELLER_MESSAGES)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend() {
    const text = input.trim()
    if (!text) return

    const newMsg: SellerMessage = {
      id: `msg-new-${Date.now()}`,
      sender: 'seller',
      sender_name: 'Vous',
      content: text,
      created_at: new Date().toISOString(),
      read: false,
    }

    setMessages(prev => [...prev, newMsg])
    setInput('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const grouped = groupMessagesByDay(messages)
  const agentInitials = agent.name.split(' ').map(n => n[0]).join('')

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <h1 className="text-2xl font-semibold text-theme-primary">Messages</h1>
        <p className="text-sm text-theme-secondary mt-1">Votre conversation avec {agent.name}</p>
      </div>

      {/* Conversation container */}
      <div className="flex-1 flex flex-col rounded-xl border border-theme-border overflow-hidden min-h-0">

        {/* Agent header bar */}
        <div className="shrink-0 px-4 py-3 border-b border-theme-border flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center shrink-0">
            {agentInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-theme-primary">{agent.name}</p>
            <p className="text-[10px] text-theme-tertiary">MEGGA Immobilier · Votre agent</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-theme-tertiary">En ligne</span>
          </div>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-hide">
          {grouped.map((group) => (
            <div key={group.label}>
              {/* Day separator */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-theme-border-subtle" />
                <span className="text-[10px] text-theme-muted font-medium uppercase tracking-wider">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-theme-border-subtle" />
              </div>

              {/* Messages in this day */}
              <div className="space-y-3">
                {group.messages.map((msg) => {
                  const isAgent = msg.sender === 'agent'

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex items-end gap-2',
                        isAgent ? 'justify-start' : 'justify-end'
                      )}
                    >
                      {/* Agent avatar */}
                      {isAgent && (
                        <div className="h-6 w-6 rounded-full bg-accent text-white text-[9px] font-semibold flex items-center justify-center shrink-0 mb-0.5">
                          {agentInitials}
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={cn(
                          'max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                          isAgent
                            ? 'border border-theme-border text-theme-primary rounded-bl-md'
                            : 'bg-theme-hover text-theme-primary border border-theme-border rounded-br-md'
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <div className={cn(
                          'flex items-center gap-1 mt-1',
                          isAgent ? 'justify-start' : 'justify-end'
                        )}>
                          <span className="text-[10px] text-theme-muted">
                            {formatMessageTime(msg.created_at)}
                          </span>
                          {!isAgent && (
                            msg.read ? (
                              <CheckCheck className="w-3 h-3 text-accent" />
                            ) : (
                              <Check className="w-3 h-3 text-theme-muted" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-theme-border px-3 py-2.5 flex items-center gap-2">
          <button
            className="p-2 rounded-lg text-theme-tertiary hover:text-theme-secondary hover:bg-theme-hover transition-colors"
            title="Joindre un fichier"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez un message..."
            className="flex-1 h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              'p-2 rounded-lg transition-colors',
              input.trim()
                ? 'text-accent hover:bg-accent/10'
                : 'text-theme-muted cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
