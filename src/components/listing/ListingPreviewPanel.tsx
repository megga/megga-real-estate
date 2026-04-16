import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  X, ChevronDown, ChevronUp, ChevronLeft, MoreHorizontal,
  MapPin, Heart, Share2,
  Phone, CalendarDays, Building2,
  Clock, Images, Fence, Sun, Archive, Car, Warehouse, Sparkles, Send,
  ArrowUpDown, Mountain, Flame, Wind, TreePine, Droplets, Check, GitCompareArrows,
} from 'lucide-react'
import { cn, formatCHF, formatRent, formatSurface, resolveRegieContact } from '@/lib/utils'
import { optimizeImageUrl, IMAGE_PRESETS } from '@/lib/imageOptimizer'
import Footer from '@/components/layout/Footer'
import { useMarketListing, useMarketListings } from '@/hooks/useMarketListings'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import MarketTemperatureBadge from '@/components/listings/MarketTemperatureBadge'
import PriceHistoryChart from '@/components/listings/PriceHistoryChart'
import NaturalHazardBadge from '@/components/listings/NaturalHazardBadge'
import { useMarketTemperature } from '@/hooks/useMarketInsights'
import { estimatePropertyTax, estimateMonthlyCost, CANTONAL_TAX_RATES, ENERGY_LABEL_COLORS, type EnergyLabel } from '@/lib/cantonalTaxRates'
import NeighborhoodSection from '@/components/listing/NeighborhoodSection'
import InteractiveFloorPlan from '@/components/listing/InteractiveFloorPlan'
import ListingLightbox from '@/components/listing/ListingLightbox'
import C2PaBadge from '@/components/listing/C2PaBadge'
import ContactAgentModal from '@/components/listing/ContactAgentModal'
import AgentCard from '@/components/listing/AgentCard'
import RegieContactCard from '@/components/listing/RegieContactCard'
import RequestVisitModal from '@/components/listings/RequestVisitModal'
import type { FloorPlanHotspot, PhotoTag } from '@/types/floorPlan'
import { useNeighborhood, calculateWalkScore } from '@/hooks/useNeighborhood'
import MapGL, { Marker, NavigationControl } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// ─── Types ──────────────────────────────────────────────────────────────

interface ListingPreviewPanelProps {
  listingId: string | null
  onClose: () => void
  isCompared?: boolean
  onToggleCompare?: () => void
  /** Render inline (inside parent container) instead of as a full-screen portal */
  inline?: boolean
}

interface TransformedListing {
  id: string
  title: string
  price: number
  address: string
  city: string
  canton: string
  postal_code: string
  rooms: number
  bedrooms: number
  bathrooms: number
  surface_m2: number
  photos: string[]
  description: string
  features: string[]
  type: string
  charges_monthly: number
  price_per_m2: number
  days_on_market: number
  is_hot: boolean
  is_new: boolean
  is_exclusive: boolean
  agency_name: string
  lat: number | undefined
  lng: number | undefined
  year_built: number
  floor: number
  condition: string
  has_parking: boolean
  has_outdoor: boolean
  energy_label: string
  minergie_label: string
  staged_photos: string[]
  floor_plan_url: string | null
  floor_plan_hotspots: FloorPlanHotspot[]
  photo_tags: PhotoTag[]
  c2pa_verified: boolean
  c2pa_verified_at?: string
  transaction_type: 'buy' | 'rent'
  is_furnished: boolean
  deposit_months: number | null
  external_regie: { name?: string; phone?: string; email?: string; website?: string } | null
}

// ─── Transform helpers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformListing(data: Record<string, any>, source: 'market' | 'internal'): TransformedListing {
  return {
    id: data.id,
    title: data.title || 'Bien immobilier',
    price: Number(data.current_price ?? data.price ?? 0),
    address: data.address || '',
    city: data.city || '',
    canton: data.canton || '',
    postal_code: data.postal_code || '',
    rooms: Number(data.rooms) || 0,
    bedrooms: Number(data.bedrooms) || 0,
    bathrooms: Number(data.bathrooms) || 0,
    surface_m2: Number(data.surface_m2) || 0,
    photos: (data.photos as string[]) || [],
    description: (data.description as string) || '',
    features: (data.features as string[]) || [],
    type: (data.type as string) || 'apartment',
    charges_monthly: Number(data.charges_monthly) || 0,
    price_per_m2: source === 'market' ? Number(data.price_per_m2) || 0 : 0,
    days_on_market: source === 'market' ? Number(data.days_on_market) || 0 : 0,
    is_hot: source === 'market' ? data.status === 'price_reduced' : false,
    is_new: source === 'market' ? Number(data.days_on_market) <= 3 : false,
    is_exclusive: source === 'internal',
    agency_name: source === 'market' ? ((data.agency_name as string) || '') : 'MEGGA Real Estate',
    lat: data.lat as number | undefined,
    lng: data.lng as number | undefined,
    year_built: Number(data.year_built) || 0,
    floor: Number(data.floor) || 0,
    condition: (data.condition as string) || '',
    has_parking: !!data.has_parking,
    has_outdoor: !!data.has_outdoor,
    energy_label: (data.energy_label as string) || '',
    minergie_label: (data.minergie_label as string) || '',
    staged_photos: (data.staged_photos as string[]) || [],
    floor_plan_url: (data.floor_plan_url as string) || null,
    floor_plan_hotspots: (data.floor_plan_hotspots as FloorPlanHotspot[]) || [],
    photo_tags: (data.photo_tags as PhotoTag[]) || [],
    c2pa_verified: !!data.c2pa_verified,
    c2pa_verified_at: (data.c2pa_verified_at as string) || undefined,
    transaction_type: ((data.transaction_type as string) || 'buy') as 'buy' | 'rent',
    is_furnished: !!data.is_furnished,
    deposit_months: (data.deposit_months as number | null | undefined) ?? null,
    external_regie: (data.external_regie as { name?: string; phone?: string; email?: string; website?: string } | null) ?? null,
  }
}

const TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  villa: 'Villa',
  commercial: 'Commercial',
  land: 'Terrain',
  flat: 'Appartement',
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'Neuf',
  renovated: 'Rénové',
  good: 'Bon état',
  to_renovate: 'À rénover',
}

// ─── Feature icon mapping ───────────────────────────────────────────────

const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  balcon: Fence,
  terrasse: Sun,
  cave: Archive,
  buanderie: Droplets,
  parking: Car,
  garage: Warehouse,
  ascenseur: ArrowUpDown,
  vue_lac: Droplets,
  vue_montagne: Mountain,
  jardin: TreePine,
  piscine: Droplets,
  cheminée: Flame,
  climatisation: Wind,
  balcony: Fence,
  terrace: Sun,
  cellar: Archive,
  laundry: Droplets,
  elevator: ArrowUpDown,
  lake_view: Droplets,
  mountain_view: Mountain,
  garden: TreePine,
  pool: Droplets,
  fireplace: Flame,
  ac: Wind,
}

function getFeatureIcon(feature: string) {
  const key = feature.toLowerCase().replace(/[\s-]/g, '_')
  for (const [k, icon] of Object.entries(FEATURE_ICONS)) {
    if (key.includes(k)) return icon
  }
  return Check
}

// ─── Section tabs ───────────────────────────────────────────────────────

const BASE_SECTIONS = [
  { id: 'preview-overview', label: 'Aperçu' },
  { id: 'preview-details', label: 'Détails' },
  { id: 'preview-map', label: 'Carte' },
  { id: 'preview-quartier', label: 'Quartier' },
  { id: 'preview-market', label: 'Marché' },
  { id: 'preview-similaires', label: 'Proches' },
]

// ─── Urgency badge logic ────────────────────────────────────────────────

function getUrgencyBadge(daysOnMarket: number, isHot: boolean, isNew: boolean): { label: string; className: string } | null {
  if (isNew || daysOnMarket <= 3) return { label: 'Nouveau', className: 'bg-accent/10 text-accent' }
  if (isHot) return { label: 'Forte demande', className: 'bg-red-50 text-red-600' }
  if (daysOnMarket > 90) return { label: `${daysOnMarket}j en ligne — Négociable ?`, className: 'bg-amber-50 text-amber-700' }
  if (daysOnMarket > 30) return { label: `${daysOnMarket}j en ligne`, className: 'bg-theme-hover text-theme-secondary' }
  return null
}

// ─── Energy label component ─────────────────────────────────────────────

function EnergyLabelBadge({ label, minergie }: { label?: string; minergie?: string }) {
  if (!label && !minergie) return null
  const upperLabel = (label || '').toUpperCase() as EnergyLabel
  const colorClass = ENERGY_LABEL_COLORS[upperLabel] || 'bg-gray-400'

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold text-white', colorClass)}>
          CECB {upperLabel}
        </span>
      )}
      {minergie && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-green-600 text-white">
          {minergie}
        </span>
      )}
    </div>
  )
}

// ─── Property tax estimate component ────────────────────────────────────

function PropertyTaxSection({ price, canton, chargesMonthly }: { price: number; canton: string; chargesMonthly: number }) {
  const taxInfo = CANTONAL_TAX_RATES[canton.toUpperCase()]
  const annualTax = estimatePropertyTax(price, canton)
  const monthlyCost = estimateMonthlyCost(price, canton, chargesMonthly)

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-theme-tertiary capitalize">Estimation fiscale</p>
      <div className="space-y-2">
        {/* Monthly cost */}
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-theme-tertiary">Coût mensuel estimé</span>
          <span className="text-base font-bold text-theme-primary">{formatCHF(monthlyCost.totalMonthly)}/mois</span>
        </div>
        {/* Breakdown */}
        <div className="text-xs text-theme-muted space-y-1">
          <div className="flex justify-between">
            <span>Hypothèque (taux imputé 5%)</span>
            <span>{formatCHF(monthlyCost.monthlyMortgageCost)}</span>
          </div>
          {monthlyCost.monthlyCharges > 0 && (
            <div className="flex justify-between">
              <span>Charges</span>
              <span>{formatCHF(monthlyCost.monthlyCharges)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Impôt foncier ({taxInfo?.name || canton})</span>
            <span>{annualTax !== null ? `${formatCHF(monthlyCost.monthlyPropertyTax)}` : 'Aucun'}</span>
          </div>
        </div>
        {/* Canton info */}
        <div className="pt-1">
          {taxInfo?.hasPropertyTax ? (
            <p className="text-xs text-theme-muted">
              Taux : {taxInfo.ratePerMille}‰ ({taxInfo.level === 'communal' ? 'variable par commune' : 'taux cantonal'}) — {annualTax !== null ? `${formatCHF(annualTax)}/an` : ''}
            </p>
          ) : (
            <p className="text-xs text-green-600 font-medium">
              Pas d'impôt foncier dans le canton de {taxInfo?.name || canton}
            </p>
          )}
        </div>
      </div>
      <p className="text-xs text-theme-muted italic">Estimation indicative — valeur fiscale ≈ 70% du prix marché</p>
    </div>
  )
}

function SectionNav({ activeId, onNavigate, sections }: { activeId: string; onNavigate: (id: string) => void; sections: typeof BASE_SECTIONS }) {
  return (
    <div className="sticky top-0 z-10 bg-theme-card border-b border-theme-border-subtle">
      <div className="flex gap-1 px-6 overflow-x-auto scrollbar-hide -mb-px">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onNavigate(s.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative',
              activeId === s.id
                ? 'text-theme-primary bg-theme-section'
                : 'text-theme-tertiary hover:text-theme-secondary hover:bg-theme-section/50'
            )}
          >
            {s.label}
            {s.id === 'preview-market' && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs font-semibold rounded bg-accent/10 text-accent">Nouveau</span>
            )}
            {activeId === s.id && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Lightbox ───────────────────────────────────────────────────────────

// Lightbox interne supprimée — utilise ListingLightbox importé

// ─── Visit date picker (hidden by default, shown on CTA click) ──────────

// VisitDatePicker removed — replaced by RequestVisitModal (connected to Supabase)

// ─── Ask MEGGA AI — inline chat contextuel ──────────────────────────────

// Icons for AI suggestions
import { TrendingDown, AlertTriangle, HandshakeIcon, Receipt } from 'lucide-react'

const AI_SUGGESTION_ICONS = [TrendingDown, AlertTriangle, HandshakeIcon, Receipt]

const AI_SUGGESTIONS: Record<string, Array<{ label: string; prompt: string }>> = {
  fr: [
    { label: 'Bon prix ?', prompt: 'Est-ce que ce bien est à un bon prix par rapport au marché ?' },
    { label: 'Risques ?', prompt: 'Quels sont les risques potentiels de ce bien ?' },
    { label: 'Négociation', prompt: 'Comment négocier le prix de ce bien ? Quelle offre serait raisonnable ?' },
    { label: 'Frais à prévoir', prompt: 'Quels sont tous les frais à prévoir en plus du prix d\'achat ?' },
  ],
  fr_rent: [
    { label: 'Loyer juste ?', prompt: 'Est-ce que ce loyer est cohérent avec le marché pour ce quartier et cette surface ?' },
    { label: 'Charges incluses ?', prompt: 'Quelles charges sont typiquement incluses ou en supplément du loyer en Suisse ?' },
    { label: 'Garantie loyer', prompt: 'Comment fonctionne la garantie de loyer en Suisse (art. 257e CO) ? Quels sont mes droits ?' },
    { label: 'Dossier candidat', prompt: 'Quels documents préparer pour mon dossier de candidature (attestation de non-poursuite, etc.) ?' },
  ],
  de: [
    { label: 'Guter Preis?', prompt: 'Ist diese Immobilie im Vergleich zum Markt gut bewertet?' },
    { label: 'Risiken?', prompt: 'Welche potenziellen Risiken gibt es bei dieser Immobilie?' },
    { label: 'Verhandlung', prompt: 'Wie kann ich den Preis verhandeln? Welches Angebot wäre angemessen?' },
    { label: 'Nebenkosten', prompt: 'Welche zusätzlichen Kosten kommen zum Kaufpreis hinzu?' },
  ],
  de_rent: [
    { label: 'Miete fair?', prompt: 'Ist diese Miete im Vergleich zum Markt angemessen für diese Lage und Fläche?' },
    { label: 'Nebenkosten?', prompt: 'Welche Nebenkosten sind in der Schweiz üblicherweise in der Miete enthalten oder zusätzlich?' },
    { label: 'Mietkaution', prompt: 'Wie funktioniert die Mietkaution in der Schweiz (Art. 257e OR)?' },
    { label: 'Bewerbung', prompt: 'Welche Dokumente brauche ich für meine Mietbewerbung (Betreibungsauszug, etc.)?' },
  ],
  en: [
    { label: 'Good price?', prompt: 'Is this property well priced compared to the market?' },
    { label: 'Risks?', prompt: 'What are the potential risks of this property?' },
    { label: 'Negotiation', prompt: 'How should I negotiate the price? What would be a reasonable offer?' },
    { label: 'Extra costs', prompt: 'What additional costs should I expect on top of the purchase price?' },
  ],
  en_rent: [
    { label: 'Fair rent?', prompt: 'Is this rent fair compared to the market for this area and size?' },
    { label: 'Charges?', prompt: 'What utility charges are typically included in or added to the rent in Switzerland?' },
    { label: 'Deposit', prompt: 'How does a rental deposit work in Switzerland (art. 257e CO)?' },
    { label: 'Application', prompt: 'What documents do I need for my rental application (debt enforcement certificate, etc.)?' },
  ],
  it: [
    { label: 'Buon prezzo?', prompt: 'Questo immobile ha un buon prezzo rispetto al mercato?' },
    { label: 'Rischi?', prompt: 'Quali sono i rischi potenziali di questo immobile?' },
    { label: 'Negoziazione', prompt: 'Come posso negoziare il prezzo? Quale offerta sarebbe ragionevole?' },
    { label: 'Costi extra', prompt: 'Quali costi aggiuntivi devo prevedere oltre al prezzo di acquisto?' },
  ],
  it_rent: [
    { label: 'Affitto giusto?', prompt: 'Questo affitto è corretto rispetto al mercato per questa zona e superficie?' },
    { label: 'Spese incluse?', prompt: 'Quali spese sono tipicamente incluse o aggiuntive all\'affitto in Svizzera?' },
    { label: 'Cauzione', prompt: 'Come funziona la cauzione in Svizzera (art. 257e CO)?' },
    { label: 'Candidatura', prompt: 'Quali documenti preparare per la candidatura (certificato di non-pignoramento, ecc.)?' },
  ],
}

const AI_LANG_LABELS: Record<string, { placeholder: string; welcome: string; langInstruction: string }> = {
  fr: { placeholder: 'Posez votre question...', welcome: 'Je connais ce bien en détail. Posez-moi vos questions !', langInstruction: 'Réponds en français.' },
  de: { placeholder: 'Stellen Sie Ihre Frage...', welcome: 'Ich kenne diese Immobilie im Detail. Stellen Sie mir Ihre Fragen!', langInstruction: 'Antworte auf Deutsch.' },
  en: { placeholder: 'Ask your question...', welcome: 'I know this property in detail. Ask me anything!', langInstruction: 'Reply in English.' },
  it: { placeholder: 'Fai la tua domanda...', welcome: 'Conosco questo immobile in dettaglio. Chiedetemi tutto!', langInstruction: 'Rispondi in italiano.' },
}

function AskMeggaAI({ listing, walkScore: ws, marketTemp: mt, isMobile }: {
  listing: TransformedListing
  walkScore: { score: number; label: string } | null
  marketTemp: { score: number; label: string; avgDaysOnMarket: number; priceDropPct: number; medianPricePerM2: number } | null
  isMobile?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  // Detect language
  const lang = (localStorage.getItem('megga-language') || navigator.language.split('-')[0] || 'fr').slice(0, 2)
  const validLang = ['fr', 'de', 'en', 'it'].includes(lang) ? lang : 'fr'
  const isRent = listing.transaction_type === 'rent'
  const suggestionsKey = isRent ? `${validLang}_rent` : validLang
  const suggestions = AI_SUGGESTIONS[suggestionsKey] || AI_SUGGESTIONS[validLang] || AI_SUGGESTIONS.fr
  const labels = AI_LANG_LABELS[validLang] || AI_LANG_LABELS.fr

  // Build context (rent-aware labels)
  const context = [
    `Bien : ${listing.title}`,
    isRent ? `Loyer : ${formatCHF(listing.price)}/mois` : `Prix : ${formatCHF(listing.price)}`,
    listing.surface_m2 > 0 ? `Surface : ${listing.surface_m2} m²` : '',
    listing.price > 0 && listing.surface_m2 > 0 ? `Prix/m² : ${formatCHF(Math.round(listing.price / listing.surface_m2))}` : '',
    `Type : ${TYPE_LABELS[listing.type] || listing.type}, ${listing.rooms} pièces, ${listing.bedrooms} chambres`,
    `Adresse : ${listing.address}, ${listing.postal_code} ${listing.city} (${listing.canton})`,
    listing.floor > 0 ? `Étage : ${listing.floor}e` : '',
    listing.condition ? `État : ${CONDITION_LABELS[listing.condition] || listing.condition}` : '',
    listing.charges_monthly > 0 ? `Charges : ${formatCHF(listing.charges_monthly)}/mois` : '',
    listing.days_on_market > 0 ? `En ligne depuis : ${listing.days_on_market} jours` : '',
    listing.is_hot ? 'Le prix a été réduit récemment' : '',
    ws ? `Walk Score : ${ws.score}/100 (${ws.label})` : '',
    mt ? `Température marché ${listing.canton} : ${mt.score}/100 (${mt.label}), médiane ${formatCHF(mt.medianPricePerM2)}/m², ${mt.priceDropPct}% de baisses` : '',
    listing.features.length > 0 ? `Points forts : ${listing.features.join(', ')}` : '',
    listing.description ? `Description : ${listing.description.slice(0, 300)}` : '',
  ].filter(Boolean).join('\n')

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return
    const userMsg = { role: 'user' as const, content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          action: 'chat',
          message: text,
          context: {
            system_context: `Tu es l'assistant immobilier MEGGA. Un acheteur te pose une question sur un bien spécifique. Voici les données du bien :\n\n${context}\n\nRéponds de manière concise (max 150 mots), factuelle et utile. Utilise les données fournies. Format : texte simple, pas de markdown. ${labels.langInstruction}`,
          },
          conversation_history: messages.slice(-6),
        }),
      })
      if (!res.ok) throw new Error('Erreur API')
      const data = await res.json()
      const reply = (data.response || data.message || 'Désolé, je n\'ai pas pu répondre.') as string
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur de connexion. Réessayez.' }])
    } finally {
      setIsLoading(false)
    }
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // ── Closed state: premium button ──
  if (!isOpen) {
    if (isMobile) {
      // FAB for mobile
      return (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 left-4 z-50 w-12 h-12 rounded-full bg-accent shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105"
          aria-label="MEGGA AI"
        >
          <Sparkles className="w-5 h-5 text-white" />
        </button>
      )
    }
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full h-11 border border-theme-border text-theme-secondary hover:border-theme-active hover:text-theme-primary font-medium rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
      >
        <Sparkles className="w-4.5 h-4.5" />
        Demandez à MEGGA AI
      </button>
    )
  }

  // ── Open state: chat panel ──
  const chatPanel = (
    <div className={cn(
      'rounded-lg border border-accent/20 overflow-hidden bg-theme-card',
      isMobile && 'fixed bottom-0 left-0 right-0 z-50 rounded-b-none max-h-[70vh] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-accent to-indigo-600">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">MEGGA AI</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className={cn('overflow-y-auto scrollbar-hide p-4 space-y-3', isMobile ? 'max-h-[50vh]' : 'max-h-[320px]')}>
        {messages.length === 0 && (
          <div className="space-y-3">
            {/* Welcome message */}
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="bg-theme-section px-3.5 py-2.5 rounded-lg rounded-bl-sm text-xs leading-relaxed text-theme-secondary">
                {labels.welcome}
              </div>
            </div>
            {/* Suggestion pills with icons */}
            <div className="grid grid-cols-2 gap-2 pl-9">
              {suggestions.map((s, i) => {
                const Icon = AI_SUGGESTION_ICONS[i] || Sparkles
                return (
                  <button
                    key={s.label}
                    onClick={() => sendMessage(s.prompt)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-theme-border-subtle text-xs font-medium text-theme-secondary hover:border-accent/30 hover:bg-accent/5 hover:text-accent transition-all text-left"
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'gap-2.5')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
              </div>
            )}
            <div className={cn(
              'max-w-[80%] px-3.5 py-2.5 rounded-lg text-xs leading-relaxed',
              msg.role === 'user'
                ? 'bg-accent text-white rounded-br-sm'
                : 'bg-theme-section text-theme-secondary rounded-bl-sm'
            )}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
            </div>
            <div className="bg-theme-section px-3.5 py-2.5 rounded-lg rounded-bl-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-theme-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-theme-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-theme-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-theme-border-subtle p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
          placeholder={labels.placeholder}
          className="flex-1 h-9 px-3.5 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-secondary placeholder:text-theme-muted"
          autoFocus
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="h-9 w-9 rounded-lg border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active flex items-center justify-center transition-colors disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  // Mobile: render as bottom sheet with backdrop
  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setIsOpen(false)} />
        {chatPanel}
      </>
    )
  }

  return chatPanel
}

// ─── Main component ─────────────────────────────────────────────────────

export default function ListingPreviewPanel({ listingId, onClose, isCompared, onToggleCompare, inline }: ListingPreviewPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [activeSection, setActiveSection] = useState(BASE_SECTIONS[0].id)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [showStaged, setShowStaged] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [floorPlanRoom, setFloorPlanRoom] = useState<string | null>(null)
  const mobileCarouselRef = useRef<HTMLDivElement>(null)

  const rawId = listingId?.replace('market-', '').replace('internal-', '')
  const isMarket = listingId?.startsWith('market-')
  const isInternal = listingId?.startsWith('internal-')

  const { data: marketData, isLoading: loadingMarket } = useMarketListing(isMarket ? rawId : undefined)
  const { data: internalData, isLoading: loadingInternal } = useQuery({
    queryKey: ['internal-listing', rawId],
    queryFn: async () => {
      const { data, error } = await supabase.from('properties').select('*').eq('id', rawId!).single()
      if (error) throw error
      return data
    },
    enabled: !!isInternal && !!rawId,
    staleTime: 10 * 60 * 1000,
  })

  const isLoading = (isMarket && loadingMarket) || (isInternal && loadingInternal)

  // Build listing object — use real Flatfox data (no placeholders)
  const listing = (() => {
    if (isMarket && marketData) return transformListing(marketData, 'market')
    if (isInternal && internalData) return transformListing(internalData, 'internal')
    return null
  })()

  // Build sections dynamically (add Plan tab if floor plan exists) — must be before scroll spy useEffect
  const SECTIONS = listing?.floor_plan_url
    ? [BASE_SECTIONS[0], { id: 'preview-plan', label: 'Plan' }, ...BASE_SECTIONS.slice(1)]
    : BASE_SECTIONS

  const { data: marketTemp } = useMarketTemperature(listing?.canton, listing?.city)

  // Walk score
  const { categories: poiCategories, station: nearestStation } = useNeighborhood(listing?.lat, listing?.lng)
  const walkScore = (listing?.lat && listing?.lng) ? calculateWalkScore(poiCategories, nearestStation) : null

  // Similar listings
  const similarFilters = listing ? {
    context: 'buy' as const,
    canton: listing.canton,
    types: [listing.type],
    minPrice: Math.round(listing.price * 0.7),
    maxPrice: Math.round(listing.price * 1.3),
  } : {}
  const { data: similarData } = useMarketListings(listing ? similarFilters : {})
  const similarListings = (similarData?.pages.flatMap(p => p.listings) ?? [])
    .filter(l => l.id !== listingId)
    .slice(0, 6)

  // Reset state when listing changes — intentional setState on prop change
  useEffect(() => {
    setPhotoIndex(0)
    setMobilePhotoIndex(0)
    setDescExpanded(false)
    setActiveSection(BASE_SECTIONS[0].id)
    setShowDatePicker(false)
    setLightboxOpen(false)
    setFloorPlanRoom(null)
  }, [listingId])

  // Escape key + body scroll lock
  useEffect(() => {
    if (!listingId) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightboxOpen) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [listingId, onClose, lightboxOpen])

  // Scroll spy
  useEffect(() => {
    if (!listingId || !scrollRef.current) return
    const container = scrollRef.current
    const observers: IntersectionObserver[] = []
    for (const s of SECTIONS) {
      const el = container.querySelector(`#${s.id}`)
      if (!el) continue
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(s.id) },
        { root: container, rootMargin: '-20% 0px -70% 0px' }
      )
      obs.observe(el)
      observers.push(obs)
    }
    return () => observers.forEach(o => o.disconnect())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, listing])

  if (!listingId) return null

  const originalPhotos = listing?.photos || []
  const stagedPhotos = listing?.staged_photos || []
  const hasStagedPhotos = stagedPhotos.length > 0
  const photos = showStaged && hasStagedPhotos ? stagedPhotos : originalPhotos
  const features = listing?.features || []
  const photoCount = photos.length
  const pricePerM2 = listing ? (listing.price_per_m2 > 0 ? listing.price_per_m2 : (listing.surface_m2 > 0 ? Math.round(listing.price / listing.surface_m2) : 0)) : 0

  function scrollToSection(id: string) {
    const el = scrollRef.current?.querySelector(`#${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openLightbox(idx: number) {
    setLightboxIndex(idx)
    setLightboxOpen(true)
  }

  // Build characteristics array
  const characteristics: { label: string; value: string }[] = []
  if (listing) {
    if (listing.type) characteristics.push({ label: 'Type', value: TYPE_LABELS[listing.type] || listing.type })
    if (listing.rooms > 0) characteristics.push({ label: 'Pièces', value: String(listing.rooms) })
    if (listing.bedrooms > 0) characteristics.push({ label: 'Chambres', value: String(listing.bedrooms) })
    if (listing.bathrooms > 0) characteristics.push({ label: 'Salles de bain', value: String(listing.bathrooms) })
    if (listing.surface_m2 > 0) characteristics.push({ label: 'Surface habitable', value: formatSurface(listing.surface_m2) })
    if (listing.floor > 0) characteristics.push({ label: 'Étage', value: `${listing.floor}e` })
    if (listing.year_built > 0) characteristics.push({ label: 'Année de construction', value: String(listing.year_built) })
    if (listing.charges_monthly > 0) characteristics.push({ label: 'Charges mensuelles', value: formatCHF(listing.charges_monthly) })
    if (listing.condition) characteristics.push({ label: 'État', value: CONDITION_LABELS[listing.condition] || listing.condition })
  }

  const content = (
    <div className={cn(
      'flex flex-col bg-theme-card',
      inline
        ? 'h-full'
        : 'fixed top-0 bottom-0 left-1/2 -translate-x-1/2 z-[80] animate-in fade-in duration-200 shadow-2xl border-x border-theme-border w-[95%] max-w-[1400px]'
    )}>

      {/* ── Zillow-style header bar ── */}
      <div className={cn(
        'relative flex items-center justify-between shrink-0 border-b border-theme-border-subtle',
        inline ? 'h-11 px-4' : 'h-14 px-4 md:px-6 lg:px-8'
      )}>
        <button
          onClick={onClose}
          aria-label="Retour"
          className="flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Retour</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-theme-secondary hover:text-theme-primary transition-colors cursor-pointer"
          >
            <Heart className={cn('h-3.5 w-3.5', isFavorite && 'fill-red-500 text-red-500')} />
            <span className="hidden sm:inline">Sauvegarder</span>
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: listing?.title || '', url: window.location.href })
              } else {
                navigator.clipboard.writeText(window.location.href)
              }
            }}
            aria-label="Partager"
            className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-theme-secondary hover:text-theme-primary transition-colors cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Partager</span>
          </button>
          <button
            aria-label="Plus d'options"
            className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-theme-secondary hover:text-theme-primary transition-colors cursor-pointer"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="overflow-y-auto flex-1 scrollbar-hide">

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[400px]">
              <div className="h-8 w-8 border-2 border-theme-border border-t-accent rounded-full animate-spin mb-4" />
              <p className="text-sm text-theme-tertiary">Chargement...</p>
            </div>
          ) : listing ? (
            <>
              {/* ════════════════════════════════════════════════════════════
                  PHOTO GALLERY — Desktop: 3-col grid, Mobile: carousel
                  ════════════════════════════════════════════════════════════ */}

              {/* Desktop gallery — Zillow 5-photo layout */}
              <div className="hidden md:block">
                {photoCount > 0 ? (
                  <div className="grid grid-cols-4 grid-rows-2 gap-[3px] h-[520px]">
                    {/* Main photo — spans 2 cols + 2 rows */}
                    <div
                      className="col-span-2 row-span-2 relative overflow-hidden cursor-pointer group"
                      role="button"
                      tabIndex={0}
                      aria-label="Photo principale"
                      onClick={() => openLightbox(0)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(0) } }}
                    >
                      <img
                        src={optimizeImageUrl(photos[photoIndex], IMAGE_PRESETS.full)}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                      {/* MEGGA Staging toggle */}
                      {hasStagedPhotos && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowStaged(!showStaged) }}
                          className={cn(
                            'absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm transition-colors z-10',
                            showStaged
                              ? 'bg-accent/90 text-white'
                              : 'bg-white/90 text-theme-secondary hover:bg-white'
                          )}
                        >
                          <span className="text-sm">✨</span>
                          {showStaged ? 'Voir original' : 'Voir meublé'}
                        </button>
                      )}
                      {showStaged && hasStagedPhotos && (
                        <div className="absolute top-4 left-4 bg-accent/80 text-white text-xs font-semibold px-2 py-0.5 rounded z-10">
                          MEGGA Staging
                        </div>
                      )}
                    </div>

                    {/* Top-right photos */}
                    <div className="overflow-hidden cursor-pointer" role="button" tabIndex={0} aria-label="Photo 2" onClick={() => openLightbox(1)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(1) } }}>
                      <img src={optimizeImageUrl(photos[1] || photos[0], IMAGE_PRESETS.preview)} alt="Photo du bien" className="w-full h-full object-cover" />
                    </div>
                    <div className="overflow-hidden cursor-pointer" role="button" tabIndex={0} aria-label="Photo 3" onClick={() => openLightbox(2)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(2) } }}>
                      <img src={optimizeImageUrl(photos[2] || photos[0], IMAGE_PRESETS.preview)} alt="Photo du bien" className="w-full h-full object-cover" />
                    </div>

                    {/* Bottom-right photos */}
                    <div className="overflow-hidden cursor-pointer" role="button" tabIndex={0} aria-label="Photo 4" onClick={() => openLightbox(3)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(3) } }}>
                      <img src={optimizeImageUrl(photos[3] || photos[1] || photos[0], IMAGE_PRESETS.preview)} alt="Photo du bien" className="w-full h-full object-cover" />
                    </div>
                    <div className="overflow-hidden cursor-pointer relative" role="button" tabIndex={0} aria-label="Photo 5" onClick={() => openLightbox(4)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(4) } }}>
                      <img src={optimizeImageUrl(photos[4] || photos[2] || photos[0], IMAGE_PRESETS.preview)} alt="Photo du bien" className="w-full h-full object-cover" />
                      {/* "See all X photos" button */}
                      {photoCount >= 2 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openLightbox(0) }}
                          className="absolute bottom-3 right-3 bg-theme-card text-theme-primary text-xs font-semibold px-3.5 py-2 rounded-lg border border-theme-border hover:bg-theme-section transition-colors flex items-center gap-2"
                        >
                          <Images className="w-3.5 h-3.5" />
                          Voir les {photoCount} photos
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-[300px] bg-theme-hover flex items-center justify-center">
                    <div className="text-center">
                      <Building2 className="h-12 w-12 text-theme-muted mx-auto mb-2" />
                      <p className="text-sm text-theme-muted">Aucune photo disponible</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile carousel */}
              <div className="md:hidden relative">
                {photoCount > 0 ? (
                  <>
                    <div
                      ref={mobileCarouselRef}
                      className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                      style={{ height: 'min(55vw, 360px)' }}
                      onScroll={(e) => {
                        const el = e.currentTarget
                        const idx = Math.round(el.scrollLeft / el.offsetWidth)
                        setMobilePhotoIndex(idx)
                      }}
                    >
                      {photos.map((photo, i) => (
                        <div key={i} className="w-full flex-shrink-0 snap-center">
                          <img
                            src={optimizeImageUrl(photo, IMAGE_PRESETS.preview)}
                            alt={i === 0 ? listing.title : ''}
                            className="w-full h-full object-cover"
                            onClick={() => openLightbox(i)}
                            loading={i > 2 ? 'lazy' : undefined}
                            decoding="async"
                          />
                        </div>
                      ))}
                    </div>
                    {/* Dots with semi-transparent background */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/20 backdrop-blur-sm rounded-full px-2.5 py-1.5">
                      {photos.slice(0, 7).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-2 h-2 rounded-full transition-all',
                            mobilePhotoIndex === i ? 'bg-white' : 'bg-white/50'
                          )}
                        />
                      ))}
                      {photoCount > 7 && <div className="w-2 h-2 rounded-full bg-white/30" />}
                    </div>
                    {/* Photo counter — tap to open lightbox */}
                    <button
                      onClick={() => openLightbox(mobilePhotoIndex)}
                      aria-label="Voir toutes les photos"
                      className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                      {mobilePhotoIndex + 1}/{photoCount}
                    </button>
                  </>
                ) : (
                  <div className="h-[200px] bg-theme-hover flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-theme-muted" />
                  </div>
                )}
              </div>

              {/* ════════════════════════════════════════════════════════════
                  SECTION NAV TABS
                  ════════════════════════════════════════════════════════════ */}
              <SectionNav activeId={activeSection} onNavigate={scrollToSection} sections={SECTIONS} />

              {/* ════════════════════════════════════════════════════════════
                  CONTENT: 2 columns (scrollable left + sticky CTA right)
                  ════════════════════════════════════════════════════════════ */}
              <div className="flex flex-col md:flex-row">

                {/* ── LEFT: Details ── */}
                <div className="flex-1 min-w-0 px-6 lg:px-8 py-6">

                  {/* ── SECTION: Overview ── */}
                  <div id="preview-overview">

                    {/* Price + address */}
                    <div className="flex items-center gap-2 mb-1">
                      {listing.is_exclusive && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
                      <C2PaBadge verified={listing.c2pa_verified || false} verifiedAt={listing.c2pa_verified_at} />
                    </div>

                    <div className="flex items-baseline gap-3">
                      <h2 className="text-3xl md:text-4xl font-bold text-theme-primary tracking-tight">
                        {listing.transaction_type === 'rent' ? formatRent(listing.price) : formatCHF(listing.price)}
                      </h2>
                      {listing.transaction_type !== 'rent' && pricePerM2 > 0 && (
                        <span className="text-sm text-theme-muted">{formatCHF(pricePerM2)}/m²</span>
                      )}
                      {listing.transaction_type === 'rent' && listing.is_furnished && (
                        <span className="text-sm text-theme-muted">· Meublé</span>
                      )}
                    </div>

                    <p className="mt-1 text-theme-tertiary text-base">
                      {listing.address}, {listing.postal_code} {listing.city} ({listing.canton})
                    </p>

                    {/* Specs — compact inline */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3 text-sm text-theme-secondary">
                      {listing.rooms > 0 && <span className="font-medium">{listing.rooms} pièces</span>}
                      {listing.rooms > 0 && listing.bedrooms > 0 && <span className="text-theme-muted">·</span>}
                      {listing.bedrooms > 0 && <span className="font-medium">{listing.bedrooms} chambres</span>}
                      {listing.bedrooms > 0 && listing.bathrooms > 0 && <span className="text-theme-muted">·</span>}
                      {listing.bathrooms > 0 && <span className="font-medium">{listing.bathrooms} sdb</span>}
                      {listing.bathrooms > 0 && listing.surface_m2 > 0 && <span className="text-theme-muted">·</span>}
                      {listing.surface_m2 > 0 && <span className="font-medium">{listing.surface_m2.toLocaleString('fr-CH')} m²</span>}
                      {listing.type && <><span className="text-theme-muted">·</span><span>{TYPE_LABELS[listing.type] || listing.type}</span></>}
                    </div>

                    {/* — property details moved to Caractéristiques section — */}

                    {/* Badges row: urgency + energy + engagement stats */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {(() => {
                        const badge = getUrgencyBadge(listing.days_on_market, listing.is_hot, listing.is_new)
                        return badge ? (
                          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-md', badge.className)}>
                            {badge.label}
                          </span>
                        ) : null
                      })()}
                      {listing.is_hot && !listing.is_new && listing.days_on_market <= 90 && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-red-50 text-red-600">
                          Baisse de prix
                        </span>
                      )}
                      <EnergyLabelBadge label={listing.energy_label} minergie={listing.minergie_label} />
                      {listing.days_on_market > 3 && (
                        <span className="flex items-center gap-1 text-xs text-theme-muted">
                          <Clock className="h-3 w-3" />
                          {listing.days_on_market}j
                        </span>
                      )}
                    </div>

                    {/* Walk Score — inline compact */}
                    {walkScore && walkScore.score > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        <span className={cn('text-xs font-semibold', walkScore.color)}>{walkScore.score}</span>
                        <span className="text-xs text-theme-muted">Walkabilité — {walkScore.label}</span>
                      </div>
                    )}

                    <div className="border-t border-theme-border-subtle my-6" />

                    {/* Description */}
                    {listing.description && (
                      <div>
                        <h3 className="text-xs font-semibold text-theme-muted capitalize mb-3">Description</h3>
                        <div className={cn(
                          'text-theme-secondary text-sm leading-relaxed',
                          !descExpanded && 'line-clamp-4'
                        )}>
                          {listing.description.split('\n\n').map((p, i) => (
                            <p key={i} className={i > 0 ? 'mt-3' : ''}>{p}</p>
                          ))}
                        </div>
                        {listing.description.length > 200 && (
                          <button
                            onClick={() => setDescExpanded(!descExpanded)}
                            className="flex items-center gap-1 mt-2 text-accent text-sm font-medium hover:underline"
                          >
                            {descExpanded ? (
                              <>Voir moins <ChevronUp className="w-4 h-4" /></>
                            ) : (
                              <>Voir plus <ChevronDown className="w-4 h-4" /></>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Points forts — with icons */}
                    {features.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-xs font-semibold text-theme-muted capitalize mb-3">Points forts</h3>
                        <div className="flex flex-wrap gap-2">
                          {(Array.isArray(features) ? features : Object.keys(features)).map((f, i) => {
                            const label = typeof f === 'string' ? f : String(f)
                            const Icon = getFeatureIcon(label)
                            return (
                              <span
                                key={i}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-section text-theme-secondary text-sm"
                              >
                                <Icon className="w-4 h-4 text-theme-tertiary" />
                                {label}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Agency card — displayed in sidebar only on desktop */}
                  </div>

                  {/* ── SECTION: Floor Plan Interactif ── */}
                  {listing.floor_plan_url && listing.floor_plan_hotspots.length > 0 && (
                    <div id="preview-plan" className="mt-10 pt-8 border-t border-theme-border-subtle">
                      <h3 className="text-xs font-semibold text-theme-muted capitalize mb-4">Plan interactif</h3>
                      <InteractiveFloorPlan
                        floorPlanUrl={listing.floor_plan_url}
                        hotspots={listing.floor_plan_hotspots}
                        activeRoom={floorPlanRoom}
                        onRoomClick={(roomKey, photoUrls) => {
                          if (!roomKey || roomKey === floorPlanRoom) {
                            setFloorPlanRoom(null)
                          } else {
                            setFloorPlanRoom(roomKey)
                            if (photoUrls.length > 0) {
                              setLightboxIndex(0)
                              setLightboxOpen(true)
                            }
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* ── SECTION: Details / Caractéristiques ── */}
                  <div id="preview-details" className="mt-10 pt-8 border-t border-theme-border-subtle">
                    <h3 className="text-xs font-semibold text-theme-muted capitalize mb-4">Caractéristiques</h3>
                    <div className="grid grid-cols-2 gap-x-6">
                      {characteristics.map(({ label, value }, i) => (
                        <div key={i} className={cn('flex items-center justify-between py-2.5 px-2', i % 2 === 0 ? 'bg-theme-section/60' : '')}>
                          <span className="text-sm text-theme-tertiary">{label}</span>
                          <span className="text-sm font-medium text-theme-primary">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── SECTION: Map ── */}
                  <div id="preview-map" className="mt-10 pt-8 border-t border-theme-border-subtle">
                    <h3 className="text-xs font-semibold text-theme-muted capitalize mb-4">Localisation</h3>
                    {listing.lat && listing.lng && MAPBOX_TOKEN ? (
                      <div className="h-[250px] rounded-lg overflow-hidden border border-theme-border-subtle">
                        <MapGL
                          initialViewState={{ latitude: listing.lat, longitude: listing.lng, zoom: 14 }}
                          mapboxAccessToken={MAPBOX_TOKEN}
                          mapStyle="mapbox://styles/mapbox/light-v11"
                          style={{ width: '100%', height: '100%' }}
                          reuseMaps
                          attributionControl={false}
                          interactive={false}
                        >
                          <NavigationControl position="top-right" showCompass={false} />
                          <Marker latitude={listing.lat} longitude={listing.lng} anchor="bottom">
                            <div className="h-7 w-7 bg-accent rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                              <MapPin className="h-3.5 w-3.5 text-white" />
                            </div>
                          </Marker>
                        </MapGL>
                      </div>
                    ) : (
                      <div className="h-[200px] rounded-lg bg-theme-section border border-theme-border-subtle flex items-center justify-center">
                        <div className="text-center">
                          <MapPin className="h-6 w-6 text-theme-muted mx-auto mb-1" />
                          <p className="text-sm text-theme-tertiary">{listing.address}, {listing.city}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── SECTION: Quartier ── */}
                  <div id="preview-quartier" className="mt-10 pt-8 border-t border-theme-border-subtle">
                    <NeighborhoodSection lat={listing.lat} lng={listing.lng} canton={listing.canton} city={listing.city} compact />
                  </div>

                  {/* ── SECTION: Market ── */}
                  <div id="preview-market" className="mt-10 pt-8 border-t border-theme-border-subtle pb-6">
                    <h3 className="text-xs font-semibold text-theme-muted capitalize mb-4">Analyse du marché</h3>
                    <div className="space-y-4">
                      {marketTemp && <MarketTemperatureBadge temperature={marketTemp} />}
                      {isMarket && rawId && <PriceHistoryChart marketListingId={rawId} />}
                      <NaturalHazardBadge lat={listing.lat} lng={listing.lng} />
                      {!marketTemp && !(isMarket && rawId) && !listing.lat && (
                        <p className="text-sm text-theme-muted py-4 text-center">Données marché non disponibles pour ce bien</p>
                      )}
                    </div>
                  </div>

                  {/* ── SECTION: Similar listings ── */}
                  {similarListings.length > 0 && (
                    <div id="preview-similaires" className="mt-10 pt-8 border-t border-theme-border-subtle pb-6">
                      <h3 className="text-xs font-semibold text-theme-muted capitalize mb-4">Biens similaires</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {similarListings.slice(0, 4).map((sl) => {
                          const photo = sl.photos?.[0]
                          return (
                            <button
                              key={sl.id}
                              onClick={() => {
                                // Navigate to this listing within the preview panel
                                const el = scrollRef.current
                                if (el) el.scrollTop = 0
                                // Trigger re-render by changing URL param
                                const params = new URLSearchParams(window.location.search)
                                params.set('listing', sl.id)
                                window.history.replaceState(null, '', `?${params.toString()}`)
                                window.dispatchEvent(new PopStateEvent('popstate'))
                              }}
                              className="rounded-lg border border-theme-border-subtle overflow-hidden hover:border-theme-border transition-all text-left group"
                            >
                              <div className="aspect-[4/3] overflow-hidden bg-theme-hover">
                                {photo ? (
                                  <img
                                    src={optimizeImageUrl(photo, IMAGE_PRESETS.card)}
                                    alt={sl.title}
                                    className="w-full h-full object-cover transition-transform duration-300"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Building2 className="h-8 w-8 text-theme-muted" />
                                  </div>
                                )}
                              </div>
                              <div className="p-3">
                                <p className="text-sm font-semibold text-theme-primary">
                                  {formatCHF(sl.price)}
                                </p>
                                <p className="text-xs text-theme-tertiary truncate mt-0.5">{sl.address}, {sl.city}</p>
                                <div className="flex items-center gap-2 text-xs text-theme-muted mt-1">
                                  {sl.rooms > 0 && <span>{sl.rooms} pièces</span>}
                                  {sl.rooms > 0 && sl.surface_m2 > 0 && <span className="text-theme-muted">·</span>}
                                  {sl.surface_m2 > 0 && <span>{formatSurface(sl.surface_m2)}</span>}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>

                {/* ── RIGHT: Sticky CTA sidebar (desktop) ── */}
                <div className="hidden md:block w-[340px] flex-shrink-0 border-l border-theme-border-subtle">
                  <div className="sticky top-[49px] p-6 space-y-4 max-h-[calc(92vh-420px)] overflow-y-auto scrollbar-hide">

                    {listing.transaction_type === 'rent' ? (
                      /* Rental — single CTA scrolls to regie block below */
                      <button
                        onClick={() => document.getElementById('preview-regie-contact')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        className="w-full h-12 border border-theme-border text-theme-primary font-semibold rounded-lg flex items-center justify-center gap-2 hover:border-accent hover:text-accent transition-colors"
                      >
                        <Phone className="w-5 h-5" />
                        Contacter la régie
                      </button>
                    ) : (
                      <>
                        {/* Primary CTA */}
                        <button
                          onClick={() => setShowDatePicker(true)}
                          className="w-full h-12 border border-theme-border text-theme-primary font-semibold rounded-lg flex items-center justify-center gap-2 hover:border-accent hover:text-accent transition-colors"
                        >
                          <CalendarDays className="w-5 h-5" />
                          Planifier une visite
                        </button>

                        {/* Secondary CTA */}
                        <button
                          onClick={() => setShowContactModal(true)}
                          className="w-full h-11 bg-theme-card border border-theme-border hover:border-theme-active hover:bg-theme-section text-theme-primary font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                          <Phone className="w-5 h-5" />
                          Contacter l'agent
                        </button>

                        {/* Visit modal (opens via showDatePicker state) */}
                        <RequestVisitModal
                          listingAddress={`${listing.address}, ${listing.city}`}
                          propertyId={listing.id}
                          agencyId=""
                          listingPhoto={photos[0]}
                          listingPrice={formatCHF(listing.price)}
                          open={showDatePicker}
                          onClose={() => setShowDatePicker(false)}
                        />
                      </>
                    )}

                    {/* Tertiary actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsFavorite(!isFavorite)}
                        className={cn(
                          'flex-1 h-10 bg-theme-card border text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors',
                          isFavorite
                            ? 'border-red-200 bg-red-50 text-red-500'
                            : 'border-theme-border hover:border-theme-active text-theme-secondary'
                        )}
                      >
                        <Heart className={cn('w-4 h-4', isFavorite && 'fill-current')} />
                        {isFavorite ? 'Sauvegardé' : 'Sauvegarder'}
                      </button>
                      {onToggleCompare && (
                        <button
                          onClick={onToggleCompare}
                          className={cn(
                            'h-10 w-10 border rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
                            isCompared
                              ? 'bg-accent border-accent text-white'
                              : 'bg-theme-card border-theme-border hover:border-theme-active text-theme-secondary'
                          )}
                          aria-label={isCompared ? 'Retirer de la comparaison' : 'Ajouter à la comparaison'}
                        >
                          {isCompared ? <Check className="w-4 h-4" /> : <GitCompareArrows className="w-4 h-4" />}
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const url = `${window.location.origin}/listing/${listingId}`
                          const title = listing.title || 'Bien immobilier'
                          const text = `${title} — ${formatCHF(listing.price)}`
                          if (navigator.share) {
                            try {
                              await navigator.share({ title, text, url })
                            } catch { /* user cancelled */ }
                          } else {
                            await navigator.clipboard.writeText(url)
                            setShareCopied(true)
                            setTimeout(() => setShareCopied(false), 2000)
                          }
                        }}
                        className="flex-1 h-10 bg-theme-card border border-theme-border hover:border-theme-active text-theme-secondary text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {shareCopied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                        {shareCopied ? 'Copié' : 'Partager'}
                      </button>
                    </div>

                    <div className="border-t border-theme-border-subtle my-2" />

                    {/* Ask MEGGA AI — positioned high for visibility */}
                    <AskMeggaAI listing={listing} walkScore={walkScore} marketTemp={marketTemp ?? null} />

                    <div className="border-t border-theme-border-subtle my-2" />

                    {/* Agency / regie info */}
                    {listing.transaction_type === 'rent' ? (
                      (() => {
                        const regie = resolveRegieContact(
                          { external_regie: listing.external_regie },
                          listing.agency_name
                            ? { name: listing.agency_name, phone: '', email: '' }
                            : null,
                        )
                        return regie ? (
                          <div id="preview-regie-contact">
                            <RegieContactCard regie={regie} />
                          </div>
                        ) : null
                      })()
                    ) : (
                      listing.agency_name && (
                        <AgentCard
                          variant="compact"
                          agent={{
                            name: listing.agency_name,
                            agency: listing.agency_name,
                            phone: '',
                            email: '',
                            photo: '',
                          }}
                          onClick={() => setShowContactModal(true)}
                        />
                      )
                    )}

                    <div className="border-t border-theme-border-subtle my-2" />

                    {/* Property tax estimate — buy only */}
                    {listing.transaction_type !== 'rent' && listing.canton && (
                      <>
                        <PropertyTaxSection
                          price={listing.price}
                          canton={listing.canton}
                          chargesMonthly={listing.charges_monthly}
                        />
                        <div className="border-t border-theme-border-subtle my-2" />
                      </>
                    )}

                    {/* Full page link */}
                    <Link
                      to={`/listing/${listingId}`}
                      className="block text-center text-sm font-medium text-accent hover:underline"
                    >
                      Voir la fiche complète →
                    </Link>
                  </div>
                </div>
              </div>

              {/* ── Footer ── */}
              <Footer />

              {/* ── Mobile CTA bar ── */}
              <div className="md:hidden sticky bottom-0 bg-theme-card border-t border-theme-border-subtle p-4 flex gap-3 z-40">
                {listing.transaction_type === 'rent' ? (
                  /* Rental — single CTA "Contacter la régie" */
                  <button
                    onClick={() => document.getElementById('preview-regie-contact')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="flex-1 h-11 flex items-center justify-center gap-2 text-sm font-semibold border border-theme-border text-theme-primary rounded-lg hover:border-accent hover:text-accent transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    Contacter la régie
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowDatePicker(true)}
                      className="flex-1 h-11 flex items-center justify-center gap-2 text-sm font-semibold border border-theme-border text-theme-primary rounded-lg hover:border-accent hover:text-accent transition-colors"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Visite
                    </button>
                    <button
                      onClick={() => setShowContactModal(true)}
                      className="flex-1 h-11 flex items-center justify-center gap-2 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:border-theme-active transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      Appeler
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={cn(
                    'h-11 w-11 rounded-lg border flex items-center justify-center transition-colors',
                    isFavorite ? 'bg-red-50 border-red-200 text-red-500' : 'border-theme-border text-theme-tertiary'
                  )}
                >
                  <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
                </button>
              </div>

              {/* Mobile AI FAB */}
              <div className="md:hidden">
                <AskMeggaAI listing={listing} walkScore={walkScore} marketTemp={marketTemp ?? null} isMobile />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px]">
              <p className="text-sm text-theme-tertiary">Bien non trouvé</p>
            </div>
          )}
        </div>

      {/* Contact Agent Modal */}
      {listing && (
        <ContactAgentModal
          open={showContactModal}
          onClose={() => setShowContactModal(false)}
          agent={{
            name: listing.agency_name || 'Agent MEGGA',
            agency: listing.agency_name || 'MEGGA Real Estate',
            phone: '',
            email: 'contact@megga.ch',
            photo: '',
          }}
          listingTitle={listing.title}
          listingAddress={`${listing.address}, ${listing.city}`}
        />
      )}

      {/* Lightbox */}
      {listing && (
        <ListingLightbox
          photos={photos}
          open={lightboxOpen}
          index={Math.min(lightboxIndex, photos.length - 1)}
          onClose={() => { setLightboxOpen(false); setFloorPlanRoom(null) }}
          onIndexChange={setLightboxIndex}
          photoTags={listing.photo_tags}
          floorPlanUrl={listing.floor_plan_url || undefined}
          floorPlanHotspots={listing.floor_plan_hotspots}
          stagedPhotos={listing.staged_photos.length > 0 ? listing.staged_photos : undefined}
          listingId={listingId}
        />
      )}
    </div>
  )

  if (inline) return content
  return createPortal(
    <>
      <div className="fixed inset-0 z-[79] bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onClose} />
      {content}
    </>,
    document.body
  )
}
