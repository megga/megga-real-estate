import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, Send, Loader2, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ALL_ARTICLES, type HelpArticle } from '@/lib/helpArticles'

// ── Types ───────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  suggestedArticles?: { slug: string; title: string; category: string }[]
  shouldEscalate?: boolean
}

// ── Build articles context for the Edge Function ────────────────────────

const ARTICLES_CONTEXT = ALL_ARTICLES
  .map(a => `${a.category}/${a.slug} — ${a.title}: ${a.description}`)
  .join('\n')

// ── Chatbot Component ───────────────────────────────────────────────────

export default function HelpChatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input on open
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }))

      const { data, error } = await supabase.functions.invoke('support-chatbot', {
        body: {
          message: text,
          history,
          language: 'fr',
          articlesContext: ARTICLES_CONTEXT,
        },
      })

      if (error) throw error

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'Je ne peux pas répondre pour le moment.',
        suggestedArticles: data.suggestedArticles || [],
        shouldEscalate: data.shouldEscalate || false,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      // Fallback: local fuzzy search
      const FuseModule = (await import('fuse.js')).default
      const fuse = new FuseModule(ALL_ARTICLES, { threshold: 0.4, keys: ['title', 'description', 'keywords'] as const })
      const results = fuse.search(text).slice(0, 3) as { item: HelpArticle }[]

      const fallbackContent = results.length > 0
        ? `Voici ce que j'ai trouvé :\n\n${results.map((r: { item: HelpArticle }) => `- [${r.item.title}](/aide/${r.item.category}/${r.item.slug})`).join('\n')}`
        : "Je n'ai pas trouvé de réponse. Vous pouvez envoyer un ticket à notre équipe."

      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: fallbackContent,
        suggestedArticles: results.map((r: { item: HelpArticle }) => ({ slug: r.item.slug, title: r.item.title, category: r.item.category })),
        shouldEscalate: results.length === 0,
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Render button (when closed) ────────────────────────────────────

  const button = (
    <button
      onClick={() => setOpen(true)}
      className="h-10 px-5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors flex items-center gap-2"
    >
      <Sparkles className="h-4 w-4" />
      MEGGA AI
    </button>
  )

  if (!open) return button

  // ── Render panel (when open) ───────────────────────────────────────

  return (
    <>
      {button}
      {createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[75vh] animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gray-900 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">MEGGA AI Support</p>
                  <p className="text-[10px] text-gray-400">Assistance instantanée</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-hide">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Sparkles className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Posez votre question sur MEGGA</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {['Comment importer mes contacts ?', 'Comment fonctionne le KYC ?', 'Quels sont les raccourcis clavier ?'].map(q => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); setTimeout(handleSend, 100) }}
                        className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id}>
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                    msg.role === 'user'
                      ? 'ml-auto bg-gray-900 text-white'
                      : 'bg-gray-50 text-gray-700'
                  )}>
                    <p className="whitespace-pre-wrap leading-relaxed">{renderContent(msg.content)}</p>
                  </div>

                  {/* Suggested articles */}
                  {msg.suggestedArticles && msg.suggestedArticles.length > 0 && (
                    <div className="mt-2 space-y-1.5 max-w-[85%]">
                      {msg.suggestedArticles.map(a => (
                        <Link
                          key={a.slug}
                          to={`/aide/${a.category}/${a.slug}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:border-gray-300 transition-colors text-xs text-gray-600 hover:text-gray-900"
                        >
                          <span className="flex-1">{a.title}</span>
                          <ArrowRight className="h-3 w-3 flex-shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Escalate button */}
                  {msg.shouldEscalate && (
                    <div className="mt-2 max-w-[85%]">
                      <Link
                        to="/aide/contact"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:border-gray-400 transition-colors"
                      >
                        Envoyer un ticket
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  MEGGA AI réfléchit...
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Posez votre question..."
                  rows={1}
                  className="flex-1 resize-none text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 max-h-[100px]"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="h-9 w-9 rounded-lg bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors disabled:opacity-30 flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// ── Simple markdown link renderer ───────────────────────────────────────

function renderContent(text: string): React.ReactNode {
  // Convert [text](url) to clickable links
  const parts = text.split(/(\[.+?\]\(.+?\))/)
  return parts.map((part, i) => {
    const match = part.match(/\[(.+?)\]\((.+?)\)/)
    if (match) {
      return (
        <Link key={i} to={match[2]} className="underline text-accent hover:text-accent/80">
          {match[1]}
        </Link>
      )
    }
    return part
  })
}
