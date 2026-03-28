import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Sparkles,
  X,
  Send,
  MapPin,
  DoorOpen,
  BedDouble,
  Maximize,
  Loader2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { ListingCardData } from '@/components/listings/ListingCard'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  listings?: ListingCardData[]
  timestamp: Date
}

interface ChatSearchProps {
  isOpen: boolean
  onClose: () => void
  onApplyFilters?: (filters: Record<string, string | string[]>) => void
  onHighlightListing?: (id: string) => void
  allListings: ListingCardData[]
  className?: string
}

// ─── LOCAL FALLBACK PARSER ──────────────────────────────────────────────────

function parseUserQueryLocal(query: string, listings: ListingCardData[]): {
  response: string
  filters: Record<string, string | string[]>
  matchingIds: string[]
} {
  const q = query.toLowerCase()
  let filtered = [...listings]
  const appliedFilters: string[] = []
  const filters: Record<string, string | string[]> = {}

  const cities = ['genève', 'geneve', 'lausanne', 'zurich', 'berne', 'lugano', 'montreux', 'nyon', 'vevey', 'sion', 'fribourg', 'champel', 'eaux-vives', 'carouge', 'plainpalais']
  const foundCity = cities.find(c => q.includes(c))
  if (foundCity) {
    const cityNorm = foundCity.charAt(0).toUpperCase() + foundCity.slice(1)
    filtered = filtered.filter(l => l.city.toLowerCase().includes(foundCity) || l.address.toLowerCase().includes(foundCity))
    appliedFilters.push(`à ${cityNorm}`)
    filters.city = cityNorm
  }

  const roomMatch = q.match(/(\d+)\s*(?:pièces?|pi[eè]ces?|p\b|rooms?)/)
  if (roomMatch) {
    const rooms = parseInt(roomMatch[1])
    filtered = filtered.filter(l => l.rooms >= rooms)
    appliedFilters.push(`${rooms}+ pièces`)
    filters.rooms = rooms.toString()
  }

  const priceMatch = q.match(/(?:max|maximum|moins de|budget|<)\s*(?:chf\s*)?(\d[\d'\s]*)/i)
  if (priceMatch) {
    const price = parseInt(priceMatch[1].replace(/['\s]/g, ''))
    filtered = filtered.filter(l => l.price <= price)
    appliedFilters.push(`budget max ${formatCHF(price)}`)
    filters.maxPrice = price.toString()
  }

  if (/appartement|appart/i.test(q)) { filters.types = ['apartment']; appliedFilters.push('appartement') }
  else if (/maison|house/i.test(q)) { filters.types = ['house']; appliedFilters.push('maison') }
  else if (/villa/i.test(q)) { filters.types = ['villa']; appliedFilters.push('villa') }

  const count = filtered.length
  const response = appliedFilters.length === 0
    ? `Pourriez-vous préciser ? Par exemple : **ville**, **pièces**, **budget**, **type de bien**.`
    : count === 0
      ? `Aucun bien pour ${appliedFilters.join(', ')}. Essayez d'élargir vos critères.`
      : `**${count} biens** trouvés (${appliedFilters.join(', ')}). Voici les plus pertinents :`

  return { response, filters, matchingIds: filtered.slice(0, 5).map(l => l.id) }
}

// ─── EXTRACT FILTERS FROM AI RESPONSE ───────────────────────────────────────

function extractFiltersFromResponse(text: string): {
  cleanText: string
  filters: Record<string, string | string[]>
} {
  const filterMatch = text.match(/FILTERS:\s*(\{[^}]+\})\s*$/)
  if (!filterMatch) return { cleanText: text, filters: {} }

  const cleanText = text.replace(/\n?FILTERS:\s*\{[^}]+\}\s*$/, '').trim()
  try {
    const raw = JSON.parse(filterMatch[1])
    const filters: Record<string, string | string[]> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (Array.isArray(v)) filters[k] = v as string[]
      else if (v != null) filters[k] = String(v)
    }
    return { cleanText, filters }
  } catch {
    return { cleanText: text, filters: {} }
  }
}

// ─── SUGGESTED QUERIES ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Appartement 3 pièces à Genève, max CHF 800\'000',
  'Villa avec jardin à Lausanne',
  'Quelque chose de lumineux à Champel',
  'Maison familiale, 5 pièces, budget 1.5M',
  'Qu\'est-ce que je peux trouver à Carouge pour 500K ?',
]

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function ChatSearch({
  isOpen,
  onClose,
  onApplyFilters,
  onHighlightListing,
  allListings,
  className,
}: ChatSearchProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [turnCount, setTurnCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'Bonjour ! Je suis votre assistant de recherche immobilière. Decrivez-moi le bien que vous cherchez en langage naturel.\n\nPar exemple : *"3 pièces lumineux à Champel, max CHF 800\'000"*',
        timestamp: new Date(),
      }])
    }
  }, [isOpen, messages.length])

  async function handleSend(text?: string) {
    const query = (text || input).trim()
    if (!query || isTyping) return

    const now = Date.now() // eslint-disable-line react-hooks/purity -- called from event handler, not render
    const userMsg: ChatMessage = {
      id: `user-${now}`,
      role: 'user',
      content: query,
      timestamp: new Date(now),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)
    setTurnCount(prev => prev + 1)

    // Build context summary of available listings
    const statsContext = (() => {
      const total = allListings.length
      const cities = [...new Set(allListings.map(l => l.city).filter(Boolean))]
      const priceRange = allListings.length > 0
        ? { min: Math.min(...allListings.map(l => l.price)), max: Math.max(...allListings.map(l => l.price)) }
        : { min: 0, max: 0 }
      return `${total} biens disponibles. Villes principales : ${cities.slice(0, 10).join(', ')}. Prix : ${formatCHF(priceRange.min)} à ${formatCHF(priceRange.max)}.`
    })()

    let aiResponse: string | null = null
    let aiFilters: Record<string, string | string[]> = {}

    // Try live Claude API via Edge Function
    try {
      historyRef.current.push({ role: 'user', content: query })

      const { data, error } = await supabase.functions.invoke('ai-copilot', {
        body: {
          action: 'chat',
          message: query,
          context: { listings_summary: statsContext, search_mode: 'public_buyer' },
          history: historyRef.current.slice(-8),
          language: 'fr',
        },
      })

      if (!error && data?.result) {
        const { cleanText, filters } = extractFiltersFromResponse(data.result)
        aiResponse = cleanText
        aiFilters = filters
        historyRef.current.push({ role: 'assistant', content: cleanText })
      }
    } catch {
      // Fallback to local parser
    }

    // Fallback: local mock parser
    if (!aiResponse) {
      const parsed = parseUserQueryLocal(query, allListings)
      aiResponse = parsed.response
      aiFilters = parsed.filters
    }

    // Find matching listings from filters
    let matchingListings: ListingCardData[] = []
    if (Object.keys(aiFilters).length > 0) {
      let matches = [...allListings]
      if (aiFilters.city) matches = matches.filter(l => l.city.toLowerCase().includes((aiFilters.city as string).toLowerCase()) || l.address.toLowerCase().includes((aiFilters.city as string).toLowerCase()))
      if (aiFilters.canton) matches = matches.filter(l => l.canton === aiFilters.canton)
      if (aiFilters.rooms) matches = matches.filter(l => l.rooms >= Number(aiFilters.rooms))
      if (aiFilters.bedrooms) matches = matches.filter(l => l.bedrooms >= Number(aiFilters.bedrooms))
      if (aiFilters.maxPrice) matches = matches.filter(l => l.price <= Number(aiFilters.maxPrice))
      if (aiFilters.minPrice) matches = matches.filter(l => l.price >= Number(aiFilters.minPrice))
      if (aiFilters.minSurface) matches = matches.filter(l => l.surface_m2 >= Number(aiFilters.minSurface))
      if (Array.isArray(aiFilters.types) && aiFilters.types.length > 0) matches = matches.filter(l => (aiFilters.types as string[]).includes(l.type || ''))
      matchingListings = matches.slice(0, 5)
    }

    // Add agent suggestion after 8 turns
    if (turnCount >= 7) {
      aiResponse += '\n\n---\n\nVous avez explore plusieurs options. Pour une recherche plus ciblee, je vous recommande de **contacter un agent MEGGA**.'
    }

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`, // eslint-disable-line react-hooks/purity -- called from event handler
      role: 'assistant',
      content: aiResponse,
      listings: matchingListings.length > 0 ? matchingListings : undefined,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, assistantMsg])
    setIsTyping(false)

    // Apply filters to search page
    if (onApplyFilters && Object.keys(aiFilters).length > 0) {
      onApplyFilters(aiFilters)
    }
  }

  function handleReset() {
    setMessages([])
    setTurnCount(0)
    setInput('')
    historyRef.current = []
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed bottom-0 right-0 z-50 w-full sm:w-[420px] h-[85vh] sm:h-[600px] sm:bottom-6 sm:right-6',
        'bg-white rounded-t-2xl sm:rounded-2xl shadow-modal border border-gray-200',
        'flex flex-col overflow-hidden',
        'animate-in slide-in-from-bottom-4 duration-300',
        className
      )}
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Recherche assistee</h3>
            <p className="text-[11px] text-gray-400">Propulse par Claude AI</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 1 && (
            <button
              onClick={handleReset}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Nouvelle conversation"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* ─── Messages ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.role === 'assistant' ? (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3 text-accent" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="bg-gray-50 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-gray-700 leading-relaxed">
                    {msg.content.split('\n').map((line, i) => {
                      if (line === '---') return <hr key={i} className="my-2 border-gray-200" />
                      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
                      return (
                        <p key={i} className={cn(i > 0 && 'mt-1.5')}>
                          {parts.map((part, j) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={j} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
                            }
                            if (part.startsWith('*') && part.endsWith('*')) {
                              return <em key={j} className="text-gray-500">{part.slice(1, -1)}</em>
                            }
                            if (part.startsWith('- ')) {
                              return <span key={j} className="block ml-2">{'•'} {part.slice(2)}</span>
                            }
                            return <span key={j}>{part}</span>
                          })}
                        </p>
                      )
                    })}
                  </div>

                  {/* Listing cards */}
                  {msg.listings && msg.listings.length > 0 && (
                    <div className="space-y-2">
                      {msg.listings.map(listing => (
                        <button
                          key={listing.id}
                          onClick={() => onHighlightListing?.(listing.id)}
                          className="w-full flex gap-3 p-2.5 bg-white rounded-xl border border-gray-100 hover:border-accent/30 hover:shadow-sm transition-all text-left cursor-pointer group"
                        >
                          <div className="w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                            {listing.photos?.[0] && (
                              <img
                                src={listing.photos[0]}
                                alt={listing.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-accent transition-colors">
                              {formatCHF(listing.price)}
                              {listing.context === 'rent' && <span className="text-gray-400 font-normal">/mois</span>}
                            </p>
                            <p className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {listing.address}, {listing.city}
                            </p>
                            <div className="flex items-center gap-2.5 mt-1 text-[11px] text-gray-400">
                              <span className="flex items-center gap-0.5">
                                <DoorOpen className="w-3 h-3" />
                                {listing.rooms}p
                              </span>
                              <span className="flex items-center gap-0.5">
                                <BedDouble className="w-3 h-3" />
                                {listing.bedrooms}ch
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Maximize className="w-3 h-3" />
                                {formatSurface(listing.surface_m2)}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-accent flex-shrink-0 self-center transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <div className="bg-accent text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm max-w-[85%]">
                  {msg.content}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3 h-3 text-accent" />
            </div>
            <div className="bg-gray-50 rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                <span className="text-xs text-gray-400">Claude reflechit...</span>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions (only after welcome) */}
        {messages.length === 1 && !isTyping && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] text-gray-300 uppercase tracking-wider font-medium px-1">
              Suggestions
            </p>
            {SUGGESTIONS.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSend(suggestion)}
                className="w-full text-left px-3.5 py-2.5 bg-white rounded-xl border border-gray-100 hover:border-accent/30 hover:bg-accent/5 text-sm text-gray-600 hover:text-accent transition-all cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Disclaimer ─── */}
      <div className="px-4 py-1">
        <p className="text-[10px] text-gray-300 text-center">
          Propulse par Claude AI. Informations indicatives — consultez un agent pour des conseils personnalises.
        </p>
      </div>

      {/* ─── Input ─── */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-4 py-2.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Decrivez ce que vous cherchez..."
            className="flex-1 text-sm bg-transparent border-0 outline-none text-gray-900 placeholder:text-gray-400"
            disabled={isTyping}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer flex-shrink-0',
              input.trim() && !isTyping
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
