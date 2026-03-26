import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Sparkles, X, Send, Loader2, RotateCcw, Copy, Check, Mic } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useCopilot } from '@/hooks/useCopilot'
import { useCopilotContext } from '@/hooks/useCopilotContext'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useContactMemory } from '@/hooks/useContactMemory'
import { buildContactContext, getContextSummary, enrichWithScores } from '@/lib/copilotContext'
import { useContactScore } from '@/hooks/useScoreEngine'
import { fetchMarketComparables } from '@/lib/marketContext'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const STORAGE_KEY = 'megga-copilot-history'
const MAX_MESSAGES = 50

function loadHistory(): CopilotMessage[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as CopilotMessage[]
      return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) })).slice(-MAX_MESSAGES)
    }
  } catch { /* ignore */ }
  return [{
    id: 'welcome',
    role: 'assistant',
    content: 'Bonjour Gregory ! Je suis MEGGA AI, votre assistant intelligent. Demandez-moi un résumé, une relance, des suggestions de matching, ou les prochaines actions.',
    timestamp: new Date(),
  }]
}

function saveHistory(messages: CopilotMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)))
  } catch { /* ignore */ }
}

// ─── MESSAGE RENDERING ──────────────────────────────────────────────────────

function isEmailResponse(content: string): boolean {
  return content.includes('**Objet :**') || content.includes('**Objet:**')
}

function EmailBlock({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    // Strip markdown formatting for clipboard
    const plain = content
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
    await navigator.clipboard.writeText(plain)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <div className="bg-theme-section rounded-lg border border-theme-border p-3 text-sm text-theme-secondary leading-relaxed">
        <MessageContent content={content} />
      </div>
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-theme-tertiary hover:text-accent transition-colors"
      >
        {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copié' : 'Copier l\'email'}
      </button>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  return (
    <>
      {content.split('\n').map((line, i) => {
        if (line === '') return <br key={i} />
        // Parse markdown links [text](url)
        const parts = line.split(/(\[([^\]]+)\]\(([^)]+)\)|\*\*[^*]+\*\*|\*[^*]+\*)/)
        return (
          <p key={i} className={cn(i > 0 && 'mt-1')}>
            {parts.map((part, j) => {
              if (!part) return null
              // Markdown link
              const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
              if (linkMatch) {
                const [, text, url] = linkMatch
                if (url.startsWith('/dashboard')) {
                  return <Link key={j} to={url} className="text-accent hover:underline font-medium">{text}</Link>
                }
                return <span key={j} className="text-accent font-medium">{text}</span>
              }
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
    </>
  )
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function CopilotPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<CopilotMessage[]>(loadHistory)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const handleSendRef = useRef<(text?: string) => void>(null)
  const { sendMessageStream, detectAction } = useCopilot()
  const { activeContact } = useCopilotContext()
  const { memory: contactMemory } = useContactMemory(activeContact?.id)
  const { score: contactScore } = useContactScore(activeContact?.id)

  // Speech recognition — auto-sends when agent stops speaking
  const handleVoiceTranscript = useCallback((transcript: string) => {
    if (transcript.trim()) {
      handleSendRef.current?.(transcript)
    }
  }, [])
  const { isListening, transcript: voiceTranscript, isSupported: voiceSupported, startListening, stopListening } = useSpeechRecognition({
    lang: 'fr-CH',
    onFinalTranscript: handleVoiceTranscript,
  })

  // Show voice transcript in real-time in input
  useEffect(() => {
    if (isListening && voiceTranscript) {
      setInput(voiceTranscript)
    }
  }, [isListening, voiceTranscript])

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) saveHistory(messages)
  }, [messages])

  const suggestions = useMemo(() => {
    if (activeContact) {
      const name = activeContact.firstName
      return [
        `Résume-moi ${name}`,
        `Rédige une relance pour ${name}`,
        `Quels biens proposer à ${name} ?`,
        `Analyse le positionnement marché pour ${name}`,
      ]
    }
    return [
      'Résume-moi mon portefeuille',
      'Quelles sont les prochaines actions ?',
      'Rédige une relance pour mon client',
      'Quels biens proposer à mes acheteurs ?',
    ]
  }, [activeContact])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const handleSend = useCallback(async (text?: string) => {
    const query = (text || input).trim()
    if (!query || isTyping) return

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)
    setStreamingContent('')

    try {
      // Build enriched context from contact memory (interactions, visits, matches, transactions)
      const context: Record<string, unknown> = contactMemory?.contact
        ? buildContactContext(contactMemory)
        : activeContact
          ? { contact: { name: `${activeContact.firstName} ${activeContact.lastName}`, type: activeContact.type, email: activeContact.email, phone: activeContact.phone } }
          : {}

      // Enrich with Score Engine data
      enrichWithScores(context, contactScore ?? null)

      // Enrich with market data if the action is market analysis
      const action = detectAction(query)
      if (action === 'analyze_market') {
        try {
          const criteria = contactMemory?.contact?.search_criteria as Record<string, unknown> | null
          const { context: marketCtx } = await fetchMarketComparables({
            city: (criteria?.city as string) ?? contactMemory?.contact?.search_zones?.[0],
            canton: contactMemory?.contact?.search_zones?.[0],
            type: criteria?.type as string,
            rooms: criteria?.rooms_min as number,
            price: contactMemory?.contact?.budget_announced ?? contactMemory?.contact?.budget_estimated_ai ?? undefined,
          })
          context.market_analysis = marketCtx
        } catch {
          context.market_analysis = 'Données marché indisponibles.'
        }
      }

      let fullContent = ''
      await sendMessageStream(query, context, (chunk) => {
        fullContent += chunk
        setStreamingContent(fullContent)
      })

      const assistantMsg: CopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      const errorMsg: CopilotMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Veuillez réessayer.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsTyping(false)
      setStreamingContent(null)
    }
  }, [input, isTyping, sendMessageStream, detectAction, activeContact, contactMemory, contactScore])

  // Keep ref in sync for voice callback
  handleSendRef.current = handleSend

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  function handleReset() {
    const welcome: CopilotMessage = {
      id: 'welcome',
      role: 'assistant',
      content: 'Bonjour Gregory ! Comment puis-je vous aider ?',
      timestamp: new Date(),
    }
    setMessages([welcome])
    localStorage.removeItem(STORAGE_KEY)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-5 md:right-5 z-50 h-10 w-10 rounded-xl border border-theme-border bg-theme-card hover:bg-theme-hover text-theme-tertiary hover:text-theme-primary shadow-sm hover:shadow-md flex items-center justify-center transition-all duration-200"
          title="MEGGA AI"
        >
          <Sparkles className="h-4 w-4" />
        </button>
      )}

      {isOpen && (
        <>
          <div className="fixed inset-0 bg-theme-overlay/30 z-40 sm:hidden" onClick={() => setIsOpen(false)} />

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
                  {contactMemory?.contact ? (
                    <p className="text-[11px] text-accent truncate max-w-[250px]">{getContextSummary(contactMemory)}</p>
                  ) : activeContact ? (
                    <p className="text-[11px] text-accent">Contexte : {activeContact.firstName} {activeContact.lastName}</p>
                  ) : (
                    <p className="text-[11px] text-theme-tertiary">Votre assistant intelligent</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 1 && (
                  <button onClick={handleReset} className="w-8 h-8 rounded-lg hover:bg-theme-hover flex items-center justify-center transition-colors" title="Nouvelle conversation">
                    <RotateCcw className="w-3.5 h-3.5 text-theme-tertiary" />
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-lg hover:bg-theme-hover flex items-center justify-center transition-colors">
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
                          {isEmailResponse(msg.content) ? (
                            <EmailBlock content={msg.content} />
                          ) : (
                            <MessageContent content={msg.content} />
                          )}
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

              {/* Streaming message */}
              {isTyping && streamingContent !== null && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-theme-hover rounded-2xl rounded-tl-md px-4 py-3 text-sm text-theme-secondary leading-relaxed">
                      {streamingContent ? (
                        <MessageContent content={streamingContent} />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                          <span className="text-xs text-theme-tertiary">Analyse en cours...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {messages.length === 1 && !isTyping && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] text-theme-tertiary uppercase tracking-wider font-medium px-1">Suggestions</p>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => handleSend(s)} className="w-full text-left px-3.5 py-2.5 bg-transparent rounded-xl border border-theme-border-subtle hover:border-accent/30 hover:bg-accent/5 text-sm text-theme-secondary hover:text-accent transition-all cursor-pointer">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Disclaimer */}
            <div className="px-4 py-1">
              <p className="text-[10px] text-theme-tertiary text-center">Assistance IA — les suggestions sont indicatives et doivent être validées.</p>
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2">
              <div className={cn(
                'flex items-center gap-2 bg-transparent rounded-xl border px-4 py-2.5 transition-all',
                isListening
                  ? 'border-red-500/50 ring-2 ring-red-500/20'
                  : 'border-theme-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20'
              )}>
                {/* Voice button */}
                {voiceSupported && (
                  <button
                    onClick={toggleVoice}
                    disabled={isTyping}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                      isListening
                        ? 'text-red-500 animate-pulse'
                        : 'text-theme-tertiary hover:text-theme-primary',
                      isTyping && 'opacity-50 cursor-not-allowed'
                    )}
                    title={isListening ? 'Arrêter la dictée' : 'Dicter un message'}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? 'Parlez maintenant...' : activeContact ? `Demandez à propos de ${activeContact.firstName}...` : 'Demandez-moi quelque chose...'}
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
