import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  MapPin, DoorOpen, BedDouble, Bath, Maximize, Building2, Heart, Share2,
  Phone, Mail, CalendarDays, ChevronLeft, ChevronRight, X, Images,
  FileText, Grid3X3, Expand,
} from 'lucide-react'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/layout/Navbar'
import { getListingById } from '@/lib/mockData'

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'hot' | 'new' | 'exclusive' | 'default' }) {
  const styles = {
    hot: 'bg-danger/20 text-danger backdrop-blur-sm',
    new: 'bg-accent/20 text-accent backdrop-blur-sm',
    exclusive: 'bg-success/20 text-success backdrop-blur-sm',
    default: 'bg-card/80 text-primary-700 backdrop-blur-sm',
  }
  return (
    <span className={cn('text-sm font-medium px-3 py-1 rounded-full inline-flex items-center gap-1', styles[variant])}>
      {children}
    </span>
  )
}

function SectionTitle({ icon: Icon, children }: { icon: typeof FileText; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border-default)] pb-3 mb-6">
      <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
      <h2 className="text-xl font-semibold text-[var(--text-primary)]">{children}</h2>
    </div>
  )
}

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const listing = getListingById(id || '')
  const [isFavorite, setIsFavorite] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0)
  const [hoverMainPhoto, setHoverMainPhoto] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Close lightbox on Escape, navigate with arrow keys
  const handleLightboxKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setLightboxOpen(false)
    if (e.key === 'ArrowLeft' && lightboxIndex > 0) setLightboxIndex((i) => i - 1)
    if (e.key === 'ArrowRight' && listing && lightboxIndex < listing.photos.length - 1) setLightboxIndex((i) => i + 1)
  }, [lightboxIndex, listing])

  useEffect(() => {
    if (lightboxOpen) {
      document.addEventListener('keydown', handleLightboxKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleLightboxKeyDown)
      document.body.style.overflow = ''
    }
  }, [lightboxOpen, handleLightboxKeyDown])

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main id="main-content" className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-xl font-semibold text-primary-900 mb-2">Bien non trouvé</p>
          <p className="text-sm text-muted-foreground mb-6">Ce bien n'existe pas ou a été retiré.</p>
          <Link to="/search">
            <Button>Retour à la recherche</Button>
          </Link>
        </main>
      </div>
    )
  }

  const photos = listing.photos

  function openLightbox(index: number) {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  function scrollCarousel(dir: 'left' | 'right') {
    if (!carouselRef.current) return
    const w = carouselRef.current.offsetWidth
    carouselRef.current.scrollBy({ left: dir === 'right' ? w : -w, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main id="main-content">
        {/* === PHOTO GALLERY — Desktop: Airbnb grid === */}
        <section className="hidden md:block max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-6" aria-label="Galerie photos">
          <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] rounded-card overflow-hidden relative">
            {/* Main photo */}
            <button
              className="col-span-2 row-span-2 relative overflow-hidden group"
              onClick={() => openLightbox(0)}
              onMouseEnter={() => setHoverMainPhoto(true)}
              onMouseLeave={() => setHoverMainPhoto(false)}
              aria-label={`Photo principale de ${listing.title} — Ouvrir la galerie`}
            >
              <img src={photos[0]} alt={listing.title} className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-200" />
              {hoverMainPhoto && (
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center transition-opacity">
                  <Expand className="h-8 w-8 text-white" aria-hidden="true" />
                </div>
              )}
            </button>
            {/* Secondary photos */}
            {photos.slice(1, 5).map((photo, i) => (
              <button
                key={i}
                className="relative overflow-hidden group"
                onClick={() => openLightbox(i + 1)}
                aria-label={`Photo ${i + 2} sur ${photos.length} — Ouvrir la galerie`}
              >
                <img src={photo} alt={`${listing.title} — Photo ${i + 2}`} className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-200 cursor-pointer" />
                {i === 3 && photos.length > 5 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white text-sm font-medium flex items-center gap-1.5">
                      <Images className="h-4 w-4" aria-hidden="true" />
                      +{photos.length - 5} photos
                    </span>
                  </div>
                )}
              </button>
            ))}

            {/* Overlay badges — bottom left */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 z-10">
              <Badge variant="new">Vente</Badge>
              {listing.is_hot && <Badge variant="hot"><span aria-hidden="true">🔥</span> Hot price</Badge>}
              {listing.is_exclusive && <Badge variant="exclusive">Exclusif</Badge>}
            </div>

            <button
              onClick={() => openLightbox(0)}
              className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white text-sm font-medium px-4 py-2 rounded-button shadow-card transition-colors flex items-center gap-2"
            >
              <Images className="h-4 w-4" aria-hidden="true" />
              Voir les {photos.length} photos
            </button>
          </div>
        </section>

        {/* === PHOTO GALLERY — Mobile: Horizontal carousel === */}
        <section className="md:hidden relative" aria-label="Galerie photos">
          <div
            ref={carouselRef}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
            role="region"
            aria-label="Carrousel de photos"
            onScroll={(e) => {
              const el = e.currentTarget
              const idx = Math.round(el.scrollLeft / el.offsetWidth)
              setMobilePhotoIndex(idx)
            }}
          >
            {photos.map((photo, i) => (
              <div key={i} className="w-full flex-shrink-0 snap-center">
                <img
                  src={photo}
                  alt={i === 0 ? listing.title : `${listing.title} — Photo ${i + 1}`}
                  className="w-full h-64 object-cover cursor-pointer"
                  onClick={() => openLightbox(i)}
                />
              </div>
            ))}
          </div>
          {/* Overlay badges — mobile */}
          <div className="absolute bottom-10 left-3 flex items-center gap-2 z-10">
            <Badge variant="new">Vente</Badge>
            {listing.is_hot && <Badge variant="hot"><span aria-hidden="true">🔥</span> Hot price</Badge>}
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5" aria-hidden="true">
            {photos.map((_, i) => (
              <div key={i} className={cn('h-1.5 rounded-full transition-all', mobilePhotoIndex === i ? 'w-4 bg-white' : 'w-1.5 bg-white/60')} />
            ))}
          </div>
          {photos.length > 1 && (
            <>
              <button onClick={() => scrollCarousel('left')} className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-card/80 backdrop-blur rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent" aria-label="Photo précédente">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button onClick={() => scrollCarousel('right')} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-card/80 backdrop-blur rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent" aria-label="Photo suivante">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
          <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full" aria-live="polite">
            {mobilePhotoIndex + 1}/{photos.length}
          </div>
        </section>

        {/* === MAIN CONTENT === */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 mt-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* LEFT COLUMN — Details */}
            <div className="flex-1 min-w-0">
              <div className="mb-4">
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">{listing.title}</h1>
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm">{listing.address}, {listing.postal_code} {listing.city} ({listing.canton})</span>
                </div>
              </div>

              {/* Key stats */}
              <div className="flex flex-wrap items-center gap-6 md:gap-8 py-5 border-y border-[var(--border-default)] mb-8" role="list" aria-label="Caractéristiques principales">
                <div className="flex items-center gap-3" role="listitem">
                  <DoorOpen className="h-5 w-5 text-accent" aria-hidden="true" />
                  <div><p className="text-lg font-semibold text-[var(--text-primary)]">{listing.rooms}</p><p className="text-sm text-[var(--text-muted)]">Pièces</p></div>
                </div>
                <div className="flex items-center gap-3" role="listitem">
                  <BedDouble className="h-5 w-5 text-accent" aria-hidden="true" />
                  <div><p className="text-lg font-semibold text-[var(--text-primary)]">{listing.bedrooms}</p><p className="text-sm text-[var(--text-muted)]">Chambres</p></div>
                </div>
                <div className="flex items-center gap-3" role="listitem">
                  <Bath className="h-5 w-5 text-accent" aria-hidden="true" />
                  <div><p className="text-lg font-semibold text-[var(--text-primary)]">{listing.bathrooms}</p><p className="text-sm text-[var(--text-muted)]">Salle{listing.bathrooms > 1 ? 's' : ''} de bain</p></div>
                </div>
                <div className="flex items-center gap-3" role="listitem">
                  <Maximize className="h-5 w-5 text-accent" aria-hidden="true" />
                  <div><p className="text-lg font-semibold text-[var(--text-primary)]">{formatSurface(listing.surface_m2)}</p><p className="text-sm text-[var(--text-muted)]">Surface</p></div>
                </div>
                {listing.floor !== null && (
                  <div className="flex items-center gap-3" role="listitem">
                    <Building2 className="h-5 w-5 text-accent" aria-hidden="true" />
                    <div><p className="text-lg font-semibold text-[var(--text-primary)]">{listing.floor}e/{listing.total_floors}</p><p className="text-sm text-[var(--text-muted)]">Étage</p></div>
                  </div>
                )}
              </div>

              <section className="mb-8" aria-label="Description">
                <SectionTitle icon={FileText}>Description</SectionTitle>
                <div className="text-sm text-[var(--text-primary)]/90 leading-relaxed space-y-4">
                  {listing.description.split('\n\n').map((p, i) => (<p key={i}>{p}</p>))}
                </div>
              </section>

              <section className="mb-8" aria-label="Caractéristiques">
                <SectionTitle icon={Grid3X3}>Caractéristiques</SectionTitle>
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] overflow-hidden">
                  <dl>
                    {Object.entries(listing.features).map(([key, value], i, arr) => (
                      <div
                        key={key}
                        className={cn(
                          'flex justify-between py-3 px-4',
                          i < arr.length - 1 && 'border-b border-[var(--border-default)]/50',
                          i % 2 === 1 && 'bg-[var(--bg-surface)]/50'
                        )}
                      >
                        <dt className="text-sm text-[var(--text-muted)]">{key}</dt>
                        <dd className="text-sm font-medium text-[var(--text-primary)] text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              <section className="mb-8" aria-label="Localisation">
                <SectionTitle icon={MapPin}>Localisation</SectionTitle>
                <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] min-h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="bg-accent/10 rounded-full p-3 w-14 h-14 flex items-center justify-center mx-auto mb-3">
                      <MapPin className="h-8 w-8 text-accent" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{listing.address}</p>
                    <p className="text-sm text-[var(--text-muted)]">{listing.postal_code} {listing.city}</p>
                    <p className="text-xs text-[var(--text-muted)] italic mt-3">Carte Mapbox — bientôt disponible</p>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT SIDEBAR */}
            <aside className="hidden lg:block w-[380px] flex-shrink-0" aria-label="Contact et prix">
              <div className="sticky top-24 space-y-4">
                <div className="bg-[var(--bg-card)] rounded-card border border-[var(--border-default)] ring-1 ring-white/5 p-6 shadow-card">
                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-sm font-medium text-[var(--text-muted)] block">CHF</span>
                    <p className="text-3xl font-bold text-[var(--text-primary)]">{formatCHF(listing.price).replace('CHF ', '')}</p>
                    {listing.charges_monthly > 0 && (<p className="text-sm text-[var(--text-muted)] mt-1">Charges : {formatCHF(listing.charges_monthly)}/mois</p>)}
                  </div>

                  {/* Separator */}
                  <div className="border-t border-[var(--border-default)] my-4" />

                  {/* Save + Share */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsFavorite(!isFavorite)}
                      className={cn(
                        'flex-1 h-10 rounded-button border flex items-center justify-center gap-2 text-sm font-medium transition-colors',
                        isFavorite
                          ? 'bg-danger-light border-danger text-danger'
                          : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                      )}
                      aria-pressed={isFavorite}
                      aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} aria-hidden="true" />
                      {isFavorite ? 'Sauvegardé' : 'Sauvegarder'}
                    </button>
                    <button
                      className="h-10 w-10 rounded-button bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-colors"
                      aria-label="Partager ce bien"
                    >
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="bg-[var(--bg-card)] rounded-card border border-[var(--border-default)] ring-1 ring-white/5 p-6 shadow-card">
                  <div className="flex items-center gap-3 mb-4">
                    {listing.agent.photo ? (
                      <img src={listing.agent.photo} alt={`Photo de ${listing.agent.name}`} className="h-12 w-12 rounded-full object-cover ring-2 ring-accent/20" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center ring-2 ring-accent/20 flex-shrink-0">
                        <span className="text-sm font-semibold text-white">
                          {listing.agent.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{listing.agent.name}</p>
                      <p className="text-sm text-[var(--text-muted)]">{listing.agent.agency}</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <a href={`tel:${listing.agent.phone}`} className="flex items-center gap-2 text-sm text-[var(--text-primary)] hover:text-accent transition-colors">
                      <Phone className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />{listing.agent.phone}
                    </a>
                    <a href={`mailto:${listing.agent.email}`} className="flex items-center gap-2 text-sm text-[var(--text-primary)] hover:text-accent transition-colors">
                      <Mail className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />{listing.agent.email}
                    </a>
                  </div>
                  <div className="space-y-2">
                    <Button className="w-full h-11 rounded-button gap-2"><Mail className="h-4 w-4" aria-hidden="true" />Contacter l'agent</Button>
                    <button className="w-full h-11 rounded-button gap-2 bg-[var(--bg-surface)] border border-[var(--border-default)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] font-medium text-sm inline-flex items-center justify-center transition-colors">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      Planifier une visite
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* === MOBILE STICKY PRICE BAR === */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 shadow-navbar z-40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">{formatCHF(listing.price)}</p>
              {listing.charges_monthly > 0 && (<p className="text-xs text-[var(--text-muted)]">Charges : {formatCHF(listing.charges_monthly)}/mois</p>)}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsFavorite(!isFavorite)} className={cn('h-10 w-10 rounded-full border flex items-center justify-center transition-colors', isFavorite ? 'bg-danger-light border-danger text-danger' : 'border-border text-primary-600')} aria-pressed={isFavorite} aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} aria-hidden="true" />
              </button>
              <Button size="default" className="rounded-full gap-2"><Phone className="h-4 w-4" aria-hidden="true" />Contacter</Button>
            </div>
          </div>
        </div>
      </main>

      {/* === LIGHTBOX === */}
      {lightboxOpen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col" role="dialog" aria-modal="true" aria-label={`Galerie photos — ${listing.title}`}>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-white text-sm" aria-live="polite">{lightboxIndex + 1} / {photos.length}</span>
            <button onClick={() => setLightboxOpen(false)} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white" aria-label="Fermer la galerie">
              <X className="h-5 w-5 text-white" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 relative">
            <img src={photos[lightboxIndex]} alt={`${listing.title} — Photo ${lightboxIndex + 1} sur ${photos.length}`} className="max-h-full max-w-full object-contain rounded-card" />
            {lightboxIndex > 0 && (
              <button onClick={() => setLightboxIndex(lightboxIndex - 1)} className="absolute left-4 h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white" aria-label="Photo précédente">
                <ChevronLeft className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            )}
            {lightboxIndex < photos.length - 1 && (
              <button onClick={() => setLightboxIndex(lightboxIndex + 1)} className="absolute right-4 h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white" aria-label="Photo suivante">
                <ChevronRight className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex justify-center gap-2 px-4 py-4 overflow-x-auto" role="tablist" aria-label="Miniatures">
            {photos.map((photo, i) => (
              <button key={i} onClick={() => setLightboxIndex(i)} className={cn('h-16 w-24 rounded-button overflow-hidden flex-shrink-0 border-2 transition-all', lightboxIndex === i ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-75')} role="tab" aria-selected={lightboxIndex === i} aria-label={`Miniature photo ${i + 1}`}>
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
