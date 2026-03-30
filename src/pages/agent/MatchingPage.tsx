import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronDown, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { useMatching, type MatchResult } from '@/hooks/useMatching'
import { useExternalMatching, type ExternalListing, type ExternalSearchCriteria } from '@/hooks/useExternalMatching'
import { useContacts } from '@/hooks/useContacts'
import SendMatchDialog from '@/components/matching/SendMatchDialog'
import PageTransition from '@/components/layout/PageTransition'
import { PROPERTY_TYPE_LABELS } from '@/lib/constants'

// ── (Score utilities removed — breakdown now in preview modal) ───────────────

// ── Match Preview Modal ─────────────────────────────────────────────────────

function MatchPreviewModal({ match, onClose, onSend }: {
  match: MatchResult
  onClose: () => void
  onSend: () => void
}) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const listing = match.listing
  const photos = listing.photos || []
  const isSent = match.status === 'sent'

  const criteria = [
    { label: 'Budget', score: match.reasons.budget.score, max: 30, ok: match.reasons.budget.match },
    { label: 'Zone', score: match.reasons.zone.score, max: 25, ok: match.reasons.zone.match },
    { label: 'Type', score: match.reasons.type.score, max: 15, ok: match.reasons.type.match },
    { label: 'Surface', score: match.reasons.rooms.score, max: 15, ok: match.reasons.rooms.match },
    { label: 'Extras', score: match.reasons.features.score, max: 15, ok: match.reasons.features.match },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-theme-card border border-theme-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Photo carousel */}
        {photos.length > 0 && (
          <div className="relative aspect-[16/9] bg-black">
            <img
              src={photos[photoIdx]}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            {/* Nav arrows */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
                {/* Dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIdx(i)}
                      className={cn('w-1.5 h-1.5 rounded-full transition-colors', i === photoIdx ? 'bg-white' : 'bg-white/40')}
                    />
                  ))}
                </div>
              </>
            )}
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            {/* Photo count */}
            <span className="absolute bottom-3 right-3 text-[11px] text-white/70 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md">
              {photoIdx + 1}/{photos.length}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs text-theme-tertiary mb-1">
                {PROPERTY_TYPE_LABELS[listing.type as keyof typeof PROPERTY_TYPE_LABELS] || listing.type} · {listing.city} ({listing.canton})
              </p>
              <h2 className="text-lg font-semibold text-theme-primary">{listing.title}</h2>
              <p className="text-xs text-theme-tertiary mt-0.5">{listing.address}, {listing.postal_code} {listing.city}</p>
            </div>
            <p className="text-lg font-semibold text-theme-primary shrink-0">{formatCHF(listing.price)}</p>
          </div>

          {/* Key stats */}
          <div className="flex gap-6 py-3 border-y border-theme-border-subtle mb-4">
            <div>
              <p className="text-xs text-theme-tertiary">Pièces</p>
              <p className="text-sm font-medium text-theme-primary">{listing.rooms}</p>
            </div>
            <div>
              <p className="text-xs text-theme-tertiary">Chambres</p>
              <p className="text-sm font-medium text-theme-primary">{listing.bedrooms}</p>
            </div>
            <div>
              <p className="text-xs text-theme-tertiary">Surface</p>
              <p className="text-sm font-medium text-theme-primary">{listing.surface_m2} m²</p>
            </div>
            {listing.floor != null && (
              <div>
                <p className="text-xs text-theme-tertiary">Étage</p>
                <p className="text-sm font-medium text-theme-primary">{listing.floor}/{listing.total_floors}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-theme-tertiary">Année</p>
              <p className="text-sm font-medium text-theme-primary">{listing.year_built}</p>
            </div>
            {listing.charges_monthly > 0 && (
              <div>
                <p className="text-xs text-theme-tertiary">Charges</p>
                <p className="text-sm font-medium text-theme-primary">{formatCHF(listing.charges_monthly)}/mois</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-4">
            <p className="text-sm text-theme-secondary leading-relaxed whitespace-pre-line line-clamp-4">
              {listing.description}
            </p>
          </div>

          {/* Features */}
          {Object.keys(listing.features).length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-theme-tertiary mb-2">Caractéristiques</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(listing.features).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-1 border-b border-theme-border-subtle">
                    <span className="text-xs text-theme-secondary">{key}</span>
                    <span className="text-xs font-medium text-theme-primary">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score breakdown */}
          <div className="rounded-lg border border-theme-border p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-theme-primary">Score de compatibilité</p>
              <p className="text-sm font-semibold text-theme-primary">{match.score}%</p>
            </div>
            <div className="h-1.5 bg-theme-border rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full bg-theme-primary" style={{ width: `${match.score}%` }} />
            </div>
            <div className="space-y-1.5">
              {criteria.map((c) => (
                <div key={c.label} className="flex items-center gap-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.ok ? 'bg-emerald-500' : 'bg-gray-400')} />
                  <span className="text-xs text-theme-secondary flex-1">{c.label}</span>
                  <span className="text-xs font-medium text-theme-primary tabular-nums">{c.score}/{c.max}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Market-specific info */}
          {match.source === 'market' && listing.source_portal && (
            <div className="flex items-center gap-4 py-2.5 px-3 rounded-lg border border-theme-border-subtle mb-4">
              <div>
                <p className="text-[10px] text-theme-tertiary">Source</p>
                <p className="text-xs font-medium text-theme-primary">{listing.source_portal}</p>
              </div>
              {listing.agency_name && (
                <div>
                  <p className="text-[10px] text-theme-tertiary">Agence</p>
                  <p className="text-xs font-medium text-theme-primary">{listing.agency_name}</p>
                </div>
              )}
              {listing.price_per_m2 != null && listing.price_per_m2 > 0 && (
                <div>
                  <p className="text-[10px] text-theme-tertiary">Prix/m²</p>
                  <p className="text-xs font-medium text-theme-primary">{formatCHF(listing.price_per_m2)}</p>
                </div>
              )}
              {(listing.days_on_market ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] text-theme-tertiary">En ligne</p>
                  <p className="text-xs font-medium text-theme-primary">{listing.days_on_market}j</p>
                </div>
              )}
            </div>
          )}

          {/* Match for contact */}
          <p className="text-xs text-theme-tertiary mb-4">
            Match pour <span className="font-medium text-theme-primary">{match.contactName}</span>
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="text-sm text-theme-secondary hover:text-theme-primary transition-colors"
            >
              Fermer
            </button>
            {match.source === 'market' && listing.source_url && (
              <a
                href={listing.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center"
              >
                Voir l'annonce
              </a>
            )}
            {!isSent && (
              <button
                onClick={onSend}
                className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
              >
                Envoyer au client
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Match Card ──────────────────────────────────────────────────────────────

function MatchCard({ match, onSend, onPreview }: {
  match: MatchResult
  onSend: () => void
  onPreview: () => void
}) {
  const isSent = match.status === 'sent'

  const matchedReasons = [
    match.reasons.budget.match && 'Budget',
    match.reasons.zone.match && 'Zone',
    match.reasons.type.match && 'Type',
    match.reasons.rooms.match && 'Surface',
    match.reasons.features.match && 'Extras',
  ].filter(Boolean)

  return (
    <div
      onClick={onPreview}
      className={cn(
        'rounded-xl border overflow-hidden transition-all group cursor-pointer',
        isSent ? 'border-theme-border-subtle opacity-60' : 'border-theme-border hover:border-theme-active',
      )}
    >
      {/* Photo — edge to edge */}
      {match.listing.photos?.[0] && (
        <div className="relative aspect-[16/10]">
          <img
            src={match.listing.photos[0]}
            alt={match.listing.title}
            className="w-full h-full object-cover"
          />
          {match.source === 'market' && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
              <span className="text-[10px] text-white/80 font-medium">
                {match.listing.source_portal || 'Marché'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Info — padded */}
      <div className="p-3.5">
        <p className="text-sm font-medium text-theme-primary truncate">{match.listing.title}</p>
        <p className="text-xs text-theme-tertiary truncate mt-0.5">{match.listing.address}, {match.listing.city}</p>

        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-semibold text-theme-primary">{formatCHF(match.listing.price)}</span>
          <span className="text-xs text-theme-tertiary">{match.listing.rooms} p. · {match.listing.surface_m2} m²</span>
        </div>

        {/* Score bar — monochrome */}
        <div className="mt-3">
          <div className="h-1 bg-theme-border rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-theme-primary transition-all" style={{ width: `${match.score}%` }} />
          </div>
        </div>

        {/* Reasons — monochrome text */}
        {matchedReasons.length > 0 && (
          <p className="text-[10px] text-theme-secondary mt-1.5">
            {matchedReasons.join(' · ')}
          </p>
        )}

        {/* Action */}
        <div className="flex items-center justify-end mt-3">
          {isSent ? (
            <div className="text-right">
              <p className="text-[11px] text-theme-muted">Envoyé par {match.sentVia}</p>
              {match.sentAt && (
                <p className="text-[10px] text-theme-muted">{formatRelativeDate(match.sentAt)}</p>
              )}
            </div>
          ) : (
            <button
              onClick={onSend}
              className="text-xs font-medium text-theme-tertiary opacity-0 group-hover:opacity-100 hover:text-theme-primary transition-all"
            >
              Envoyer →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── External Match Card ──────────────────────────────────────────────────────

function ExternalMatchCard({ listing, onNavigate }: {
  listing: ExternalListing
  onNavigate: (listing: ExternalListing) => void
}) {
  return (
    <div
      onClick={() => onNavigate(listing)}
      className="rounded-xl border border-theme-border overflow-hidden group hover:border-theme-active transition-colors cursor-pointer"
    >
      {listing.photo_url ? (
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={listing.photo_url}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
            {listing.source_logo_url && (
              <img src={listing.source_logo_url} alt="" className="h-3 w-3 rounded-sm" />
            )}
            <span className="text-[10px] text-white/80 font-medium">
              {listing.source_portal}
            </span>
          </div>
        </div>
      ) : (
        <div className="aspect-[16/10] bg-theme-section flex items-center justify-center">
          <span className="text-theme-tertiary text-xs">Pas de photo</span>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-theme-primary truncate">
              {listing.price > 0 ? formatCHF(listing.price) : 'Prix sur demande'}
            </p>
            <p className="text-xs text-theme-secondary mt-0.5 truncate">
              {listing.address || listing.city}
            </p>
          </div>
        </div>

        <p className="text-xs text-theme-tertiary mt-1.5">
          {[
            listing.rooms ? `${listing.rooms} pièces` : null,
            listing.surface_m2 ? `${listing.surface_m2} m²` : null,
          ].filter(Boolean).join(' · ')}
        </p>

        {listing.source_agency && (
          <p className="text-[10px] text-theme-muted mt-2">
            via {listing.source_agency}
          </p>
        )}

        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-theme-border">
          <span className="flex-1 h-8 flex items-center justify-center rounded-lg text-xs font-medium text-theme-tertiary opacity-0 group-hover:opacity-100 transition-all">
            Voir la fiche →
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

type SortBy = 'score' | 'price_asc' | 'price_desc' | 'date'

const SORT_LABELS: Record<SortBy, string> = {
  score: 'Score',
  price_asc: 'Prix ↑',
  price_desc: 'Prix ↓',
  date: 'Récent',
}

const selectClasses = 'h-9 px-3 pr-8 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors appearance-none'

export default function MatchingPage() {
  const navigate = useNavigate()
  const { suggested, sent, internalMatches, marketMatches, sendMatch, runMatching, isRunning } = useMatching()
  const { contacts: allBuyerContacts } = useContacts({ type: 'buyer' })
  const { contacts: bothContacts } = useContacts({ type: 'both' })
  const [search, setSearch] = useState('')
  const [filterBy, setFilterBy] = useState<'all' | 'suggested' | 'sent'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'internal' | 'market'>('all')
  const [sortBy, setSortBy] = useState<SortBy>('score')
  const [contactFilter, setContactFilter] = useState('')
  const [sendDialog, setSendDialog] = useState<MatchResult | null>(null)
  const [previewMatch, setPreviewMatch] = useState<MatchResult | null>(null)
  const [activeMainTab, setActiveMainTab] = useState<'internal' | 'external'>('internal')
  const [externalContactId, setExternalContactId] = useState('')

  // Buyers for external tab selector (from Supabase)
  const buyerContacts = useMemo(() => {
    const buyers = [...allBuyerContacts, ...bothContacts]
    return buyers
      .filter(c => c.search_criteria || (c.search_zones && c.search_zones.length > 0))
      .map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, search_criteria: c.search_criteria, search_zones: c.search_zones }))
  }, [allBuyerContacts, bothContacts])

  // Derive external search criteria from selected contact
  const externalCriteria: ExternalSearchCriteria | null = useMemo(() => {
    if (!externalContactId) return null
    const contact = buyerContacts.find(c => c.id === externalContactId)
    if (!contact?.search_criteria) return null
    const sc = contact.search_criteria
    const typeMap: Record<string, string> = {
      apartment: 'APARTMENT', house: 'HOUSE', villa: 'VILLA',
      'Appartement': 'APARTMENT', 'Maison': 'HOUSE', 'Villa': 'VILLA',
    }
    const zone = sc.zones?.[0] ?? contact.search_zones?.[0] ?? 'geneve'
    if (!sc.budget_max) return null
    return {
      zone,
      type: typeMap[sc.type ?? ''] ?? 'APARTMENT',
      budget_max: sc.budget_max,
      budget_min: sc.budget_min,
      rooms_min: sc.rooms_min,
    }
  }, [externalContactId, buyerContacts])

  const {
    data: externalListings,
    isLoading: isLoadingExternal,
    error: externalError,
    refetch: refetchExternal,
  } = useExternalMatching(externalCriteria)

  // All unique contacts for filter dropdown
  const allContacts = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of [...suggested, ...sent]) {
      if (!map.has(m.contactId)) map.set(m.contactId, m.contactName)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [suggested, sent])

  const allMatches = useMemo(() => {
    let list = filterBy === 'suggested' ? suggested : filterBy === 'sent' ? sent : [...suggested, ...sent]
    // Source filter
    if (sourceFilter === 'internal') {
      list = list.filter((m) => m.source === 'internal')
    } else if (sourceFilter === 'market') {
      list = list.filter((m) => m.source === 'market')
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((m) =>
        m.contactName.toLowerCase().includes(q) ||
        m.listing.title.toLowerCase().includes(q) ||
        m.listing.city.toLowerCase().includes(q)
      )
    }
    if (contactFilter) {
      list = list.filter((m) => m.contactId === contactFilter)
    }
    // Sort
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'score': return b.score - a.score
        case 'price_asc': return a.listing.price - b.listing.price
        case 'price_desc': return b.listing.price - a.listing.price
        case 'date': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default: return 0
      }
    })
    return list
  }, [suggested, sent, search, filterBy, sourceFilter, sortBy, contactFilter])

  // Group by contact
  const groupedByContact = useMemo(() => {
    const groups = new Map<string, { name: string; matches: MatchResult[] }>()
    for (const m of allMatches) {
      const existing = groups.get(m.contactId)
      if (existing) {
        existing.matches.push(m)
      } else {
        groups.set(m.contactId, { name: m.contactName, matches: [m] })
      }
    }
    return Array.from(groups.entries())
  }, [allMatches])

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">Matching</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">
              Acheteurs ↔ Biens compatibles
            </p>
          </div>
          <button
            onClick={() => {
              if (contactFilter) {
                runMatching(contactFilter)
              }
            }}
            disabled={isRunning || !contactFilter}
            className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-40"
          >
            {isRunning ? 'Analyse en cours...' : 'Lancer le matching'}
          </button>
        </div>

        {/* Main tabs: Portefeuille / Marché */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveMainTab('internal')}
            className={cn(
              'h-9 px-4 rounded-lg text-sm transition-colors',
              activeMainTab === 'internal'
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'text-theme-secondary hover:text-theme-primary'
            )}
          >
            Portefeuille
          </button>
          <button
            onClick={() => setActiveMainTab('external')}
            className={cn(
              'h-9 px-4 rounded-lg text-sm transition-colors',
              activeMainTab === 'external'
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'text-theme-secondary hover:text-theme-primary'
            )}
          >
            Marché
            {externalListings && externalListings.length > 0 && (
              <span className="ml-1.5 text-xs text-theme-tertiary">{externalListings.length}</span>
            )}
          </button>
        </div>

        {activeMainTab === 'internal' && <>
        {/* KPI Summary */}
        <div className="flex items-center gap-6 py-3 px-4 rounded-xl border border-theme-border">
          <div>
            <p className="text-[11px] text-theme-tertiary uppercase tracking-wider">Total matchs</p>
            <p className="text-lg font-semibold text-theme-primary">{suggested.length + sent.length}</p>
          </div>
          <div className="h-8 w-px bg-theme-border" />
          <div>
            <p className="text-[11px] text-theme-tertiary uppercase tracking-wider">À envoyer</p>
            <p className="text-lg font-semibold text-theme-primary">{suggested.length}</p>
          </div>
          <div className="h-8 w-px bg-theme-border" />
          <div>
            <p className="text-[11px] text-theme-tertiary uppercase tracking-wider">Envoyés</p>
            <p className="text-lg font-semibold text-theme-primary">{sent.length}</p>
          </div>
          <div className="h-8 w-px bg-theme-border" />
          <div>
            <p className="text-[11px] text-theme-tertiary uppercase tracking-wider">Contacts</p>
            <p className="text-lg font-semibold text-theme-primary">{groupedByContact.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="flex items-center border border-theme-border rounded-lg p-0.5">
            {(['all', 'suggested', 'sent'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterBy(f)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  filterBy === f ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
                )}
              >
                {f === 'all' ? 'Tous' : f === 'suggested' ? 'À envoyer' : 'Envoyés'}
              </button>
            ))}
          </div>

          {/* Source filter */}
          <div className="flex items-center border border-theme-border rounded-lg p-0.5">
            {(['all', 'internal', 'market'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSourceFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  sourceFilter === f ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
                )}
              >
                {f === 'all' ? 'Tous' : f === 'internal' ? `Interne${internalMatches.length ? ` (${internalMatches.length})` : ''}` : `Marché${marketMatches.length ? ` (${marketMatches.length})` : ''}`}
              </button>
            ))}
          </div>

          {/* Contact filter */}
          <div className="relative">
            <select value={contactFilter} onChange={(e) => setContactFilter(e.target.value)} className={selectClasses}>
              <option value="">Contact</option>
              {allContacts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className={selectClasses}>
              {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          {(search || contactFilter || filterBy !== 'all' || sourceFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setContactFilter(''); setFilterBy('all'); setSourceFilter('all') }} className="text-xs text-theme-tertiary hover:text-theme-primary transition-colors">
              Effacer
            </button>
          )}
        </div>

        {/* Grouped by contact — card grid */}
        {groupedByContact.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-theme-border">
            <div className="h-12 w-12 rounded-full bg-theme-active flex items-center justify-center mx-auto mb-3">
              <Search className="h-6 w-6 text-theme-tertiary" />
            </div>
            <p className="text-sm font-medium text-theme-secondary">Ajoutez des critères de recherche à vos contacts</p>
            <p className="text-xs text-theme-tertiary mt-1 mb-4">Le matching compare automatiquement les critères de vos acheteurs avec les biens disponibles.</p>
            <a href="/dashboard/contacts" className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors inline-flex items-center">
              Voir mes contacts
            </a>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedByContact.map(([contactId, group]) => (
              <div key={contactId}>
                {/* Contact header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-full bg-theme-active flex items-center justify-center text-[10px] font-semibold text-theme-secondary shrink-0">
                    {group.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <h2 className="text-sm font-semibold text-theme-primary">{group.name}</h2>
                  <span className="text-xs text-theme-tertiary">
                    {group.matches.filter((m) => m.status === 'suggested').length} à envoyer
                  </span>
                </div>

                {/* Match cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onPreview={() => setPreviewMatch(match)}
                      onSend={() => setSendDialog(match)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        </>}

        {/* ── External (Marché) Tab ─────────────────────────────── */}
        {activeMainTab === 'external' && (
          <div className="space-y-4">
            {/* Contact selector */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <select
                  value={externalContactId}
                  onChange={(e) => setExternalContactId(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Choisir un acheteur...</option>
                  {buyerContacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
              </div>

              {externalCriteria && (
                <p className="text-xs text-theme-tertiary">
                  {externalCriteria.type === 'APARTMENT' ? 'Appartement' : externalCriteria.type === 'HOUSE' ? 'Maison' : externalCriteria.type} · {externalCriteria.zone} · max {formatCHF(externalCriteria.budget_max)}{externalCriteria.rooms_min ? ` · ${externalCriteria.rooms_min}+ pièces` : ''}
                </p>
              )}
            </div>

            {/* No contact selected */}
            {!externalContactId && (
              <div className="text-center py-12 rounded-xl border border-theme-border">
                <p className="text-sm text-theme-tertiary">Sélectionnez un acheteur pour scanner le marché</p>
                <p className="text-xs text-theme-muted mt-1">Les critères de recherche du client seront utilisés</p>
              </div>
            )}

            {/* Loading */}
            {externalContactId && isLoadingExternal && (
              <div className="flex items-center justify-center h-40">
                <div className="h-5 w-5 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
              </div>
            )}

            {/* Error */}
            {externalContactId && externalError && !isLoadingExternal && (
              <div className="text-center py-12 rounded-xl border border-theme-border">
                <p className="text-sm text-theme-tertiary">Impossible de charger les données du marché</p>
                <button
                  onClick={() => refetchExternal()}
                  className="mt-2 text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            )}

            {/* Empty */}
            {externalContactId && !isLoadingExternal && !externalError && externalListings && externalListings.length === 0 && (
              <div className="text-center py-12 rounded-xl border border-theme-border">
                <p className="text-sm text-theme-tertiary">Aucun bien trouvé sur le marché pour ces critères</p>
                <p className="text-xs text-theme-muted mt-1">Essayez d'élargir la zone ou le budget</p>
              </div>
            )}

            {/* Results grid */}
            {externalListings && externalListings.length > 0 && (
              <>
                <p className="text-xs text-theme-muted">
                  {externalListings.length} bien{externalListings.length > 1 ? 's' : ''} trouvé{externalListings.length > 1 ? 's' : ''} sur le marché · Source : RealAdvisor (14 portails agrégés)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {externalListings.map((listing) => {
                    const selectedContact = buyerContacts.find(c => c.id === externalContactId)
                    return (
                      <ExternalMatchCard
                        key={listing.external_id}
                        listing={listing}
                        onNavigate={(l) => navigate(`/dashboard/marche/${l.external_id}`, {
                          state: { listing: l, contactName: selectedContact?.name },
                        })}
                      />
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {previewMatch && (
          <MatchPreviewModal
            match={previewMatch}
            onClose={() => setPreviewMatch(null)}
            onSend={() => { setPreviewMatch(null); setSendDialog(previewMatch) }}
          />
        )}

        <SendMatchDialog
          open={sendDialog !== null}
          match={sendDialog}
          contactName={sendDialog?.contactName || ''}
          onSend={sendMatch}
          onClose={() => setSendDialog(null)}
        />
      </div>
    </PageTransition>
  )
}
