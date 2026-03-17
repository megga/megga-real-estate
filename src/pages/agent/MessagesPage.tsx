import { useState } from 'react'
import {
  Search, Send, MessageSquare, Clock, Building2,
} from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import EmptyState from '@/components/ui/empty-state'

interface MockThread {
  id: string
  contactName: string
  contactAvatar: string
  propertyTitle: string
  lastMessage: string
  lastMessageAt: string
  unread: boolean
  unreadCount: number
}

const MOCK_THREADS: MockThread[] = [
  {
    id: '1', contactName: 'Laurent Berset', contactAvatar: 'bg-accent',
    propertyTitle: 'Appartement Eaux-Vives',
    lastMessage: 'Bonjour, je souhaiterais planifier une visite pour cet appartement. Seriez-vous disponible cette semaine ?',
    lastMessageAt: '2026-03-17T08:30:00Z', unread: true, unreadCount: 2,
  },
  {
    id: '2', contactName: 'Sophie Müller', contactAvatar: 'bg-success',
    propertyTitle: 'Villa Cologny',
    lastMessage: 'Merci pour les documents. Je vous recontacte après discussion avec mon notaire.',
    lastMessageAt: '2026-03-16T15:45:00Z', unread: true, unreadCount: 1,
  },
  {
    id: '3', contactName: 'Hans Zimmermann', contactAvatar: 'bg-warning',
    propertyTitle: 'Duplex Champel',
    lastMessage: 'Parfait, le rendez-vous est confirmé pour vendredi à 14h.',
    lastMessageAt: '2026-03-15T12:00:00Z', unread: false, unreadCount: 0,
  },
  {
    id: '4', contactName: 'Claudine Thévenaz', contactAvatar: 'bg-danger',
    propertyTitle: 'Maison de ville Carouge',
    lastMessage: 'J\'ai bien reçu l\'estimation, nous en discuterons lors de notre prochaine rencontre.',
    lastMessageAt: '2026-03-14T09:20:00Z', unread: false, unreadCount: 0,
  },
  {
    id: '5', contactName: 'Brigitte Zufferey', contactAvatar: 'bg-primary-600',
    propertyTitle: 'Appartement Carouge',
    lastMessage: 'Est-ce que le bien est toujours disponible ?',
    lastMessageAt: '2026-03-12T17:00:00Z', unread: false, unreadCount: 0,
  },
]

const MOCK_MESSAGES = [
  { id: '1', sender: 'contact', text: 'Bonjour, je souhaiterais planifier une visite pour cet appartement.', time: '08:15' },
  { id: '2', sender: 'agent', text: 'Bonjour ! Bien sûr, je serais ravi de vous accueillir pour une visite. Quelles sont vos disponibilités ?', time: '08:22' },
  { id: '3', sender: 'contact', text: 'Seriez-vous disponible cette semaine ? Idéalement mercredi ou jeudi après-midi.', time: '08:30' },
]

function ContactAvatar({ name, color }: { name: string; color: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className={cn('h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0', color)}>
      <span className="text-xs font-semibold text-white">{initials}</span>
    </div>
  )
}

export default function MessagesPage() {
  const [selectedThread, setSelectedThread] = useState<string>(MOCK_THREADS[0].id)
  const [search, setSearch] = useState('')
  const [newMessage, setNewMessage] = useState('')

  const filteredThreads = search
    ? MOCK_THREADS.filter((t) =>
      t.contactName.toLowerCase().includes(search.toLowerCase()) ||
      t.propertyTitle.toLowerCase().includes(search.toLowerCase())
    )
    : MOCK_THREADS

  const activeThread = MOCK_THREADS.find((t) => t.id === selectedThread)

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 bg-card rounded-card shadow-card border border-border overflow-hidden">
      {/* Thread list */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Rechercher une conversation"
              className="w-full h-9 pl-9 pr-3 text-sm bg-section border-0 rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>

        {/* Threads */}
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={MessageSquare}
                title="Aucune conversation"
                description="Aucune conversation ne correspond à votre recherche."
              />
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThread(thread.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-border transition-colors',
                  selectedThread === thread.id ? 'bg-accent/5' : 'hover:bg-section/50',
                )}
              >
                <div className="flex items-start gap-3">
                  <ContactAvatar name={thread.contactName} color={thread.contactAvatar} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('text-sm truncate', thread.unread ? 'font-semibold text-primary-900' : 'font-medium text-primary-700')}>
                        {thread.contactName}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                        {formatRelativeDate(thread.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                      <span className="text-[11px] text-muted-foreground truncate">{thread.propertyTitle}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className={cn('text-xs truncate', thread.unread ? 'text-primary-900' : 'text-muted-foreground')}>
                        {thread.lastMessage}
                      </p>
                      {thread.unreadCount > 0 && (
                        <span className="h-4.5 min-w-[18px] px-1 bg-accent text-white text-[10px] font-semibold rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {activeThread ? (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-border flex items-center gap-3">
              <ContactAvatar name={activeThread.contactName} color={activeThread.contactAvatar} />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-primary-900">{activeThread.contactName}</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" aria-hidden="true" />
                  {activeThread.propertyTitle}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {MOCK_MESSAGES.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex', msg.sender === 'agent' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[70%] px-4 py-2.5 rounded-card text-sm',
                      msg.sender === 'agent'
                        ? 'bg-accent text-white'
                        : 'bg-section text-primary-900'
                    )}
                  >
                    <p>{msg.text}</p>
                    <p className={cn('text-[10px] mt-1', msg.sender === 'agent' ? 'text-white/60' : 'text-muted-foreground')}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="px-5 py-3 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Tapez votre message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  aria-label="Tapez votre message"
                  className="flex-1 h-10 px-4 text-sm bg-section border-0 rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <button
                  className="h-10 w-10 bg-accent hover:bg-accent/90 text-white rounded-button flex items-center justify-center transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-accent/20"
                  disabled={!newMessage.trim()}
                  aria-label="Envoyer"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Clock className="h-10 w-10 text-primary-200 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Sélectionnez une conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
