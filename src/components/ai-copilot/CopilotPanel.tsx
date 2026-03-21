import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, X, Send, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ─── MOCK RESPONSES ─────────────────────────────────────────────────────────

const MOCK_RESPONSES: Record<string, string> = {
  résumé: `**Résumé du portefeuille actif :**\n\n• **12 contacts actifs** dont 5 acheteurs chauds\n• **8 transactions en cours** — valeur totale CHF 9.2M\n• **3 relances en retard** à traiter aujourd'hui\n• **2 nouveaux matchs** détectés ce matin\n\nPriorité : relancer M. Dupont (intérêt confirmé, visite il y a 5 jours sans feedback).`,

  relance: `**Suggestion de relance pour votre client :**\n\n*Objet : Nouvelles opportunités correspondant à vos critères*\n\nBonjour [Prénom],\n\nJ'espère que vous allez bien. Suite à notre dernier échange, j'ai identifié 2 nouveaux biens qui pourraient vous intéresser :\n\n1. Appartement 4p à Champel — CHF 980'000\n2. 3p rénové Eaux-Vives — CHF 750'000\n\nSouhaitez-vous organiser une visite cette semaine ?\n\nCordialement,\n[Votre nom]`,

  matching: `**Shortlist de matching pour vos clients actifs :**\n\n🏠 **M. Dupont** (budget CHF 1.2M, 4p Eaux-Vives)\n→ 3 pièces rue du Rhône — **92% compatible**\n→ 4 pièces bd des Tranchées — **85% compatible**\n\n🏠 **Mme Favre** (budget CHF 800K, 3p Champel)\n→ 3 pièces av. de Champel — **88% compatible**\n\n🏠 **M. Weber** (budget CHF 650K, studio/2p centre)\n→ 2 pièces Plainpalais — **78% compatible**`,

  actions: `**Prochaines actions prioritaires :**\n\n1. 🔴 **Urgent** — Relancer M. Müller (offre en attente depuis 5 jours)\n2. 🟠 **Important** — Demander feedback visite Mme Favre (visite hier)\n3. 🔵 **Normal** — Envoyer 2 nouveaux biens à M. Dupont (matchs détectés)\n4. 🟢 **Suggestion** — Mettre à jour le prix du bien rue de la Terrassière (stagnation 45 jours)`,

  objections: `**Analyse des objections récentes :**\n\n📊 **Top 3 objections (15 dernières visites) :**\n\n1. **Prix trop élevé** — mentionné 6 fois (40%)\n   → Suggestion : revoir le positionnement prix sur 2 biens\n\n2. **Bruit / environnement** — mentionné 4 fois (27%)\n   → Suggestion : programmer les visites le week-end\n\n3. **Surface trop petite** — mentionné 3 fois (20%)\n   → Suggestion : proposer des biens avec surface supérieure`,
}

function getMockResponse(query: string): string {
  const q = query.toLowerCase()

  if (/résumé|résume|resume|portfolio|portefeuille/i.test(q)) return MOCK_RESPONSES.résumé
  if (/relance|relancer|rédige|redige|email|message|écrire|ecrire/i.test(q)) return MOCK_RESPONSES.relance
  if (/matching|match|quels?\s*biens?|proposer|compatible|shortlist/i.test(q)) return MOCK_RESPONSES.matching
  if (/action|prochaine|next|priorité|priorite|quoi\s*faire|agenda/i.test(q)) return MOCK_RESPONSES.actions
  if (/objection|feedback|retour|visite|analyse/i.test(q)) return MOCK_RESPONSES.objections

  return `Je comprends votre demande. Voici ce que je peux faire pour vous :\n\n• **"résume"** — Résumé de votre portefeuille\n• **"relance [client]"** — Rédiger une relance\n• **"matching"** — Voir les biens compatibles\n• **"prochaines actions"** — Actions prioritaires\n• **"objections"** — Analyse des retours de visite\n\nEssayez une de ces commandes pour commencer.`
}

// ─── SUGGESTIONS ────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Résume-moi mon portefeuille',
  'Quelles sont les prochaines actions ?',
  'Rédige une relance pour mon client',
  'Quels biens proposer à mes acheteurs ?',
]

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function CopilotPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Bonjour Gregory ! Je suis MEGGA AI, votre assistant intelligent. Demandez-moi un résumé, une relance, des suggestions de matching, ou les prochaines actions.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const handleSend = useCallback((text?: string) => {
    const query = (text || input).trim()
    if (!query) return

    const now = Date.now()
    const userMsg: CopilotMessage = {
      id: `user-${now}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    const delay = 800 + (now % 600)
    setTimeout(() => {
      const response = getMockResponse(query)
      const assistantMsg: CopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
      setIsTyping(false)
    }, delay)
  }, [input])

  function handleReset() {
    setMessages([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-50 h-10 w-10 rounded-xl border border-theme-border bg-theme-card hover:bg-theme-hover text-theme-tertiary hover:text-theme-primary shadow-sm hover:shadow-md flex items-center justify-center transition-all duration-200"
          title="MEGGA AI"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <>
          {/* Backdrop on mobile */}
          <div
            className="fixed inset-0 bg-theme-overlay/30 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div className={cn(
            'fixed z-50',
            'bottom-0 right-0 w-full h-[85vh]',
            'sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[600px]',
            'bg-theme-elevated rounded-t-2xl sm:rounded-2xl shadow-modal border border-theme-border',
            'flex flex-col overflow-hidden',
            'animate-in slide-in-from-bottom-4 duration-300',
          )}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-theme-border-subtle">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-theme-hover flex items-center justify-center">
                  <img src="/megga-gg.svg" alt="MEGGA" className="w-4 h-4" style={{ filter: 'var(--logo-filter, none)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-theme-primary">MEGGA AI</h3>
                  <p className="text-[11px] text-theme-tertiary">Votre assistant intelligent</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 1 && (
                  <button
                    onClick={handleReset}
                    className="w-8 h-8 rounded-lg hover:bg-theme-hover flex items-center justify-center transition-colors"
                    title="Nouvelle conversation"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-theme-tertiary" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-theme-hover flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-theme-tertiary" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map(msg => (
                <div key={msg.id}>
                  {msg.role === 'assistant' ? (
                    <div className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="w-3 h-3 text-accent" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-theme-hover rounded-2xl rounded-tl-md px-4 py-3 text-sm text-theme-secondary leading-relaxed">
                          {msg.content.split('\n').map((line, i) => {
                            if (line === '') return <br key={i} />
                            const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
                            return (
                              <p key={i} className={cn(i > 0 && 'mt-1')}>
                                {parts.map((part, j) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={j} className="font-semibold text-theme-primary">{part.slice(2, -2)}</strong>
                                  }
                                  if (part.startsWith('*') && part.endsWith('*')) {
                                    return <em key={j} className="text-theme-muted">{part.slice(1, -1)}</em>
                                  }
                                  if (part.startsWith('• ') || part.startsWith('- ')) {
                                    return <span key={j} className="block ml-2">{'•'} {part.slice(2)}</span>
                                  }
                                  return <span key={j}>{part}</span>
                                })}
                              </p>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="bg-accent/10 text-theme-primary border border-accent/20 rounded-2xl rounded-tr-md px-4 py-2.5 text-sm max-w-[85%]">
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-accent" />
                  </div>
                  <div className="bg-theme-hover rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                      <span className="text-xs text-theme-tertiary">Analyse en cours...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions on first open */}
              {messages.length === 1 && !isTyping && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] text-theme-tertiary uppercase tracking-wider font-medium px-1">
                    Suggestions
                  </p>
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s)}
                      className="w-full text-left px-3.5 py-2.5 bg-transparent rounded-xl border border-theme-border-subtle hover:border-accent/30 hover:bg-accent/5 text-sm text-theme-secondary hover:text-accent transition-all cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Disclaimer */}
            <div className="px-4 py-1">
              <p className="text-[10px] text-theme-tertiary text-center">
                Assistance IA — les suggestions sont indicatives et doivent être validées.
              </p>
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2">
              <div className="flex items-center gap-2 bg-transparent rounded-xl border border-theme-border px-4 py-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Demandez-moi quelque chose..."
                  className="flex-1 text-sm bg-transparent border-0 outline-none text-theme-primary placeholder:text-theme-tertiary"
                  disabled={isTyping}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                    input.trim() && !isTyping
                      ? 'bg-accent text-white hover:bg-accent/90 cursor-pointer'
                      : 'bg-theme-active text-theme-tertiary cursor-not-allowed'
                  )}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
