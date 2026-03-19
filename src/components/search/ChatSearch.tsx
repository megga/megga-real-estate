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

// ─── MOCK AI RESPONSES ──────────────────────────────────────────────────────

interface ParsedIntent {
  response: string
  filters: Record<string, string | number | string[]>
  matchingIds?: string[]
}

function parseUserQuery(query: string, listings: ListingCardData[]): ParsedIntent {
  const q = query.toLowerCase()
  let filtered = [...listings]
  const appliedFilters: string[] = []
  const filters: Record<string, string | number | string[]> = {}

  // City detection
  const cities = ['genève', 'geneve', 'lausanne', 'zurich', 'zürich', 'berne', 'bern', 'bâle', 'basel', 'lugano', 'montreux', 'nyon', 'morges', 'vevey', 'sion', 'fribourg', 'neuchâtel', 'neuchatel', 'lucerne', 'luzern', 'champel', 'eaux-vives', 'carouge', 'plainpalais', 'pâquis']
  const foundCity = cities.find(c => q.includes(c))
  if (foundCity) {
    const cityNorm = foundCity.charAt(0).toUpperCase() + foundCity.slice(1)
    filtered = filtered.filter(l => l.city.toLowerCase().includes(foundCity) || l.address.toLowerCase().includes(foundCity))
    appliedFilters.push(`à ${cityNorm}`)
    filters.city = cityNorm
  }

  // Room count
  const roomMatch = q.match(/(\d+)\s*(?:pièces?|pi[eè]ces?|p\b|rooms?)/)
  if (roomMatch) {
    const rooms = parseInt(roomMatch[1])
    filtered = filtered.filter(l => l.rooms >= rooms)
    appliedFilters.push(`${rooms}+ pièces`)
    filters.rooms = rooms.toString()
  }

  // Bedroom count
  const bedMatch = q.match(/(\d+)\s*(?:chambres?|ch\b|bedrooms?)/)
  if (bedMatch) {
    const beds = parseInt(bedMatch[1])
    filtered = filtered.filter(l => l.bedrooms >= beds)
    appliedFilters.push(`${beds}+ chambres`)
    filters.bedrooms = beds.toString()
  }

  // Price range
  const priceMatch = q.match(/(?:max|maximum|moins de|under|budget|<)\s*(?:chf\s*)?(\d[\d'\s]*)/i)
  if (priceMatch) {
    const price = parseInt(priceMatch[1].replace(/['\s]/g, ''))
    filtered = filtered.filter(l => l.price <= price)
    appliedFilters.push(`budget max ${formatCHF(price)}`)
    filters.maxPrice = price.toString()
  }

  const priceMinMatch = q.match(/(?:min|minimum|plus de|above|>)\s*(?:chf\s*)?(\d[\d'\s]*)/i)
  if (priceMinMatch) {
    const price = parseInt(priceMinMatch[1].replace(/['\s]/g, ''))
    filtered = filtered.filter(l => l.price >= price)
    appliedFilters.push(`à partir de ${formatCHF(price)}`)
    filters.minPrice = price.toString()
  }

  // Property type
  if (/appartement|appart|flat/i.test(q)) {
    filtered = filtered.filter(l => l.type === 'apartment')
    appliedFilters.push('appartement')
    filters.types = ['apartment']
  } else if (/maison|house/i.test(q)) {
    filtered = filtered.filter(l => l.type === 'house')
    appliedFilters.push('maison')
    filters.types = ['house']
  } else if (/villa/i.test(q)) {
    filtered = filtered.filter(l => l.type === 'villa')
    appliedFilters.push('villa')
    filters.types = ['villa']
  }

  // Surface
  const surfMatch = q.match(/(\d+)\s*(?:m2|m²|mètres?\s*carrés?)/)
  if (surfMatch) {
    const surf = parseInt(surfMatch[1])
    filtered = filtered.filter(l => l.surface_m2 >= surf)
    appliedFilters.push(`${surf}+ m²`)
    filters.minSurface = surf.toString()
  }

  // Context
  if (/louer|location|à louer|rent/i.test(q)) {
    filtered = filtered.filter(l => l.context === 'rent')
    appliedFilters.push('location')
    filters.context = 'rent'
  } else if (/acheter|achat|à vendre|buy/i.test(q)) {
    filtered = filtered.filter(l => l.context === 'buy')
    appliedFilters.push('achat')
    filters.context = 'buy'
  }

  // Build response
  const count = filtered.length
  let response: string

  if (appliedFilters.length === 0) {
    response = `Je comprends votre recherche. Pourriez-vous préciser ce que vous cherchez ? Par exemple :\n\n- **Ville ou quartier** : "à Champel", "près de Lausanne"\n- **Taille** : "3 pièces", "2 chambres"\n- **Budget** : "max CHF 800'000"\n- **Type** : "appartement", "villa", "maison"\n\nVous pouvez aussi combiner : "appartement 4 pièces à Genève, max CHF 1'200'000"`
  } else if (count === 0) {
    response = `Aucun bien ne correspond exactement à votre recherche (${appliedFilters.join(', ')}). Essayez d'élargir vos critères — par exemple un budget plus élevé ou une zone plus large.`
  } else if (count <= 3) {
    response = `J'ai trouvé **${count} bien${count > 1 ? 's' : ''}** correspondant à votre recherche (${appliedFilters.join(', ')}). ${count === 1 ? "C'est une belle opportunité" : 'Voici les résultats'} :`
  } else if (count <= 10) {
    response = `**${count} biens** correspondent à vos critères (${appliedFilters.join(', ')}). Voici les plus pertinents :`
  } else {
    response = `J'ai trouvé **${count} biens** pour votre recherche (${appliedFilters.join(', ')}). Je vous montre les 5 premiers — vous pouvez affiner avec plus de détails.`
  }

  return {
    response,
    filters,
    matchingIds: filtered.slice(0, 5).map(l => l.id),
  }
}

// ─── SUGGESTED QUERIES ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Appartement 3 pièces à Genève, max CHF 800\'000',
  'Villa avec jardin à Lausanne',
  'Studio à louer près de la gare',
  '4 chambres, lumineux, Champel',
  'Maison familiale, budget CHF 1\'500\'000',
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

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            'Bonjour ! Je suis votre assistant de recherche immobilière. Décrivez-moi le bien que vous cherchez en langage naturel.\n\nPar exemple : *"3 pièces lumineux à Champel, max CHF 800\'000"*',
          timestamp: new Date(),
        },
      ])
    }
  }, [isOpen, messages.length])

  function handleSend(text?: string) {
    const query = (text || input).trim()
    if (!query) return

    const now = Date.now() // eslint-disable-line react-hooks/purity
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

    // Simulate AI processing
    const delay = 600 + Math.random() * 800 // eslint-disable-line react-hooks/purity
    setTimeout(() => {
      const parsed = parseUserQuery(query, allListings)

      // Find matching listings
      const matchingListings = parsed.matchingIds
        ? allListings.filter(l => parsed.matchingIds!.includes(l.id))
        : []

      let content = parsed.response

      // After 8 turns, suggest contacting an agent
      if (turnCount >= 7) {
        content +=
          '\n\n---\n\nVous avez exploré plusieurs options. Pour une recherche plus ciblée, je vous recommande de **contacter un agent MEGGA** qui pourra vous accompagner personnellement.'
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content,
        listings: matchingListings.length > 0 ? matchingListings : undefined,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMsg])
      setIsTyping(false)

      // Apply filters to search page
      if (onApplyFilters && Object.keys(parsed.filters).length > 0) {
        const stringFilters: Record<string, string | string[]> = {}
        for (const [k, v] of Object.entries(parsed.filters)) {
          if (Array.isArray(v)) {
            stringFilters[k] = v
          } else {
            stringFilters[k] = String(v)
          }
        }
        onApplyFilters(stringFilters)
      }
    }, delay)
  }

  function handleReset() {
    setMessages([])
    setTurnCount(0)
    setInput('')
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
            <h3 className="text-sm font-semibold text-gray-900">Recherche assistée</h3>
            <p className="text-[11px] text-gray-400">Décrivez le bien que vous cherchez</p>
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
                      // Bold text
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
                            // List items
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
                            {listing.photos[0] && (
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
                <span className="text-xs text-gray-400">Analyse en cours...</span>
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
          Informations fournies à titre indicatif. Consultez un agent pour des conseils personnalisés.
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
            placeholder="Décrivez ce que vous cherchez..."
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
