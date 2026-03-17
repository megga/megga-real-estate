import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  MapPin, DoorOpen, BedDouble, Bath, Maximize, Building2, Heart, Share2,
  Phone, Mail, CalendarDays, ChevronLeft, ChevronRight, X, Images,
} from 'lucide-react'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/layout/Navbar'
import { getListingById } from '@/lib/mockData'

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'hot' | 'new' | 'exclusive' | 'default' }) {
  const styles = {
    hot: 'bg-danger text-white',
    new: 'bg-accent text-white',
    exclusive: 'bg-primary-900 text-white',
    default: 'bg-section text-primary-700',
  }
  return (
    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-badge inline-flex items-center gap-1', styles[variant])}>
      {children}
    </span>
  )
}

export default function ListingPage() {
  const { id } = useParams<{ id: string }>()
  const listing = getListingById(id || '')
  const [isFavorite, setIsFavorite] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [mobilePhotoIndex, setMobilePhotoIndex] = useState(0)
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
      <div className="min-h-screen bg-white">
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
    <div className="min-h-screen bg-white">
      <Navbar />

      <main id="main-content">
        {/* === PHOTO GALLERY — Desktop: Airbnb grid === */}
        <section className="hidden md:block max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-6" aria-label="Galerie photos">
          <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] rounded-card overflow-hidden relative">
            {/* Main photo */}
            <button
              className="col-span-2 row-span-2 relative overflow-hidden"
              onClick={() => openLightbox(0)}
              aria-label={`Photo principale de ${listing.title} — Ouvrir la galerie`}
            >
              <img src={photos[0]} alt={listing.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
            </button>
            {/* Secondary photos */}
            {photos.slice(1, 5).map((photo, i) => (
              <button
                key={i}
                className="relative overflow-hidden"
                onClick={() => openLightbox(i + 1)}
                aria-label={`Photo ${i + 2} sur ${photos.length} — Ouvrir la galerie`}
              >
                <img src={photo} alt={`${listing.title} — Photo ${i + 2}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
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
            <button
              onClick={() => openLightbox(0)}
              className="absolute bottom-4 right-4 bg-white/90 backdrop-blur text-primary-900 text-sm font-medium px-4 py-2 rounded-button shadow-card hover:bg-white transition-colors flex items-center gap-2"
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
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5" aria-hidden="true">
            {photos.map((_, i) => (
              <div key={i} className={cn('h-1.5 rounded-full transition-all', mobilePhotoIndex === i ? 'w-4 bg-white' : 'w-1.5 bg-white/60')} />
            ))}
          </div>
          {photos.length > 1 && (
            <>
              <button onClick={() => scrollCarousel('left')} className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent" aria-label="Photo précédente">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button onClick={() => scrollCarousel('right')} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent" aria-label="Photo suivante">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
          <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full" aria-live="polite">
            {mobilePhotoIndex + 1}/{photos.length}
          </div>
        </section>

        {/* === MAIN CONTENT === */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* LEFT COLUMN — Details */}
            <div className="flex-1 min-w-0">
              <div className="mb-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {listing.is_hot && <Badge variant="hot"><span aria-hidden="true">🔥</span> Hot price</Badge>}
                  {listing.is_new && <Badge variant="new">Nouveau</Badge>}
                  {listing.is_exclusive && <Badge variant="exclusive">Exclusif</Badge>}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-primary-900 mb-2">{listing.title}</h1>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm">{listing.address}, {listing.postal_code} {listing.city} ({listing.canton})</span>
                </div>
              </div>

              {/* Key stats */}
              <div className="flex flex-wrap items-center gap-4 md:gap-6 py-5 border-y border-border mb-6" role="list" aria-label="Caractéristiques principales">
                <div className="flex items-center gap-2" role="listitem">
                  <DoorOpen className="h-5 w-5 text-accent" aria-hidden="true" />
                  <div><p className="text-sm font-semibold text-primary-900">{listing.rooms}</p><p className="text-xs text-muted-foreground">Pièces</p></div>
                </div>
                <div className="flex items-center gap-2" role="listitem">
                  <BedDouble className="h-5 w-5 text-accent" aria-hidden="true" />
                  <div><p className="text-sm font-semibold text-primary-900">{listing.bedrooms}</p><p className="text-xs text-muted-foreground">Chambres</p></div>
                </div>
                <div className="flex items-center gap-2" role="listitem">
                  <Bath className="h-5 w-5 text-accent" aria-hidden="true" />
                  <div><p className="text-sm font-semibold text-primary-900">{listing.bathrooms}</p><p className="text-xs text-muted-foreground">Salle{listing.bathrooms > 1 ? 's' : ''} de bain</p></div>
                </div>
                <div className="flex items-center gap-2" role="listitem">
                  <Maximize className="h-5 w-5 text-accent" aria-hidden="true" />
                  <div><p className="text-sm font-semibold text-primary-900">{formatSurface(listing.surface_m2)}</p><p className="text-xs text-muted-foreground">Surface</p></div>
                </div>
                {listing.floor !== null && (
                  <div className="flex items-center gap-2" role="listitem">
                    <Building2 className="h-5 w-5 text-accent" aria-hidden="true" />
                    <div><p className="text-sm font-semibold text-primary-900">{listing.floor}e/{listing.total_floors}</p><p className="text-xs text-muted-foreground">Étage</p></div>
                  </div>
                )}
              </div>

              <section className="mb-8" aria-label="Description">
                <h2 className="text-xl font-semibold text-primary-900 mb-4">Description</h2>
                <div className="text-sm text-primary-700 leading-relaxed space-y-4">
                  {listing.description.split('\n\n').map((p, i) => (<p key={i}>{p}</p>))}
                </div>
              </section>

              <section className="mb-8" aria-label="Caractéristiques">
                <h2 className="text-xl font-semibold text-primary-900 mb-4">Caractéristiques</h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {Object.entries(listing.features).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-2.5 border-b border-border-light">
                      <dt className="text-sm text-muted-foreground">{key}</dt>
                      <dd className="text-sm font-medium text-primary-900 text-right">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="mb-8" aria-label="Localisation">
                <h2 className="text-xl font-semibold text-primary-900 mb-4">Localisation</h2>
                <div className="bg-section rounded-card h-64 flex items-center justify-center border border-border">
                  <div className="text-center">
                    <MapPin className="h-8 w-8 text-accent mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm font-medium text-primary-700">{listing.address}</p>
                    <p className="text-xs text-muted-foreground">{listing.postal_code} {listing.city}</p>
                    <p className="text-xs text-muted-foreground mt-2">Carte Mapbox — bientôt disponible</p>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT SIDEBAR */}
            <aside className="hidden lg:block w-[380px] flex-shrink-0" aria-label="Contact et prix">
              <div className="sticky top-24 space-y-4">
                <div className="bg-white rounded-card border border-border p-6 shadow-card">
                  <p className="text-3xl font-bold text-primary-900 mb-1">{formatCHF(listing.price)}</p>
                  {listing.charges_monthly > 0 && (<p className="text-sm text-muted-foreground">Charges : {formatCHF(listing.charges_monthly)}/mois</p>)}
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setIsFavorite(!isFavorite)} className={cn('flex-1 h-10 rounded-button border flex items-center justify-center gap-2 text-sm font-medium transition-colors', isFavorite ? 'bg-danger-light border-danger text-danger' : 'border-border text-primary-700 hover:bg-section')} aria-pressed={isFavorite} aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                      <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} aria-hidden="true" />
                      {isFavorite ? 'Sauvegardé' : 'Sauvegarder'}
                    </button>
                    <button className="h-10 w-10 rounded-button border border-border flex items-center justify-center text-primary-700 hover:bg-section transition-colors" aria-label="Partager ce bien">
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-card border border-border p-6 shadow-card">
                  <div className="flex items-center gap-3 mb-4">
                    <img src={listing.agent.photo} alt={`Photo de ${listing.agent.name}`} className="h-12 w-12 rounded-full object-cover" />
                    <div>
                      <p className="text-sm font-semibold text-primary-900">{listing.agent.name}</p>
                      <p className="text-xs text-muted-foreground">{listing.agent.agency}</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <a href={`tel:${listing.agent.phone}`} className="flex items-center gap-2 text-sm text-primary-700 hover:text-accent transition-colors">
                      <Phone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{listing.agent.phone}
                    </a>
                    <a href={`mailto:${listing.agent.email}`} className="flex items-center gap-2 text-sm text-primary-700 hover:text-accent transition-colors">
                      <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{listing.agent.email}
                    </a>
                  </div>
                  <div className="space-y-2">
                    <Button className="w-full h-11 rounded-button gap-2"><Mail className="h-4 w-4" aria-hidden="true" />Contacter l'agent</Button>
                    <Button variant="outline" className="w-full h-11 rounded-button gap-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />Planifier une visite</Button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* === MOBILE STICKY PRICE BAR === */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] z-40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-primary-900">{formatCHF(listing.price)}</p>
              {listing.charges_monthly > 0 && (<p className="text-xs text-muted-foreground">Charges : {formatCHF(listing.charges_monthly)}/mois</p>)}
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
            <img src={photos[lightboxIndex]} alt={`${listing.title} — Photo ${lightboxIndex + 1} sur ${photos.length}`} className="max-h-full max-w-full object-contain rounded-lg" />
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
              <button key={i} onClick={() => setLightboxIndex(i)} className={cn('h-16 w-24 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all', lightboxIndex === i ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-75')} role="tab" aria-selected={lightboxIndex === i} aria-label={`Miniature photo ${i + 1}`}>
                <img src={photo} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
