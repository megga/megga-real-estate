import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronDown, X, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { useMatches, useRunMatching, useUpdateMatchStatus } from '@/hooks/useMatching'
import { useExternalMatching, type ExternalListing, type ExternalSearchCriteria } from '@/hooks/useExternalMatching'
import SendMatchDialog from '@/components/matching/SendMatchDialog'
import type { MatchWithRelations } from '@/types/matching'
import PageTransition from '@/components/layout/PageTransition'
import { PROPERTY_TYPE_LABELS, type PropertyType } from '@/lib/constants'
import { MOCK_CONTACTS } from '@/lib/mockData'

// ── Match Preview Modal ─────────────────────────────────────────────────────

function MatchPreviewModal({ match, onClose, onSend }: {
  match: MatchWithRelations
  onClose: () => void
  onSend: () => void
}) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const property = match.property
  if (!property) return null

  const photos = property.photos || []
  const isSent = match.status === 'sent'
  const reasons = match.reasons

  const criteria = reasons ? [
    { label: 'Budget', score: reasons.budget_score, max: 30, ok: reasons.budget },
    { label: 'Zone', score: reasons.zone_score, max: 25, ok: reasons.zone },
    { label: 'Type', score: reasons.type_score, max: 15, ok: reasons.type },
    { label: 'Surface', score: reasons.rooms_surface_score, max: 15, ok: reasons.rooms_surface },
    { label: 'Extras', score: reasons.features_score, max: 15, ok: reasons.features },
  ] : []

  const contactName = match.contact
    ? `${match.contact.first_name} ${match.contact.last_name}`
    : 'Contact inconnu'

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
              alt={property.title}
              className="w-full h-full object-cover"
            />
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
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <span className="absolute bottom-3 right-3 text-[11px] text-white/70 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md">
              {photoIdx + 1}/{photos.length}
            </span>
          </div>
        )}

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs text-theme-tertiary mb-1">
                {PROPERTY_TYPE_LABELS[property.type as PropertyType] || property.type} · {property.city} ({property.canton})
              </p>
              <h2 className="text-lg font-semibold text-theme-primary">{property.title}</h2>
              <p className="text-xs text-theme-tertiary mt-0.5">{property.address}, {property.postal_code} {property.city}</p>
            </div>
            <p className="text-lg font-semibold text-theme-primary shrink-0">{formatCHF(property.price)}</p>
          </div>

          {/* Key stats */}
          <div className="flex gap-6 py-3 border-y border-theme-border-subtle mb-4">
            <div>
              <p className="text-xs text-theme-tertiary">Pièces</p>
              <p className="text-sm font-medium text-theme-primary">{property.rooms}</p>
            </div>
            {property.bedrooms != null && (
              <div>
                <p className="text-xs text-theme-tertiary">Chambres</p>
                <p className="text-sm font-medium text-theme-primary">{property.bedrooms}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-theme-tertiary">Surface</p>
              <p className="text-sm font-medium text-theme-primary">{property.surface_m2} m²</p>
            </div>
            {property.floor != null && (
              <div>
                <p className="text-xs text-theme-tertiary">Étage</p>
                <p className="text-sm font-medium text-theme-primary">{property.floor}</p>
              </div>
            )}
            {property.year_built != null && (
              <div>
                <p className="text-xs text-theme-tertiary">Année</p>
                <p className="text-sm font-medium text-theme-primary">{property.year_built}</p>
              </div>
            )}
            {property.charges_monthly != null && property.charges_monthly > 0 && (
              <div>
                <p className="text-xs text-theme-tertiary">Charges</p>
                <p className="text-sm font-medium text-theme-primary">{formatCHF(property.charges_monthly)}/mois</p>
              </div>
            )}
          </div>

          {/* Description */}
          {property.description && (
            <div className="mb-4">
              <p className="text-sm text-theme-secondary leading-relaxed whitespace-pre-line line-clamp-4">
                {property.description}
              </p>
            </div>
          )}

          {/* Score breakdown */}
          {criteria.length > 0 && (
            <div className="rounded-lg border border-theme-border p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-theme-primary">Score de compatibilité · estimation</p>
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
          )}

          <p className="text-xs text-theme-tertiary mb-4">
            Match pour <span className="font-medium text-theme-primary">{contactName}</span>
          </p>

          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="text-sm text-theme-secondary hover:text-theme-primary transition-colors">
              Fermer
            </button>
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
  match: MatchWithRelations
  onSend: () => void
  onPreview: () => void
}) {
  const isSent = match.status === 'sent'
  const property = match.property
  if (!property) return null

  const reasons = match.reasons
  const matchedReasons = reasons ? [
    reasons.budget && 'Budget',
    reasons.zone && 'Zone',
    reasons.type && 'Type',
    reasons.rooms_surface && 'Surface',
    reasons.features && 'Extras',
  ].filter(Boolean) : []

  return (
    <div
      onClick={onPreview}
      className={cn(
        'rounded-xl border overflow-hidden transition-all group cursor-pointer',
        isSent ? 'border-theme-border-subtle opacity-60' : 'border-theme-border hover:border-theme-active',
      )}
    >
      {property.photos?.[0] && (
        <div className="relative aspect-[16/10]">
          <img src={property.photos[0]} alt={property.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-3.5">
        <p className="text-sm font-medium text-theme-primary truncate">{property.title}</p>
        <p className="text-xs text-theme-tertiary truncate mt-0.5">{property.address}, {property.city}</p>

        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-semibold text-theme-primary">{formatCHF(property.price)}</span>
          <span className="text-xs text-theme-tertiary">{property.rooms} p. · {property.surface_m2} m²</span>
        </div>

        <div className="mt-3">
          <div className="h-1 bg-theme-border rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-theme-primary transition-all" style={{ width: `${match.score}%` }} />
          </div>
        </div>

        {matchedReasons.length > 0 && (
          <p className="text-[10px] text-theme-secondary mt-1.5">
            {matchedReasons.join(' · ')}
          </p>
        )}

        <div className="flex items-center justify-end mt-3">
          {isSent ? (
            <div className="text-right">
              <p className="text-[11px] text-theme-muted">Envoyé par {match.sent_via}</p>
              {match.sent_at && (
                <p className="text-[10px] text-theme-muted">{formatRelativeDate(match.sent_at)}</p>
              )}
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onSend() }}
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
  const { data: allMatchesRaw, isLoading, isError } = useMatches()
  const runMatching = useRunMatching()
  const updateStatus = useUpdateMatchStatus()

  const [search, setSearch] = useState('')
  const [filterBy, setFilterBy] = useState<'all' | 'suggested' | 'sent'>('all')
  const [sortBy, setSortBy] = useState<SortBy>('score')
  const [contactFilter, setContactFilter] = useState('')
  const [sendDialog, setSendDialog] = useState<MatchWithRelations | null>(null)
  const [previewMatch, setPreviewMatch] = useState<MatchWithRelations | null>(null)
  const [activeMainTab, setActiveMainTab] = useState<'internal' | 'external'>('internal')
  const [externalContactId, setExternalContactId] = useState('')

  // Suppress unused var lint — updateStatus is used for future context menu actions
  void updateStatus

  const allMatchesData = useMemo(() => allMatchesRaw || [], [allMatchesRaw])

  const suggested = useMemo(() => allMatchesData.filter((m) => m.status === 'suggested'), [allMatchesData])
  const sent = useMemo(() => allMatchesData.filter((m) => m.status === 'sent'), [allMatchesData])

  // Derive external search criteria from selected contact
  const externalCriteria: ExternalSearchCriteria | null = useMemo(() => {
    if (!externalContactId) return null
    const contact = MOCK_CONTACTS.find(c => c.id === externalContactId)
    if (!contact?.search_criteria) return null
    const sc = contact.search_criteria
    const typeMap: Record<string, string> = {
      'Appartement': 'APARTMENT',
      'Maison': 'HOUSE',
      'Villa': 'VILLA',
    }
    const zone = sc.location.split(',')[0].trim() || 'geneve'
    return {
      zone,
      type: typeMap[sc.property_type] || 'APARTMENT',
      budget_max: sc.budget_max,
      budget_min: sc.budget_min,
      rooms_min: sc.rooms_min,
    }
  }, [externalContactId])

  const {
    data: externalListings,
    isLoading: isLoadingExternal,
    error: externalError,
    refetch: refetchExternal,
  } = useExternalMatching(externalCriteria)

  // Buyers for external tab selector
  const buyerContacts = useMemo(() =>
    MOCK_CONTACTS
      .filter(c => (c.type === 'buyer' || c.type === 'both') && c.search_criteria)
      .map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}` })),
    []
  )

  const allContacts = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of allMatchesData) {
      if (m.contact && !map.has(m.contact_id)) {
        map.set(m.contact_id, `${m.contact.first_name} ${m.contact.last_name}`)
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [allMatchesData])

  const filteredMatches = useMemo(() => {
    let list = filterBy === 'suggested' ? suggested : filterBy === 'sent' ? sent : allMatchesData
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((m) => {
        const contactName = m.contact ? `${m.contact.first_name} ${m.contact.last_name}`.toLowerCase() : ''
        const title = m.property?.title?.toLowerCase() || ''
        const city = m.property?.city?.toLowerCase() || ''
        return contactName.includes(q) || title.includes(q) || city.includes(q)
      })
    }
    if (contactFilter) {
      list = list.filter((m) => m.contact_id === contactFilter)
    }
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'score': return b.score - a.score
        case 'price_asc': return (a.property?.price || 0) - (b.property?.price || 0)
        case 'price_desc': return (b.property?.price || 0) - (a.property?.price || 0)
        case 'date': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        default: return 0
      }
    })
    return list
  }, [allMatchesData, suggested, sent, search, filterBy, sortBy, contactFilter])

  const groupedByContact = useMemo(() => {
    const groups = new Map<string, { name: string; matches: MatchWithRelations[] }>()
    for (const m of filteredMatches) {
      const name = m.contact ? `${m.contact.first_name} ${m.contact.last_name}` : 'Contact inconnu'
      const existing = groups.get(m.contact_id)
      if (existing) {
        existing.matches.push(m)
      } else {
        groups.set(m.contact_id, { name, matches: [m] })
      }
    }
    return Array.from(groups.entries())
  }, [filteredMatches])

  function handleRunMatching() {
    runMatching.mutate({ trigger: 'daily' })
  }

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
            onClick={handleRunMatching}
            disabled={runMatching.isPending}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {runMatching.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Lancer le matching
          </button>
        </div>

        {/* Result notification */}
        {runMatching.isSuccess && runMatching.data && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-sm text-emerald-600">
              {runMatching.data.matches_created} nouveau{runMatching.data.matches_created > 1 ? 'x' : ''} match{runMatching.data.matches_created > 1 ? 's' : ''} trouvé{runMatching.data.matches_created > 1 ? 's' : ''}
            </p>
          </div>
        )}

        {runMatching.isError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-sm text-red-600">Erreur lors du matching. Vérifiez que des biens actifs et des recherches clients existent.</p>
          </div>
        )}

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
            <p className="text-lg font-semibold text-theme-primary">{allMatchesData.length}</p>
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
            <p className="text-lg font-semibold text-theme-primary">{allContacts.length}</p>
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

          <div className="relative">
            <select value={contactFilter} onChange={(e) => setContactFilter(e.target.value)} className={selectClasses}>
              <option value="">Contact</option>
              {allContacts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          <div className="relative">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className={selectClasses}>
              {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          {(search || contactFilter || filterBy !== 'all') && (
            <button onClick={() => { setSearch(''); setContactFilter(''); setFilterBy('all') }} className="text-xs text-theme-tertiary hover:text-theme-primary transition-colors">
              Effacer
            </button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-12 rounded-xl border border-theme-border">
            <Loader2 className="h-6 w-6 animate-spin text-theme-tertiary mx-auto mb-2" />
            <p className="text-sm text-theme-tertiary">Chargement des matchs...</p>
          </div>
        ) : isError ? (
          <div className="text-center py-12 rounded-xl border border-theme-border">
            <p className="text-sm text-red-500">Erreur lors du chargement des matchs</p>
          </div>
        ) : groupedByContact.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-theme-border">
            <p className="text-sm text-theme-tertiary">Aucun match trouvé</p>
            <p className="text-xs text-theme-muted mt-1">Lancez le matching ou ajoutez des biens et des recherches clients.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedByContact.map(([contactId, group]) => (
              <div key={contactId}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-full bg-theme-active flex items-center justify-center text-[10px] font-semibold text-theme-secondary shrink-0">
                    {group.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <h2 className="text-sm font-semibold text-theme-primary">{group.name}</h2>
                  <span className="text-xs text-theme-tertiary">
                    {group.matches.filter((m) => m.status === 'suggested').length} à envoyer
                  </span>
                </div>

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

        {sendDialog && (
          <SendMatchDialog
            open={true}
            match={sendDialog}
            onClose={() => setSendDialog(null)}
          />
        )}
      </div>
    </PageTransition>
  )
}
