import { useState, useRef, useEffect } from 'react'
import { Send, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  sender: 'buyer' | 'agent'
  senderName: string
  content: string
  time: string
}

const MOCK_MESSAGES: Message[] = [
  { id: '1', sender: 'agent', senderName: 'Marie Dupont', content: "Bonjour ! J'ai bien reçu votre demande pour l'appartement à Champel. Quand seriez-vous disponible pour une visite ?", time: '14:30' },
  { id: '2', sender: 'buyer', senderName: 'Vous', content: "Bonjour Marie, merci pour votre retour rapide. Je serais disponible jeudi ou vendredi après-midi.", time: '14:45' },
  { id: '3', sender: 'agent', senderName: 'Marie Dupont', content: "Parfait, je vous propose jeudi à 15h. L'appartement est lumineux et bien situé, je pense qu'il va vous plaire. Je vous envoie l'adresse exacte par email.", time: '15:02' },
  { id: '4', sender: 'buyer', senderName: 'Vous', content: "C'est noté pour jeudi 15h. Est-ce qu'il y a un parking visiteur sur place ?", time: '15:10' },
  { id: '5', sender: 'agent', senderName: 'Marie Dupont', content: "Oui, il y a 2 places visiteurs dans le parking souterrain. Niveau -1, places 45 et 46. À jeudi !", time: '15:15' },
]

export default function BuyerMessages() {
  const [messages] = useState(MOCK_MESSAGES)
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  function handleSend() {
    if (!inputValue.trim()) return
    // TODO: send message via useMessaging hook
    setInputValue('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Messages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Échangez avec vos agents immobiliers.
        </p>
      </div>

      {/* Chat container */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col" style={{ height: '500px' }}>
        {/* Thread header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
            <User className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary">Marie Dupont</p>
            <p className="text-[11px] text-gray-400">Agent immobilier · Appartement Champel</p>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#E5E7EB transparent' }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex', msg.sender === 'buyer' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.sender === 'buyer'
                    ? 'bg-accent text-white rounded-br-md'
                    : 'bg-gray-50 text-gray-600 rounded-bl-md border border-gray-100'
                )}
              >
                {msg.sender === 'agent' && (
                  <p className="text-[11px] font-medium text-gray-400 mb-1">{msg.senderName}</p>
                )}
                <p>{msg.content}</p>
                <p className={cn(
                  'text-[10px] mt-1.5 text-right',
                  msg.sender === 'buyer' ? 'text-white/60' : 'text-gray-300'
                )}>
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 focus-within:border-accent/30 focus-within:bg-white transition-all">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Votre message..."
              className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-gray-400 min-w-0"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                inputValue.trim()
                  ? 'bg-accent text-white hover:bg-accent/90 cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
