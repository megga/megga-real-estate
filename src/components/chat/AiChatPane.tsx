import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Sparkles, Loader2, RotateCcw, Briefcase, ListChecks, Mail, TrendingUp } from 'lucide-react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useCopilot } from '@/hooks/useCopilot'
import { useCopilotContext } from '@/hooks/useCopilotContext'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useContactMemory } from '@/hooks/useContactMemory'
import { buildContactContext, getContextSummary, enrichWithScores } from '@/lib/copilotContext'
import { useContactScore } from '@/hooks/useScoreEngine'
import { fetchMarketComparables } from '@/lib/marketContext'
import { useAuth } from '@/hooks/useAuth'
import { MessageContent, EmailBlock } from './AiMessageBubble'

function isEmailResponse(content: string): boolean {
  return content.includes('**Objet :**') || content.includes('**Objet:**')
}
import PromptInputBar from './PromptInputBar'

// ─── Types & Storage ────────────────────────────────────────────────────────

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
  return []
}

function saveHistory(messages: CopilotMessage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES))) } catch { /* */ }
}

// ─── Animation variants ─────────────────────────────────────────────────────

const messageVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const welcomeItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
}

// ─── AI Chat Pane ───────────────────────────────────────────────────────────

export default function AiChatPane({ pendingPrompt, onPromptConsumed }: { pendingPrompt?: string | null; onPromptConsumed?: () => void } = {}) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<CopilotMessage[]>(loadHistory)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const handleSendRef = useRef<(text?: string) => void>(null)
  const { sendMessageStream, detectAction } = useCopilot()
  const { activeContact } = useCopilotContext()
  const { memory: contactMemory } = useContactMemory(activeContact?.id)
  const { score: contactScore } = useContactScore(activeContact?.id)

  // Voice
  const handleVoiceTranscript = useCallback((transcript: string) => {
    if (transcript.trim()) handleSendRef.current?.(transcript)
  }, [])
  const { isListening, transcript: voiceTranscript } = useSpeechRecognition({
    lang: 'fr-CH',
    onFinalTranscript: handleVoiceTranscript,
  })

  useEffect(() => { if (isListening && voiceTranscript) setInput(voiceTranscript) }, [isListening, voiceTranscript])
  useEffect(() => { if (messages.length > 0) saveHistory(messages) }, [messages])

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Gregory'
  const isWelcome = messages.length === 0

  const suggestions = useMemo(() => {
    if (activeContact) {
      const name = activeContact.firstName
      return [
        { label: `Résume-moi ${name}`, desc: 'Profil, interactions, scoring', icon: Briefcase },
        { label: `Rédige une relance pour ${name}`, desc: 'Email contextualisé', icon: Mail },
        { label: `Quels biens proposer à ${name} ?`, desc: 'Matching intelligent', icon: ListChecks },
        { label: `Analyse le marché pour ${name}`, desc: 'Prix, comparables, tendance', icon: TrendingUp },
      ]
    }
    return [
      { label: 'Résume-moi mon portefeuille', desc: 'Clients, deals, pipeline', icon: Briefcase },
      { label: 'Prochaines actions', desc: 'Next best actions prioritaires', icon: ListChecks },
      { label: 'Rédige une relance client', desc: 'Email ou message contextualisé', icon: Mail },
      { label: 'Analyse le marché suisse', desc: 'Tendances, prix, opportunités', icon: TrendingUp },
    ]
  }, [activeContact])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, streamingContent, scrollToBottom])

  const handleSend = useCallback(async (text?: string) => {
    const query = (text || input).trim()
    if (!query || isTyping) return

    const userMsg: CopilotMessage = { id: `user-${Date.now()}`, role: 'user', content: query, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)
    setStreamingContent('')

    try {
      const context: Record<string, unknown> = contactMemory?.contact
        ? buildContactContext(contactMemory)
        : activeContact
          ? { contact: { name: `${activeContact.firstName} ${activeContact.lastName}`, type: activeContact.type } }
          : {}

      enrichWithScores(context, contactScore ?? null)

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
        } catch { context.market_analysis = 'Données marché indisponibles.' }
      }

      let fullContent = ''
      await sendMessageStream(query, context, (chunk) => {
        fullContent += chunk
        setStreamingContent(fullContent)
      })

      setMessages(prev => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: fullContent, timestamp: new Date() }])
    } catch {
      setMessages(prev => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: 'Désolé, une erreur est survenue. Veuillez réessayer.', timestamp: new Date() }])
    } finally {
      setIsTyping(false)
      setStreamingContent(null)
    }
  }, [input, isTyping, sendMessageStream, detectAction, activeContact, contactMemory, contactScore])

  handleSendRef.current = handleSend

  // Auto-send pending prompt from contact profile "Demander à MEGGA AI"
  useEffect(() => {
    if (pendingPrompt && !isTyping) {
      handleSend(pendingPrompt)
      onPromptConsumed?.()
    }
  }, [pendingPrompt]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReset() {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <div className="flex flex-col h-full bg-theme-page">
      {/* Header — only show when in conversation */}
      {!isWelcome && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-theme-hover flex items-center justify-center">
              <img src="/megga-gg.svg" alt="" className="w-4 h-4" style={{ filter: 'var(--logo-filter, none)' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-theme-primary">MEGGA AI</h3>
              {contactMemory?.contact ? (
                <p className="text-[11px] text-accent truncate max-w-[300px]">{getContextSummary(contactMemory)}</p>
              ) : activeContact ? (
                <p className="text-[11px] text-accent">Contexte : {activeContact.firstName} {activeContact.lastName}</p>
              ) : (
                <p className="text-[11px] text-theme-tertiary">Votre assistant intelligent</p>
              )}
            </div>
          </div>
          <button onClick={handleReset} className="w-8 h-8 rounded-lg hover:bg-theme-hover flex items-center justify-center transition-colors" title="Nouvelle conversation">
            <RotateCcw className="w-3.5 h-3.5 text-theme-tertiary" />
          </button>
        </motion.div>
      )}

      {/* Main area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <AnimatePresence mode="wait">
          {isWelcome ? (
            /* ─── Welcome Screen ─── */
            <motion.div
              key="welcome"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="flex flex-col items-center justify-center h-full px-6"
            >
              {/* Greeting */}
              <motion.h1 variants={welcomeItem} className="text-[22px] font-semibold text-theme-primary text-center tracking-tight">
                Bonjour {firstName}
              </motion.h1>
              <motion.p variants={welcomeItem} className="text-[13px] text-theme-muted mt-1.5 text-center max-w-sm leading-relaxed">
                Je suis MEGGA AI, votre copilote immobilier. Clients, biens, conformité, marché suisse. Je suis là pour vous accompagner.
              </motion.p>

              {/* Suggestion cards */}
              <motion.div variants={welcomeItem} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-7 w-full max-w-lg">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => handleSend(s.label)}
                    className="text-left px-4 py-3.5 rounded-xl border border-theme-border hover:border-theme-border-focus transition-colors group flex items-start gap-3"
                  >
                    <s.icon className="w-4 h-4 text-theme-muted mt-0.5 flex-shrink-0 group-hover:text-theme-secondary transition-colors" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-theme-primary leading-tight">{s.label}</p>
                      <p className="text-[11px] text-theme-muted mt-0.5 leading-tight">{s.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            /* ─── Conversation ─── */
            <motion.div
              key="conversation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-3xl mx-auto px-6 py-4 space-y-4"
            >
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  variants={messageVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {msg.role === 'assistant' ? (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-theme-secondary leading-relaxed">
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
                      <div className="bg-accent text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm max-w-[80%]">
                        {msg.content}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Streaming */}
              {isTyping && streamingContent !== null && (
                <motion.div variants={messageVariants} initial="hidden" animate="visible" className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-theme-secondary leading-relaxed">
                      {streamingContent ? (
                        <>
                          <MessageContent content={streamingContent} />
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                            className="inline-block w-0.5 h-4 bg-accent ml-0.5 align-middle"
                          />
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                          <span className="text-xs text-theme-tertiary">Analyse en cours...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input bar — centered at bottom */}
      <div className="flex-shrink-0 px-6 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <PromptInputBar
            onSend={(text) => handleSend(text)}
            isLoading={isTyping}
            disabled={isTyping}
          />
          <p className="text-[10px] text-theme-muted text-center mt-2">
            MEGGA AI peut faire des erreurs. Les suggestions sont indicatives.
          </p>
        </div>
      </div>
    </div>
  )
}
