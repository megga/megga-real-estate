import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Ruler,
  DoorOpen,
  Building2,
  Copy,
  Check,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import type { ExternalListing } from '@/hooks/useExternalMatching'
import PageTransition from '@/components/layout/PageTransition'

const TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Appartement',
  APPT: 'Appartement',
  HOUSE: 'Maison',
  VILLA: 'Villa',
  COMMERCIAL: 'Commercial',
  LAND: 'Terrain',
  apartment: 'Appartement',
  house: 'Maison',
  villa: 'Villa',
  appt: 'Appartement',
}

export default function ExternalListingDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const listing = location.state?.listing as ExternalListing | undefined
  const contactName = (location.state?.contactName as string) || null
  const [photoIdx, setPhotoIdx] = useState(0)
  const [copied, setCopied] = useState(false)

  // If no listing in state (direct URL access), redirect back
  if (!listing) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto py-20 text-center">
          <p className="text-sm text-theme-tertiary">Bien non trouvé</p>
          <Link
            to="/dashboard/matching"
            className="mt-3 inline-block text-xs text-accent hover:text-accent/80 transition-colors"
          >
            ← Retour au matching
          </Link>
        </div>
      </PageTransition>
    )
  }

  // Build photo array — external listings may have one or no photos
  const photos = listing.photo_url ? [listing.photo_url] : []
  const typeLabel = TYPE_LABELS[listing.type] || listing.type
  const locationStr = [listing.address, listing.city, listing.canton].filter(Boolean).join(', ')

  const handleCopyLink = () => {
    navigator.clipboard.writeText(listing.source_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Stats to display
  const statsRaw = [
    listing.rooms != null
      ? { label: 'Pièces', value: `${listing.rooms}`, icon: <DoorOpen className="w-4 h-4" /> }
      : null,
    listing.surface_m2 != null
      ? { label: 'Surface', value: `${listing.surface_m2} m²`, icon: <Ruler className="w-4 h-4" /> }
      : null,
    typeLabel
      ? { label: 'Type', value: typeLabel, icon: <Building2 className="w-4 h-4" /> }
      : null,
    listing.city
      ? { label: 'Localisation', value: `${listing.city}${listing.canton ? ` (${listing.canton})` : ''}`, icon: <MapPin className="w-4 h-4" /> }
      : null,
  ]
  const stats = statsRaw.filter(Boolean) as { label: string; value: string; icon: React.ReactNode }[]

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        {/* Photo section */}
        {photos.length > 0 ? (
          <div className="relative rounded-xl overflow-hidden border border-theme-border">
            <div className="aspect-[16/9] bg-black">
              <img
                src={photos[photoIdx]}
                alt={listing.title || 'Bien immobilier'}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Photo navigation */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
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

            {/* Source badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
              {listing.source_logo_url && (
                <img src={listing.source_logo_url} alt="" className="h-4 w-4 rounded-sm" />
              )}
              <span className="text-xs text-white/90 font-medium">
                {listing.source_portal}
              </span>
            </div>

            {/* Photo count */}
            <span className="absolute bottom-3 right-3 text-[11px] text-white/70 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md">
              {photoIdx + 1}/{photos.length}
            </span>
          </div>
        ) : (
          <div className="aspect-[16/7] rounded-xl border border-theme-border bg-theme-section flex items-center justify-center">
            <span className="text-sm text-theme-tertiary">Pas de photo disponible</span>
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column — main info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header: Price + Title */}
            <div className="rounded-xl border border-theme-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-2xl font-semibold text-theme-primary">
                    {listing.price > 0 ? formatCHF(listing.price) : 'Prix sur demande'}
                  </p>
                  {listing.title && (
                    <p className="text-sm text-theme-secondary mt-1 line-clamp-2">{listing.title}</p>
                  )}
                  <p className="text-xs text-theme-tertiary mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {locationStr || 'Adresse non disponible'}
                  </p>
                </div>
              </div>

              {/* Key stats */}
              <div className="flex flex-wrap gap-6 mt-5 pt-4 border-t border-theme-border-subtle">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-2">
                    <span className="text-theme-tertiary">{stat.icon}</span>
                    <div>
                      <p className="text-[10px] text-theme-tertiary uppercase tracking-wider">{stat.label}</p>
                      <p className="text-sm font-medium text-theme-primary">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price per m² calculation */}
            {listing.price > 0 && listing.surface_m2 && listing.surface_m2 > 0 && (
              <div className="rounded-xl border border-theme-border p-5">
                <h3 className="text-xs text-theme-tertiary uppercase tracking-wider mb-3">Analyse prix</h3>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-lg font-semibold text-theme-primary">
                      {formatCHF(Math.round(listing.price / listing.surface_m2))}
                    </p>
                    <p className="text-[10px] text-theme-muted">par m²</p>
                  </div>
                  <div className="h-8 w-px bg-theme-border" />
                  <div>
                    <p className="text-sm font-medium text-theme-primary">{listing.surface_m2} m²</p>
                    <p className="text-[10px] text-theme-muted">surface habitable</p>
                  </div>
                  <div className="h-8 w-px bg-theme-border" />
                  <div>
                    <p className="text-sm font-medium text-theme-primary">{formatCHF(listing.price)}</p>
                    <p className="text-[10px] text-theme-muted">prix affiché</p>
                  </div>
                </div>
              </div>
            )}

            {/* Source info */}
            <div className="rounded-xl border border-theme-border p-5">
              <h3 className="text-xs text-theme-tertiary uppercase tracking-wider mb-3">Source</h3>
              <div className="space-y-2">
                {listing.source_agency && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-theme-secondary">Agence</span>
                    <span className="text-xs font-medium text-theme-primary">{listing.source_agency}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-theme-secondary">Portail</span>
                  <div className="flex items-center gap-1.5">
                    {listing.source_logo_url && (
                      <img src={listing.source_logo_url} alt="" className="h-3 w-3 rounded-sm" />
                    )}
                    <span className="text-xs font-medium text-theme-primary">{listing.source_portal}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-theme-secondary">Agrégateur</span>
                  <span className="text-xs font-medium text-theme-primary">RealAdvisor (14 portails)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right column — actions */}
          <div className="space-y-4">
            {/* Context: matched for contact */}
            {contactName && (
              <div className="rounded-xl border border-theme-border p-4">
                <p className="text-[10px] text-theme-tertiary uppercase tracking-wider mb-1.5">Match pour</p>
                <p className="text-sm font-medium text-theme-primary">{contactName}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="rounded-xl border border-theme-border p-4 space-y-2.5">
              <p className="text-[10px] text-theme-tertiary uppercase tracking-wider mb-1">Actions</p>

              {/* Send to client */}
              <button
                className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
              >
                Envoyer au client
              </button>

              {/* View original */}
              <a
                href={listing.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-1.5"
              >
                Voir l'annonce originale
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* Copy link */}
              <button
                onClick={handleCopyLink}
                className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copier le lien
                  </>
                )}
              </button>
            </div>

            {/* External badge */}
            <div className="rounded-xl border border-dashed border-theme-border-subtle p-4 text-center">
              <p className="text-[10px] text-theme-muted leading-relaxed">
                Ce bien provient d'un portail externe.
                Les informations sont fournies par l'agence source
                et peuvent évoluer sans préavis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
