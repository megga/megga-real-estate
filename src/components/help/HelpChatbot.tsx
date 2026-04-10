import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, ArrowUp, ArrowRight, Search, MessageSquare, HelpCircle, Home, ChevronLeft, ChevronRight, Sparkles, CheckCircle, CheckCheck, Paperclip, Smile, Mic } from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ALL_ARTICLES, type HelpArticle } from '@/lib/helpArticles'

// Lazy load heavy components (emoji-mart ~400KB, giphy ~50KB)
const EmojiPicker = lazy(() => import('@emoji-mart/react'))

// Lazy singletons — chargés à la première utilisation
let emojiDataCache: unknown = null
async function getEmojiData() {
  if (!emojiDataCache) {
    const mod = await import('@emoji-mart/data')
    emojiDataCache = mod.default
  }
  return emojiDataCache
}

type GiphyLike = { trending: (opts: { limit: number }) => Promise<{ data: unknown }>; search: (q: string, opts: { limit: number }) => Promise<{ data: unknown }> }
let gfCache: GiphyLike | null = null
async function getGiphy(): Promise<GiphyLike> {
  if (!gfCache) {
    const { GiphyFetch } = await import('@giphy/js-fetch-api')
    gfCache = new GiphyFetch('GlVGYHkr3WSBnllca54iNt0yFbjz7L65') as unknown as GiphyLike
  }
  return gfCache
}

// ── Types ───────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  suggestedArticles?: { slug: string; title: string; category: string }[]
  shouldEscalate?: boolean
  pills?: string[]
}

type Tab = 'home' | 'conversations' | 'help'

// ── Constants ───────────────────────────────────────────────────────────

const ARTICLES_CONTEXT = ALL_ARTICLES
  .map(a => `${a.category}/${a.slug} — ${a.title}: ${a.description}`)
  .join('\n')

const HELP_SECTIONS = [
  { title: 'Premiers pas avec MEGGA', slug: 'configurer-profil', category: 'agent' },
  { title: 'Importer vos contacts', slug: 'importer-contacts', category: 'agent' },
  { title: 'Créer et publier un bien', slug: 'creer-bien', category: 'agent' },
  { title: 'KYC et conformité LAB', slug: 'creer-kyc', category: 'agent' },
  { title: 'Utiliser MEGGA AI', slug: 'megga-ai-quotidien', category: 'agent' },
  { title: 'Matching acheteurs ↔ biens', slug: 'matching', category: 'agent' },
]

// Page → contextual articles mapping
const PAGE_CONTEXT: Record<string, { label: string; sections: typeof HELP_SECTIONS }> = {
  '/dashboard/kyc': {
    label: 'KYC & Conformité',
    sections: [
      { title: 'Créer un dossier KYC', slug: 'creer-kyc', category: 'agent' },
      { title: 'Screening PEP & Sanctions', slug: 'screening-pep', category: 'agent' },
      { title: 'Validation et audit trail', slug: 'validation-kyc', category: 'agent' },
    ],
  },
  '/dashboard/pipeline': {
    label: 'Pipeline',
    sections: [
      { title: 'Votre premier deal', slug: 'premier-deal', category: 'agent' },
      { title: 'Comprendre les scores IA', slug: 'scores-ia', category: 'agent' },
    ],
  },
  '/dashboard/contacts': {
    label: 'Contacts',
    sections: [
      { title: 'Ajouter et gérer vos contacts', slug: 'gerer-contacts', category: 'agent' },
      { title: 'Importer vos contacts', slug: 'importer-contacts', category: 'agent' },
      { title: 'La timeline unifiée', slug: 'timeline', category: 'agent' },
    ],
  },
  '/dashboard/matching': {
    label: 'Matching',
    sections: [
      { title: 'Le matching acheteurs ↔ biens', slug: 'matching', category: 'agent' },
      { title: 'Créer un bien immobilier', slug: 'creer-bien', category: 'agent' },
    ],
  },
  '/dashboard/listings': {
    label: 'Biens',
    sections: [
      { title: 'Créer un bien immobilier', slug: 'creer-bien', category: 'agent' },
      { title: 'Le virtual staging IA', slug: 'virtual-staging', category: 'agent' },
      { title: 'Créer en 3 minutes', slug: 'premier-bien-3min', category: 'agent' },
    ],
  },
  '/dashboard/messages': {
    label: 'Messagerie',
    sections: [
      { title: 'La messagerie', slug: 'messagerie', category: 'agent' },
      { title: 'Utiliser MEGGA AI', slug: 'megga-ai-quotidien', category: 'agent' },
    ],
  },
  '/dashboard/calendar': {
    label: 'Calendrier',
    sections: [
      { title: 'Le calendrier et les visites', slug: 'calendrier', category: 'agent' },
    ],
  },
  '/dashboard/settings': {
    label: 'Paramètres',
    sections: [
      { title: 'Configurer votre profil', slug: 'configurer-profil', category: 'agent' },
      { title: 'Plans et tarifs', slug: 'plans-et-tarifs', category: 'agent' },
    ],
  },
  '/acheter': {
    label: 'Recherche',
    sections: [
      { title: 'Rechercher un bien', slug: 'rechercher-bien', category: 'acheteur' },
      { title: 'Recherche IA conversationnelle', slug: 'recherche-ia', category: 'acheteur' },
      { title: 'Favoris et alertes', slug: 'favoris-alertes', category: 'acheteur' },
      { title: 'Calculateur d\'accessibilité', slug: 'calculateur', category: 'acheteur' },
    ],
  },
  '/vendre': {
    label: 'Vendre',
    sections: [
      { title: 'Estimer et vendre votre bien', slug: 'estimer-vendre', category: 'acheteur' },
      { title: 'Les étapes d\'une vente en Suisse', slug: 'processus-vente-suisse', category: 'vendeur' },
    ],
  },
  '/portail': {
    label: 'Portail vendeur',
    sections: [
      { title: 'Accéder à votre espace', slug: 'acces-portail', category: 'vendeur' },
      { title: 'Suivre les visites', slug: 'suivi-visites', category: 'vendeur' },
      { title: 'Les offres reçues', slug: 'offres-vendeur', category: 'vendeur' },
      { title: 'Communiquer avec votre agent', slug: 'communiquer-agent', category: 'vendeur' },
    ],
  },
}

function getContextForPath(pathname: string): { label: string; sections: typeof HELP_SECTIONS } | null {
  // Exact match first
  if (PAGE_CONTEXT[pathname]) return PAGE_CONTEXT[pathname]
  // Prefix match (e.g. /dashboard/kyc/123 → /dashboard/kyc)
  for (const key of Object.keys(PAGE_CONTEXT)) {
    if (pathname.startsWith(key)) return PAGE_CONTEXT[key]
  }
  return null
}

const CATEGORIES_CONNECTED = [
  'Problèmes d\'abonnement / facturation',
  'Question sur une fonctionnalité',
  'Problèmes techniques / Erreurs',
  'KYC et conformité',
  'Autre demande',
]

function generateConversationId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
}

// Render message content — supports **bold**, ![image](url), [link](url)
function renderMessageContent(content: string): React.ReactNode {
  // Check for image/GIF markdown: ![alt](url)
  const imgMatch = content.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
  if (imgMatch) {
    return <img src={imgMatch[2]} alt={imgMatch[1]} className="rounded-xl max-w-full max-h-48 object-contain" loading="lazy" />
  }

  // Check for file link: 📎 [name](url)
  const fileLinkMatch = content.match(/^📎\s*\[([^\]]+)\]\(([^)]+)\)$/)
  if (fileLinkMatch) {
    return (
      <a href={fileLinkMatch[2]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline">
        📎 {fileLinkMatch[1]}
      </a>
    )
  }

  // Regular text with **bold** support
  return content.split('**').map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

// ── Component ───────────────────────────────────────────────────────────

export default function HelpChatbot() {
  const navigate = useNavigate()
  const location = useLocation()
  const pageContext = getContextForPath(location.pathname)
  const contextualSections = pageContext?.sections || HELP_SECTIONS
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [accepted, setAccepted] = useState<boolean | null>(() => {
    try { return localStorage.getItem('megga-chat-accepted') === 'true' ? true : null } catch { return null }
  })
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationDbId, setConversationDbId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [exchangeCount, setExchangeCount] = useState(0)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const [gifResults, setGifResults] = useState<Array<{ id: string; images: { fixed_height: { url: string; width: string; height: string } } }>>([])
  const [gifQuery, setGifQuery] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const maxExchanges = isAuthenticated ? 5 : 3

  // Check auth status
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user))
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  // Auto-init conversation when accepted but no messages (returning user)
  useEffect(() => {
    if (accepted && showChat && messages.length === 0 && !conversationId) {
      const id = generateConversationId()
      setConversationId(id)
      setMessages([{
        id: `s-${Date.now()}`,
        role: 'system',
        content: `Identifiant de conversation pour vos dossiers : **${id}**\n\nFaites-nous savoir de quoi porte votre demande.`,
        timestamp: new Date(),
        pills: CATEGORIES_CONNECTED,
      }])
    }
  }, [accepted, showChat, messages.length, conversationId])

  useEffect(() => {
    if (showChat && accepted && selectedCategory) setTimeout(() => inputRef.current?.focus(), 200)
  }, [showChat, accepted, selectedCategory])

  // ── Persistence helpers ──────────────────────────────────────────
  async function saveConversation(ref: string, category?: string) {
    try {
      const { data: user } = await supabase.auth.getUser()
      const { data } = await supabase.from('chat_conversations').insert({
        conversation_ref: ref,
        user_id: user.user?.id || null,
        category: category || null,
      }).select('id').single()
      if (data) setConversationDbId(data.id)
    } catch { /* silent fail for anonymous */ }
  }

  async function saveMessage(role: string, content: string, metadata?: Record<string, unknown>) {
    if (!conversationDbId) return
    try {
      await supabase.from('chat_messages').insert({
        conversation_id: conversationDbId,
        role,
        content,
        metadata: metadata || {},
      })
    } catch { /* silent fail */ }
  }

  useEffect(() => {
    if (tab === 'help') setTimeout(() => searchInputRef.current?.focus(), 200)
  }, [tab])

  // Load trending GIFs on open
  useEffect(() => {
    if (showGif && gifResults.length === 0 && !gifQuery) {
      getGiphy().then(gf => gf.trending({ limit: 12 })).then(res => setGifResults(res.data as unknown as typeof gifResults))
    }
  }, [showGif, gifResults.length, gifQuery])

  async function searchGifs(q: string) {
    setGifQuery(q)
    const gf = await getGiphy()
    if (!q.trim()) {
      const res = await gf.trending({ limit: 12 })
      setGifResults(res.data as unknown as typeof gifResults)
    } else {
      const res = await gf.search(q, { limit: 12 })
      setGifResults(res.data as unknown as typeof gifResults)
    }
  }

  // Emoji data chargé à l'ouverture du picker
  const [emojiData, setEmojiData] = useState<unknown>(null)
  useEffect(() => {
    if (showEmoji && !emojiData) {
      getEmojiData().then(setEmojiData)
    }
  }, [showEmoji, emojiData])

  function handleEmojiSelect(emoji: { native: string }) {
    setInput(prev => prev + emoji.native)
    setShowEmoji(false)
    inputRef.current?.focus()
  }

  function handleGifSelect(gifUrl: string) {
    setShowGif(false)
    const content = `![GIF](${gifUrl})`
    const gifMsg: Message = { id: `u-${Date.now()}`, role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, gifMsg])
    saveMessage('user', content)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert('Fichier trop volumineux (max 10 Mo)')
      return
    }
    e.target.value = ''

    // Upload to Supabase Storage
    let fileUrl = ''
    try {
      const path = `chat/${conversationId || 'anon'}/${Date.now()}-${file.name}`
      const { data } = await supabase.storage.from('chat-attachments').upload(path, file)
      if (data) {
        const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(data.path)
        fileUrl = urlData.publicUrl
      }
    } catch { /* fallback to name only */ }

    const content = fileUrl
      ? (file.type.startsWith('image/') ? `![${file.name}](${fileUrl})` : `📎 [${file.name}](${fileUrl})`)
      : `📎 ${file.name}`

    const fileMsg: Message = { id: `u-${Date.now()}`, role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, fileMsg])
    saveMessage('user', content)
  }

  // ── Voice recording — waveform + Deepgram transcription on stop ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const [waveform, setWaveform] = useState<number[]>(Array(40).fill(2))
  const [recordingTime, setRecordingTime] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Web Audio API — real-time waveform
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.4
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      function updateWaveform() {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        const bars: number[] = []
        const step = Math.floor(dataArray.length / 40)
        for (let i = 0; i < 40; i++) {
          bars.push(2 + ((dataArray[i * step] || 0) / 255) * 26)
        }
        setWaveform(bars)
        animFrameRef.current = requestAnimationFrame(updateWaveform)
      }
      updateWaveform()

      // MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        audioCtxRef.current?.close()
        cancelAnimationFrame(animFrameRef.current)
        analyserRef.current = null
        setWaveform(Array(40).fill(2))
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      alert('Impossible d\'accéder au microphone. Vérifiez les permissions.')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    cancelAnimationFrame(animFrameRef.current)
    analyserRef.current = null
    setWaveform(Array(40).fill(2))
    setIsRecording(false)
    setRecordingTime(0)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    audioChunksRef.current = []
  }

  async function transcribeAudio(audioBlob: Blob) {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('language', 'fr')

      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: formData,
      })

      if (error) throw error

      if (data.transcript && data.transcript.trim()) {
        setInput(data.transcript)
        inputRef.current?.focus()
      }
    } catch {
      setInput('[Mémo vocal — transcription indisponible]')
    } finally {
      setLoading(false)
    }
  }

  // Search
  const searchResults = (() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return ALL_ARTICLES
      .filter(a => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.keywords.some(k => k.toLowerCase().includes(q)))
      .slice(0, 6)
  })()

  function handleAccept() {
    setAccepted(true)
    try { localStorage.setItem('megga-chat-accepted', 'true') } catch { /* ignore */ }
    const id = generateConversationId()
    setConversationId(id)
    saveConversation(id)

    setMessages([{
      id: `s-${Date.now()}`,
      role: 'system',
      content: `Identifiant de conversation pour vos dossiers : **${id}**\n\nFaites-nous savoir de quoi porte votre demande.`,
      timestamp: new Date(),
      pills: CATEGORIES_CONNECTED,
    }])
  }

  function handleSelectCategory(category: string) {
    setSelectedCategory(category)

    // Update conversation with category
    if (conversationDbId) {
      supabase.from('chat_conversations').update({ category }).eq('id', conversationDbId).then()
    }

    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      role: 'user',
      content: category,
      timestamp: new Date(),
    }])
    saveMessage('user', category)

    setTimeout(() => {
      const reply = `Parfait, je vais vous aider avec : **${category}**.\n\nPosez-moi votre question, je ferai de mon mieux pour y répondre.`
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }])
      saveMessage('assistant', reply)
    }, 500)
  }

  async function handleSend(text?: string) {
    const msg = text || input.trim()
    if (!msg || loading) return

    // Rate limit check
    if (exchangeCount >= maxExchanges) {
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: 'Vous avez atteint la limite de messages. Créez un ticket pour continuer avec notre équipe.',
        timestamp: new Date(),
        shouldEscalate: true,
      }])
      return
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: msg, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    saveMessage('user', msg)
    setInput('')
    setShowChat(true)
    setTab('conversations')
    const newCount = exchangeCount + 1
    setExchangeCount(newCount)
    setLoading(true)

    try {
      const history = messages.filter(m => m.role !== 'system').slice(-8).map(m => ({ role: m.role, content: m.content }))
      const { data, error } = await supabase.functions.invoke('support-chatbot', {
        body: { message: msg, history, language: 'fr', articlesContext: ARTICLES_CONTEXT, category: selectedCategory },
      })
      if (error) throw error

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'Je ne peux pas répondre pour le moment.',
        timestamp: new Date(),
        suggestedArticles: data.suggestedArticles || [],
        shouldEscalate: data.shouldEscalate || newCount >= maxExchanges,
      }
      setMessages(prev => [...prev, assistantMsg])
      saveMessage('assistant', assistantMsg.content, { suggestedArticles: assistantMsg.suggestedArticles, shouldEscalate: assistantMsg.shouldEscalate })
    } catch {
      const FuseModule = (await import('fuse.js')).default
      const fuse = new FuseModule(ALL_ARTICLES, { threshold: 0.4, keys: ['title', 'description', 'keywords'] as const })
      const results = fuse.search(msg).slice(0, 3) as { item: HelpArticle }[]

      const fallbackMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant' as const,
        content: results.length > 0 ? 'Voici ce que j\'ai trouvé :' : "Je n'ai pas pu résoudre votre problème.",
        timestamp: new Date(),
        suggestedArticles: results.map((r: { item: HelpArticle }) => ({ slug: r.item.slug, title: r.item.title, category: r.item.category })),
        shouldEscalate: results.length === 0 || newCount >= maxExchanges,
      }
      setMessages(prev => [...prev, fallbackMsg])
      saveMessage('assistant', fallbackMsg.content, { suggestedArticles: fallbackMsg.suggestedArticles })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function goToArticle(category: string, slug: string) {
    setOpen(false)
    navigate(`/aide/${category}/${slug}`)
  }

  function handleCreateTicket() {
    setOpen(false)
    navigate(`/aide/contact?category=${encodeURIComponent(selectedCategory || '')}&ref=${conversationId || ''}`)
  }

  // ── Launcher ──────────────────────────────────────────────────────

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group h-[60px] w-[60px] rounded-full bg-gray-900 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
        aria-label="Ouvrir le chat"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    )
  }

  // ── Panel ─────────────────────────────────────────────────────────

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[100]">
      <div
        className="w-full sm:w-[400px] h-[min(700px,calc(100vh-80px))] bg-theme-card rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'intercom-slide 0.25s ease-out' }}
      >

        {/* ══════ HOME TAB ══════ */}
        {tab === 'home' && !showChat && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Dark header */}
            <div className="bg-gray-900 px-6 pt-8 pb-28 flex-shrink-0 relative rounded-t-2xl">
              <button
                onClick={() => setOpen(false)}
                className="absolute top-5 right-5 h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                aria-label="Fermer"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
              <div className="mb-14">
                <img src="/megga-gg-icon.svg" alt="MEGGA" className="h-10 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
              <h2 className="text-2xl font-bold text-white leading-tight">
                Bonjour 👋<br />
                Comment pouvons-nous vous aider ?
              </h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide -mt-8 relative z-10">
              {/* Status */}
              <div className="mx-4 mb-3">
                <div className="bg-theme-card rounded-xl border border-theme-border px-5 py-4 flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-emerald-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-600">Status: Tous les systèmes opérationnels</p>
                    <p className="text-xs text-theme-muted">Mis à jour le {new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              </div>

              {/* Send message */}
              <div className="mx-4 mb-3">
                <button
                  onClick={() => { setShowChat(true); setTab('conversations') }}
                  className="w-full bg-theme-card rounded-xl border border-theme-border px-5 py-4 flex items-center justify-between hover:bg-theme-hover transition-colors"
                >
                  <span className="text-sm font-semibold text-theme-primary">Envoyez-nous un message</span>
                  <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 28 28" fill="none"><path d="M3 5.5c0-1.5 1.6-2.4 2.8-1.6L24 14l-18.2 10.1c-1.2.7-2.8-.1-2.8-1.6V16l10-2L3 12V5.5z" fill="#3B9EFF" /></svg>
                </button>
              </div>

              {/* Help sections */}
              <div className="mx-4 mb-4">
                <div className="bg-theme-card rounded-xl border border-theme-border overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b border-theme-border-subtle">
                    <span className="text-sm font-semibold text-theme-primary">{pageContext ? `Aide — ${pageContext.label}` : 'Trouver une réponse'}</span>
                    <Search className="h-5 w-5 text-blue-500" />
                  </div>
                  {contextualSections.map((section, i) => (
                    <button
                      key={section.slug}
                      onClick={() => goToArticle(section.category, section.slug)}
                      className={cn(
                        "w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-theme-hover transition-colors",
                        i < HELP_SECTIONS.length - 1 && "border-b border-theme-border-subtle"
                      )}
                    >
                      <span className="text-sm text-theme-secondary">{section.title}</span>
                      <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <BottomTabs tab={tab} setTab={setTab} setShowChat={setShowChat} />
          </div>
        )}

        {/* ══════ CONVERSATIONS TAB / CHAT ══════ */}
        {(tab === 'conversations' || showChat) && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header with stacked avatars */}
            <div className="bg-theme-card px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-theme-border">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowChat(false); setTab('home') }}
                  className="h-8 w-8 flex items-center justify-center"
                  aria-label="Retour"
                >
                  <ChevronLeft className="h-5 w-5 text-theme-tertiary" />
                </button>
                <div className="flex items-center -space-x-2">
                  <img src="/avatar-austin.svg" alt="" className="h-9 w-9 rounded-full border-2 border-white object-cover" />
                  <img src="/avatar-eliza.svg" alt="" className="h-9 w-9 rounded-full border-2 border-white object-cover" />
                  <img src="/avatar-stanley.svg" alt="" className="h-9 w-9 rounded-full border-2 border-white object-cover" />
                </div>
                <span className="text-sm font-semibold text-theme-primary">MEGGA</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="h-5 w-5 text-theme-tertiary" />
              </button>
            </div>

            {/* Messages area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide bg-theme-card">

              {/* ── Consent screen ── */}
              {!accepted && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-theme-border p-4">
                    <div className="flex gap-3">
                      <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-blue-500 text-xs font-bold">i</span>
                      </div>
                      <p className="text-sm text-theme-tertiary leading-relaxed">
                        Notre équipe est à votre disposition pour répondre à toutes vos questions. Les réponses peuvent prendre quelques instants. Merci pour votre patience.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-theme-border p-4">
                    <p className="text-sm text-theme-primary leading-relaxed mb-3">
                      Bonjour ! Je suis un assistant alimenté par l'IA pour MEGGA.
                    </p>
                    <p className="text-sm text-theme-secondary leading-relaxed mb-3">
                      Votre utilisation de ce chatbot et les données de chat seront conservées et utilisées par MEGGA pour vous offrir un meilleur support, conformément à notre <Link to="/privacy" className="underline text-blue-600" onClick={() => setOpen(false)}>politique de confidentialité</Link>.
                    </p>
                    <p className="text-sm text-theme-primary leading-relaxed">
                      Veuillez indiquer si vous acceptez ces conditions d'utilisation.
                    </p>
                  </div>
                  <p className="text-xs text-theme-muted mb-6">MEGGA AI · À l'instant</p>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleAccept}
                      className="h-9 px-5 rounded-full border border-theme-border text-sm font-medium text-theme-secondary hover:border-theme-active hover:bg-theme-hover transition-colors"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => { setAccepted(false); setShowChat(false); setTab('home') }}
                      className="h-9 px-5 rounded-full border border-theme-border text-sm font-medium text-theme-secondary hover:border-theme-active hover:bg-theme-hover transition-colors"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              )}

              {/* ── Messages (after accepted) ── */}
              {accepted && messages.map((msg, idx) => {
                const prevMsg = messages[idx - 1]
                const nextMsg = messages[idx + 1]
                const isFirstInGroup = !prevMsg || prevMsg.role !== msg.role
                const isLastInGroup = !nextMsg || nextMsg.role !== msg.role

                return (
                  <div key={msg.id}>
                    {/* System message (conversation ID + pills) */}
                    {msg.role === 'system' && (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-theme-border p-4">
                          <p className="text-sm text-theme-primary leading-relaxed whitespace-pre-line">
                            {msg.content.split('**').map((part, i) =>
                              i % 2 === 1 ? <strong key={i} className="font-bold">{part}</strong> : part
                            )}
                          </p>
                        </div>

                        {/* Category pills — cascade like Intercom */}
                        {msg.pills && !selectedCategory && (
                          <div className="flex flex-col items-end gap-2 pt-2">
                            {msg.pills.map(pill => (
                              <button
                                key={pill}
                                onClick={() => handleSelectCategory(pill)}
                                className="px-5 py-2.5 rounded-full bg-theme-card text-theme-secondary text-sm font-medium whitespace-nowrap border border-theme-border hover:bg-blue-500 hover:text-white hover:border-blue-500 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] text-right"
                              >
                                {pill}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* User message — dashboard style bubble */}
                    {msg.role === 'user' && (
                      <div className={cn(!isFirstInGroup && 'mt-0.5')}>
                        <div className="flex justify-end">
                          <div className={cn(
                            "px-3.5 py-2 text-sm leading-[1.4] whitespace-pre-line bg-accent text-white max-w-[80%]",
                            isFirstInGroup && isLastInGroup && "rounded-[20px]",
                            isFirstInGroup && !isLastInGroup && "rounded-[20px] rounded-br-md",
                            !isFirstInGroup && isLastInGroup && "rounded-[20px] rounded-tr-md",
                            !isFirstInGroup && !isLastInGroup && "rounded-[20px] rounded-r-md",
                          )}>
                            {renderMessageContent(msg.content)}
                          </div>
                        </div>
                        {isLastInGroup && (
                          <div className="flex items-center gap-1 mt-0.5 px-1 justify-end">
                            <time className="text-xs text-theme-muted">{formatTime(msg.timestamp)}</time>
                            <CheckCheck className="w-3 h-3 text-accent" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Assistant message — dashboard style with avatar */}
                    {msg.role === 'assistant' && (
                      <div className={cn(!isFirstInGroup && 'mt-0.5')}>
                        <div className="flex items-end gap-2">
                          {/* Avatar — only on last in group */}
                          <div className="w-7 flex-shrink-0">
                            {isLastInGroup && (
                              <div className="h-7 w-7 rounded-full bg-gray-900 flex items-center justify-center">
                                <Sparkles className="h-3.5 w-3.5 text-white" />
                              </div>
                            )}
                          </div>

                          <div className="max-w-[80%]">
                            <div className={cn(
                              "px-3.5 py-2 text-sm leading-[1.4] whitespace-pre-line bg-theme-hover text-theme-primary",
                              isFirstInGroup && isLastInGroup && "rounded-[20px]",
                              isFirstInGroup && !isLastInGroup && "rounded-[20px] rounded-bl-md",
                              !isFirstInGroup && isLastInGroup && "rounded-[20px] rounded-tl-md",
                              !isFirstInGroup && !isLastInGroup && "rounded-[20px] rounded-l-md",
                            )}>
                              {renderMessageContent(msg.content)}
                            </div>

                            {/* Suggested articles */}
                            {msg.suggestedArticles && msg.suggestedArticles.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {msg.suggestedArticles.map(a => (
                                  <button
                                    key={a.slug}
                                    onClick={() => goToArticle(a.category, a.slug)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-theme-section border border-theme-border-subtle hover:border-blue-200 transition-all text-left"
                                  >
                                    <span className="flex-1 text-xs text-theme-secondary">{a.title}</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Escalate to ticket */}
                            {msg.shouldEscalate && (
                              <div className="mt-2 space-y-2">
                                <p className="text-xs text-theme-tertiary ml-1">Souhaitez-vous créer un ticket pour un suivi personnalisé ?</p>
                                <button
                                  onClick={handleCreateTicket}
                                  className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-theme-border text-theme-secondary text-xs font-medium hover:text-theme-primary hover:border-theme-active transition-colors"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Créer un ticket · {conversationId}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {isLastInGroup && (
                          <div className="flex items-center gap-1 mt-0.5 pl-9">
                            <time className="text-xs text-theme-muted">{formatTime(msg.timestamp)}</time>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Typing indicator */}
              {loading && (
                <div className="flex items-end gap-2">
                  <div className="h-7 w-7 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="bg-theme-hover rounded-[20px] rounded-bl-md px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-theme-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-theme-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-theme-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input — Dashboard MEGGA AI style */}
            {accepted && selectedCategory && (
              <div className="px-3 py-3 bg-theme-card flex-shrink-0 relative" style={{ animation: 'intercom-fade-up 0.3s ease-out' }}>

                {/* Emoji Picker popup */}
                {showEmoji && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 z-50 overflow-hidden rounded-xl border border-theme-border" style={{ animation: 'intercom-fade-up 0.2s ease-out' }}>
                    <Suspense fallback={<div className="w-full h-[280px] bg-theme-card flex items-center justify-center text-sm text-theme-muted">Chargement...</div>}>
                      <div style={{ height: '280px' }}>
                        {emojiData ? (
                          <EmojiPicker data={emojiData} onEmojiSelect={handleEmojiSelect} locale="fr" theme="light" previewPosition="none" skinTonePosition="none" perLine={9} maxFrequentRows={1} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-theme-muted">Chargement...</div>
                        )}
                      </div>
                    </Suspense>
                  </div>
                )}

                {/* GIF Picker popup */}
                {showGif && (
                  <div className="absolute bottom-full left-2 right-2 mb-2 z-50 bg-theme-card rounded-xl border border-theme-border overflow-hidden" style={{ animation: 'intercom-fade-up 0.2s ease-out' }}>
                    <div className="p-3 border-b border-theme-border-subtle">
                      <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-theme-hover">
                        <Search className="h-3.5 w-3.5 text-theme-muted" />
                        <input
                          value={gifQuery}
                          onChange={e => searchGifs(e.target.value)}
                          placeholder="Rechercher un GIF..."
                          className="flex-1 text-sm bg-transparent outline-none text-theme-primary placeholder:text-theme-muted"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-2 max-h-[200px] overflow-y-auto scrollbar-hide">
                      {gifResults.map(gif => (
                        <button
                          key={gif.id}
                          onClick={() => handleGifSelect(gif.images.fixed_height.url)}
                          className="rounded-lg overflow-hidden hover:opacity-80 transition-opacity aspect-square"
                        >
                          <img src={gif.images.fixed_height.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                    <div className="px-3 py-2 border-t border-theme-border-subtle flex justify-end">
                      <button onClick={() => setShowGif(false)} className="text-xs text-theme-muted hover:text-theme-secondary">Fermer</button>
                    </div>
                  </div>
                )}

                {/* Hidden file input */}
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileSelect} />

                {/* ═══ Recording mode — real-time waveform ═══ */}
                {isRecording ? (
                  <>
                  <div
                    className="rounded-2xl border border-theme-border bg-theme-card px-2 py-2 flex items-center gap-2"
                    style={{ animation: 'recording-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                  >
                    {/* Cancel button */}
                    <button
                      onClick={cancelRecording}
                      className="h-10 w-10 rounded-full bg-theme-hover flex items-center justify-center hover:bg-theme-active active:scale-95 transition-all flex-shrink-0"
                      aria-label="Annuler"
                    >
                      <X className="h-5 w-5 text-theme-secondary" />
                    </button>

                    {/* Real-time waveform — Web Audio API driven */}
                    <div className="flex-1 flex items-center justify-center gap-[2px] h-10 overflow-hidden">
                      {waveform.map((h, i) => (
                        <span
                          key={i}
                          className="w-[2.5px] rounded-full flex-shrink-0"
                          style={{
                            height: `${h}px`,
                            backgroundColor: i < 20 ? `rgba(55, 65, 81, ${0.4 + (h / 28) * 0.6})` : 'rgba(209, 213, 219, 0.5)',
                            transition: 'height 0.08s ease-out',
                          }}
                        />
                      ))}
                    </div>

                    {/* Timer */}
                    <span className="text-xs text-theme-muted tabular-nums flex-shrink-0 w-10 text-right">
                      {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </span>

                    {/* Stop button */}
                    <button
                      onClick={stopRecording}
                      className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all flex-shrink-0"
                      aria-label="Arrêter et transcrire"
                    >
                      <div className="h-4 w-4 rounded-sm bg-white" />
                    </button>
                  </div>
                  </>
                ) : (
                  /* ═══ Normal input mode ═══ */
                  <div className="rounded-2xl border border-theme-border bg-theme-card p-2 focus-within:border-accent/60 transition-colors">
                    {/* Textarea */}
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Écrivez votre message..."
                      rows={1}
                      className="w-full bg-transparent px-2 py-1.5 text-sm text-theme-primary placeholder:text-theme-muted outline-none resize-none min-h-[36px] max-h-[120px] scrollbar-hide"
                    />

                    {/* Actions bar */}
                    <div className="flex items-center justify-between pt-1">
                      {/* Left: attach + emoji + GIF */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          aria-label="Joindre un fichier"
                          className="h-7 w-7 rounded-full flex items-center justify-center text-theme-muted hover:text-theme-secondary hover:bg-theme-hover transition-colors"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setShowEmoji(!showEmoji); setShowGif(false) }}
                          aria-label="Emoji"
                          className={cn("h-7 w-7 rounded-full flex items-center justify-center transition-colors", showEmoji ? "text-accent bg-accent/10" : "text-theme-muted hover:text-theme-secondary hover:bg-theme-hover")}
                        >
                          <Smile className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setShowGif(!showGif); setShowEmoji(false) }}
                          aria-label="GIF"
                          className={cn("h-7 px-1.5 rounded-full flex items-center justify-center text-xs font-bold transition-colors", showGif ? "text-accent bg-accent/10" : "text-theme-muted hover:text-theme-secondary hover:bg-theme-hover")}
                        >
                          GIF
                        </button>
                      </div>

                      {/* Right: mic + send */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={startRecording}
                          aria-label="Mémo vocal"
                          className="h-7 w-7 rounded-full flex items-center justify-center text-theme-muted hover:text-theme-secondary hover:bg-theme-hover transition-colors"
                        >
                          <Mic className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleSend()}
                          disabled={loading || !input.trim()}
                          aria-label="Envoyer"
                          className={cn(
                            'h-7 w-7 rounded-full flex items-center justify-center transition-colors',
                            input.trim() ? 'bg-gray-900 text-white' : 'text-theme-muted'
                          )}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom tabs — hidden after category selected (iOS 26 slide-out) */}
            {accepted && !selectedCategory && (
              <div style={{ animation: 'intercom-fade-up 0.3s ease-out' }}>
                <BottomTabs tab="conversations" setTab={(t) => { setTab(t); if (t === 'home') setShowChat(false) }} setShowChat={setShowChat} />
              </div>
            )}
          </div>
        )}

        {/* ══════ HELP TAB ══════ */}
        {tab === 'help' && !showChat && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-gray-900 px-5 py-4 flex items-center justify-between flex-shrink-0">
              <p className="text-base font-semibold text-white">Aide</p>
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors" aria-label="Fermer">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="px-4 pt-4 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2 h-11 px-4 rounded-xl bg-theme-hover focus-within:bg-theme-card focus-within:ring-2 focus-within:ring-blue-100 border border-transparent focus-within:border-blue-300 transition-all">
                <Search className="h-4 w-4 text-theme-muted flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher dans l'aide..."
                  className="flex-1 text-sm bg-transparent outline-none text-theme-primary placeholder:text-theme-muted"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-0.5"><X className="h-3.5 w-3.5 text-theme-muted" /></button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4">
              {searchQuery.trim() ? (
                searchResults.length > 0 ? (
                  <div className="space-y-1 mt-2">
                    {searchResults.map(article => (
                      <button key={article.slug} onClick={() => goToArticle(article.category, article.slug)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-theme-hover transition-colors text-left">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-theme-primary">{article.title}</p>
                          <p className="text-xs text-theme-tertiary truncate">{article.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-theme-muted text-center py-10">Aucun résultat pour « {searchQuery} »</p>
                )
              ) : (
                <div className="mt-2">
                  {contextualSections.map((section, i) => (
                    <button key={section.slug} onClick={() => goToArticle(section.category, section.slug)}
                      className={cn("w-full flex items-center justify-between py-3.5 text-left", i < HELP_SECTIONS.length - 1 && "border-b border-theme-border-subtle")}>
                      <span className="text-sm text-theme-secondary">{section.title}</span>
                      <ChevronRight className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    </button>
                  ))}
                  <Link to="/aide/ressources" onClick={() => setOpen(false)}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-theme-border text-sm font-medium text-theme-secondary hover:border-theme-active transition-colors">
                    Voir tous les articles <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>

            <BottomTabs tab="help" setTab={setTab} setShowChat={setShowChat} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes intercom-slide {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes intercom-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes recording-in {
          from { opacity: 0; transform: scaleX(0.85) scaleY(0.9); }
          to { opacity: 1; transform: scaleX(1) scaleY(1); }
        }
        @keyframes eq-bar {
          0% { height: 4px; }
          100% { height: 18px; }
        }
        @keyframes eq-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>,
    document.body
  )
}

// ── Bottom Tab Bar ──────────────────────────────────────────────────────

function BottomTabs({ tab, setTab, setShowChat }: { tab: Tab; setTab: (t: Tab) => void; setShowChat: (v: boolean) => void }) {
  return (
    <div className="flex items-center border-t border-theme-border bg-theme-card flex-shrink-0">
      <button onClick={() => { setTab('home'); setShowChat(false) }}
        className={cn("flex-1 flex flex-col items-center gap-1 py-3 transition-colors", tab === 'home' ? 'text-blue-500' : 'text-theme-muted hover:text-theme-secondary')}>
        <Home className="h-5 w-5" /><span className="text-xs font-medium">Accueil</span>
      </button>
      <button onClick={() => { setTab('conversations'); setShowChat(true) }}
        className={cn("flex-1 flex flex-col items-center gap-1 py-3 transition-colors", tab === 'conversations' ? 'text-blue-500' : 'text-theme-muted hover:text-theme-secondary')}>
        <MessageSquare className="h-5 w-5" /><span className="text-xs font-medium">Conversations</span>
      </button>
      <button onClick={() => { setTab('help'); setShowChat(false) }}
        className={cn("flex-1 flex flex-col items-center gap-1 py-3 transition-colors", tab === 'help' ? 'text-blue-500' : 'text-theme-muted hover:text-theme-secondary')}>
        <HelpCircle className="h-5 w-5" /><span className="text-xs font-medium">Aide</span>
      </button>
    </div>
  )
}
