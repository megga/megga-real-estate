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
  CalendarDays,
  Bath,
  Car,
  Trees,
  Phone,
  User,
  Download,
  Send,
  X,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import type { ExternalListing } from '@/hooks/useExternalMatching'
import { useExternalListingActions } from '@/hooks/useExternalListingActions'
import PageTransition from '@/components/layout/PageTransition'

const TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Appartement', APPT: 'Appartement', HOUSE: 'Maison', VILLA: 'Villa',
  COMMERCIAL: 'Commercial', LAND: 'Terrain', apartment: 'Appartement',
  house: 'Maison', villa: 'Villa', appt: 'Appartement',
}

const PROPERTY_TYPE_DETAIL_LABELS: Record<string, string> = {
  house_detached: 'Maison individuelle', house_semi_detached: 'Maison jumelée',
  house_terrace: 'Maison mitoyenne', house_farm: 'Ferme',
  apartment_normal: 'Appartement', apartment_attic: 'Attique',
  apartment_penthouse: 'Penthouse', apartment_duplex: 'Duplex',
  apartment_studio: 'Studio', apartment_loft: 'Loft',
  apartment_terrasse_flat: 'Rez-jardin',
}

export default function ExternalListingDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const listing = location.state?.listing as ExternalListing | undefined
  const contactName = (location.state?.contactName as string) || null
  const [photoIdx, setPhotoIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showSendConfirm, setShowSendConfirm] = useState(false)

  const {
    notes, sends, imported, importedAt,
    addNote, deleteNote, recordSend, markImported,
    priceComparison,
  } = useExternalListingActions(listing)

  if (!listing) {
    return (
      <PageTransition>
        <div className="max-w-4xl mx-auto py-20 text-center">
          <p className="text-sm text-theme-tertiary">Bien non trouvé</p>
          <Link to="/dashboard/matching" className="mt-3 inline-block text-xs text-accent hover:text-accent/80 transition-colors">
            ← Retour au matching
          </Link>
        </div>
      </PageTransition>
    )
  }

  const photos = listing.photos?.length > 0 ? listing.photos : listing.photo_url ? [listing.photo_url] : []
  const typeLabel = TYPE_LABELS[listing.type] || listing.type
  const detailTypeLabel = listing.property_type_detail ? PROPERTY_TYPE_DETAIL_LABELS[listing.property_type_detail] || null : null
  const locationStr = [listing.address, listing.postcode, listing.city].filter(Boolean).join(', ')
  const pricePerM2 = listing.price_per_m2 || (listing.price > 0 && listing.surface_m2 ? Math.round(listing.price / listing.surface_m2) : null)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(listing.source_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAddNote = () => {
    if (!noteText.trim()) return
    addNote(noteText)
    setNoteText('')
  }

  const handleSend = (channel: 'email' | 'internal') => {
    recordSend(contactName || 'Client', channel)
    setShowSendConfirm(false)
  }

  const statsRaw = [
    listing.rooms != null ? { label: 'Pièces', value: `${listing.rooms}`, icon: <DoorOpen className="w-4 h-4" /> } : null,
    listing.surface_m2 != null ? { label: 'Surface hab.', value: `${listing.surface_m2} m²`, icon: <Ruler className="w-4 h-4" /> } : null,
    listing.bathrooms != null ? { label: 'SdB', value: `${listing.bathrooms}`, icon: <Bath className="w-4 h-4" /> } : null,
    listing.land_surface != null ? { label: 'Terrain', value: `${listing.land_surface} m²`, icon: <Trees className="w-4 h-4" /> } : null,
    listing.parking != null ? { label: 'Parking', value: `${listing.parking}`, icon: <Car className="w-4 h-4" /> } : null,
    typeLabel ? { label: 'Type', value: detailTypeLabel || typeLabel, icon: <Building2 className="w-4 h-4" /> } : null,
    listing.construction_year ? { label: 'Construction', value: `${listing.construction_year}`, icon: <CalendarDays className="w-4 h-4" /> } : null,
    listing.renovation_year ? { label: 'Rénovation', value: `${listing.renovation_year}`, icon: <CalendarDays className="w-4 h-4" /> } : null,
  ]
  const stats = statsRaw.filter(Boolean) as { label: string; value: string; icon: React.ReactNode }[]

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Back + imported badge */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          {imported && (
            <span className="text-xs text-emerald-500 font-medium">
              Importé {importedAt ? formatRelativeDate(importedAt) : ''}
            </span>
          )}
        </div>

        {/* Photo carousel */}
        {photos.length > 0 ? (
          <div className="relative rounded-xl overflow-hidden border border-theme-border">
            <div className="aspect-[16/9] bg-black">
              <img src={photos[photoIdx]} alt={listing.title || 'Bien immobilier'} className="w-full h-full object-cover" />
            </div>
            {photos.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors">
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
                <button onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors">
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {photos.slice(0, 12).map((_, i) => (
                    <button key={i} onClick={() => setPhotoIdx(i)} className={cn('w-1.5 h-1.5 rounded-full transition-colors', i === photoIdx ? 'bg-white' : 'bg-white/40')} />
                  ))}
                  {photos.length > 12 && <span className="text-[9px] text-white/60 ml-1">+{photos.length - 12}</span>}
                </div>
              </>
            )}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
              {listing.source_logo_url && <img src={listing.source_logo_url} alt="" className="h-4 w-4 rounded-sm" />}
              <span className="text-xs text-white/90 font-medium">{listing.source_portal}</span>
            </div>
            <span className="absolute bottom-3 right-3 text-[11px] text-white/70 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md">{photoIdx + 1}/{photos.length}</span>
          </div>
        ) : (
          <div className="aspect-[16/7] rounded-xl border border-theme-border bg-theme-section flex items-center justify-center">
            <span className="text-sm text-theme-tertiary">Pas de photo disponible</span>
          </div>
        )}

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {photos.map((url, i) => (
              <button key={i} onClick={() => setPhotoIdx(i)} className={cn('shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-colors', i === photoIdx ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100')}>
                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header */}
            <div className="rounded-xl border border-theme-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-2xl font-semibold text-theme-primary">
                    {listing.price > 0 ? formatCHF(listing.price) : 'Prix sur demande'}
                  </p>
                  {listing.title && <p className="text-sm text-theme-secondary mt-1 line-clamp-2">{listing.title}</p>}
                  <p className="text-xs text-theme-tertiary mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {locationStr || 'Adresse non disponible'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-theme-border-subtle">
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

            {/* Description */}
            {listing.description && (
              <div className="rounded-xl border border-theme-border p-5">
                <h3 className="text-xs text-theme-tertiary uppercase tracking-wider mb-3">Description</h3>
                <div className="text-sm text-theme-secondary leading-relaxed prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: listing.description }} />
              </div>
            )}

            {/* ── NIVEAU 3 : Comparaison prix/m² ────────────────────────── */}
            {priceComparison && (
              <div className="rounded-xl border border-theme-border p-5">
                <h3 className="text-xs text-theme-tertiary uppercase tracking-wider mb-4">
                  Comparaison avec le portefeuille
                </h3>

                {/* Headline metric */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'flex items-center gap-1 text-sm font-semibold',
                    priceComparison.diff_pct > 10 ? 'text-red-500' :
                    priceComparison.diff_pct < -10 ? 'text-emerald-500' :
                    'text-theme-primary'
                  )}>
                    {priceComparison.diff_pct > 5 ? <TrendingUp className="w-4 h-4" /> :
                     priceComparison.diff_pct < -5 ? <TrendingDown className="w-4 h-4" /> :
                     <Minus className="w-4 h-4" />}
                    {priceComparison.diff_pct > 0 ? '+' : ''}{priceComparison.diff_pct}%
                  </div>
                  <p className="text-xs text-theme-secondary">
                    {priceComparison.diff_pct > 10 ? 'au-dessus du marché interne' :
                     priceComparison.diff_pct < -10 ? 'en-dessous du marché interne' :
                     'aligné avec le marché interne'}
                  </p>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-6 py-3 border-y border-theme-border-subtle">
                  <div>
                    <p className="text-xs text-theme-tertiary">Ce bien</p>
                    <p className="text-sm font-semibold text-theme-primary">{formatCHF(priceComparison.external_price_per_m2)}/m²</p>
                  </div>
                  <div className="h-8 w-px bg-theme-border" />
                  <div>
                    <p className="text-xs text-theme-tertiary">Moy. portefeuille</p>
                    <p className="text-sm font-medium text-theme-primary">{formatCHF(priceComparison.internal_avg_price_per_m2)}/m²</p>
                  </div>
                  <div className="h-8 w-px bg-theme-border" />
                  <div>
                    <p className="text-xs text-theme-tertiary">Fourchette</p>
                    <p className="text-sm font-medium text-theme-primary">
                      {formatCHF(priceComparison.internal_min_price_per_m2)} – {formatCHF(priceComparison.internal_max_price_per_m2)}/m²
                    </p>
                  </div>
                </div>

                {/* Comparable listings */}
                {priceComparison.comparable_listings.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] text-theme-muted mb-2">{priceComparison.internal_count} bien{priceComparison.internal_count > 1 ? 's' : ''} comparé{priceComparison.internal_count > 1 ? 's' : ''}</p>
                    {priceComparison.comparable_listings.map((comp, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-theme-border-subtle last:border-0">
                        <div className="min-w-0">
                          <p className="text-xs text-theme-secondary truncate">{comp.title}</p>
                          <p className="text-[10px] text-theme-muted">{comp.city} · {comp.surface_m2} m²</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-xs font-medium text-theme-primary">{formatCHF(comp.price_per_m2)}/m²</p>
                          <p className="text-[10px] text-theme-muted">{formatCHF(comp.price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Price analysis (simple — without comparison) */}
            {pricePerM2 && listing.price > 0 && !priceComparison && (
              <div className="rounded-xl border border-theme-border p-5">
                <h3 className="text-xs text-theme-tertiary uppercase tracking-wider mb-3">Analyse prix</h3>
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-lg font-semibold text-theme-primary">{formatCHF(pricePerM2)}</p>
                    <p className="text-[10px] text-theme-muted">par m²</p>
                  </div>
                  {listing.surface_m2 && (
                    <><div className="h-8 w-px bg-theme-border" /><div>
                      <p className="text-sm font-medium text-theme-primary">{listing.surface_m2} m²</p>
                      <p className="text-[10px] text-theme-muted">surface habitable</p>
                    </div></>
                  )}
                  <div className="h-8 w-px bg-theme-border" />
                  <div>
                    <p className="text-sm font-medium text-theme-primary">{formatCHF(listing.price)}</p>
                    <p className="text-[10px] text-theme-muted">prix affiché</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── NIVEAU 3 : Notes agent ─────────────────────────────────── */}
            <div className="rounded-xl border border-theme-border p-5">
              <h3 className="text-xs text-theme-tertiary uppercase tracking-wider mb-3">Notes agent</h3>

              {/* Note input */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  placeholder="Ajouter une note..."
                  className="flex-1 h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors text-theme-primary placeholder:text-theme-muted"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteText.trim()}
                  className="h-9 px-3 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  Ajouter
                </button>
              </div>

              {/* Notes list */}
              {notes.length === 0 ? (
                <p className="text-xs text-theme-muted">Aucune note pour ce bien</p>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div key={note.id} className="flex items-start gap-2 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-theme-secondary">{note.text}</p>
                        <p className="text-[10px] text-theme-muted mt-0.5">{formatRelativeDate(note.created_at)}</p>
                      </div>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-theme-muted hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Source info */}
            <div className="rounded-xl border border-theme-border p-5">
              <h3 className="text-xs text-theme-tertiary uppercase tracking-wider mb-3">Source</h3>
              <div className="space-y-2.5">
                {listing.source_agency && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-theme-secondary">Agence</span>
                    <span className="text-xs font-medium text-theme-primary">{listing.source_agency}</span>
                  </div>
                )}
                {listing.agency_phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-theme-secondary flex items-center gap-1"><Phone className="w-3 h-3" /> Téléphone</span>
                    <span className="text-xs font-medium text-theme-primary">{listing.agency_phone}</span>
                  </div>
                )}
                {listing.visit_contact && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-theme-secondary flex items-center gap-1"><User className="w-3 h-3" /> Contact visite</span>
                    <span className="text-xs font-medium text-theme-primary">{listing.visit_contact}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-theme-secondary">Portail</span>
                  <div className="flex items-center gap-1.5">
                    {listing.source_logo_url && <img src={listing.source_logo_url} alt="" className="h-3 w-3 rounded-sm" />}
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

          {/* Right column — actions + CRM */}
          <div className="space-y-4">
            {/* Match context */}
            {contactName && (
              <div className="rounded-xl border border-theme-border p-4">
                <p className="text-[10px] text-theme-tertiary uppercase tracking-wider mb-1.5">Match pour</p>
                <p className="text-sm font-medium text-theme-primary">{contactName}</p>
              </div>
            )}

            {/* Actions */}
            <div className="rounded-xl border border-theme-border p-4 space-y-2.5">
              <p className="text-[10px] text-theme-tertiary uppercase tracking-wider mb-1">Actions</p>

              {/* Send to client */}
              <button
                onClick={() => setShowSendConfirm(true)}
                className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Envoyer au client
              </button>

              {/* Send confirmation */}
              {showSendConfirm && (
                <div className="rounded-lg border border-theme-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-theme-secondary">Envoyer via :</p>
                    <button onClick={() => setShowSendConfirm(false)}><X className="w-3.5 h-3.5 text-theme-muted" /></button>
                  </div>
                  <button
                    onClick={() => handleSend('email')}
                    className="w-full h-8 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
                  >
                    Email
                  </button>
                  <button
                    onClick={() => handleSend('internal')}
                    className="w-full h-8 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
                  >
                    Messagerie interne
                  </button>
                </div>
              )}

              {/* Import to portfolio */}
              {!imported ? (
                <button
                  onClick={markImported}
                  className="w-full h-9 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Importer dans mon portefeuille
                </button>
              ) : (
                <div className="w-full h-9 rounded-lg text-sm font-medium border border-emerald-500/30 text-emerald-500 flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Importé
                </div>
              )}

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
                {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copié</> : <><Copy className="w-3.5 h-3.5" /> Copier le lien</>}
              </button>
            </div>

            {/* ── NIVEAU 3 : Historique d'envoi ─────────────────────────── */}
            {sends.length > 0 && (
              <div className="rounded-xl border border-theme-border p-4">
                <p className="text-[10px] text-theme-tertiary uppercase tracking-wider mb-2">Historique d'envoi</p>
                <div className="space-y-2">
                  {sends.map((send) => (
                    <div key={send.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-theme-secondary">{send.contact_name}</p>
                        <p className="text-[10px] text-theme-muted">{send.channel === 'email' ? 'Email' : 'Messagerie'}</p>
                      </div>
                      <p className="text-[10px] text-theme-muted">{formatRelativeDate(send.sent_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location */}
            {listing.city && (
              <div className="rounded-xl border border-theme-border p-4">
                <p className="text-[10px] text-theme-tertiary uppercase tracking-wider mb-2">Localisation</p>
                <p className="text-sm font-medium text-theme-primary">{listing.city}</p>
                {listing.canton && <p className="text-xs text-theme-tertiary mt-0.5">Canton : {listing.canton}</p>}
                {listing.postcode && <p className="text-xs text-theme-tertiary">NPA : {listing.postcode}</p>}
                {listing.lat && listing.lng && (
                  <p className="text-[10px] text-theme-muted mt-2">{listing.lat.toFixed(4)}°N, {listing.lng.toFixed(4)}°E</p>
                )}
              </div>
            )}

            {/* Disclaimer */}
            <div className="rounded-xl border border-dashed border-theme-border-subtle p-4 text-center">
              <p className="text-[10px] text-theme-muted leading-relaxed">
                Ce bien provient d'un portail externe. Les informations sont fournies par l'agence source et peuvent évoluer sans préavis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
