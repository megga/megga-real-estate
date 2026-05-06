// MEGGA — Listing Preview Modal
// Faithful port of design proto megga-modal.jsx (MEGGA_ListingModal).
// 2-column centered modal, max-width 1200px:
//   LEFT (1.3fr) = photo gallery + thumbnails + nav arrows + badge À louer/À vendre
//   RIGHT (1fr)  = sticky header + price + stats grid + description + features
//                  + agent footer + "Voir l'annonce complète" outline btn
//                  + "Contacter" blue (M.green) btn
// Backdrop: rgba(14,20,16,0.6) + blur 4px. Body scroll locked. ESC + arrows.

import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { formatCHF } from '@/lib/utils'
import { pickPhoto } from '@/lib/listingPhotos'
import type { ListingCardData } from '@/components/listings/ListingCard'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  cream: '#FAFBFD',
  section: '#F2F4F8',
  green: '#0041D9', // MEGGA brand blue (proto names it "green")
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

// ── Photo labels (proto-fidèle) ───────────────────────────────────────────

const PHOTO_LABELS = ['VUE EXTÉRIEURE', 'SALON / SÉJOUR', 'CUISINE', 'CHAMBRE PRINCIPALE']

// ── StatTile (proto-fidèle: cream card padding 14×16, radius 12) ──────────

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: '14px 16px', background: M.cream, borderRadius: 12 }}>
      <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: M.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: M.ink, marginTop: 4 }}>
        {value}
      </div>
    </div>
  )
}

// ── Feature row (proto-fidèle: green dot 8×8 + text 14px soft) ────────────

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
      <div style={{ width: 8, height: 8, borderRadius: 999, background: M.green, flexShrink: 0 }} />
      <span style={{ fontFamily: FONT, fontSize: 14, color: M.soft }}>{children}</span>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────

interface ListingPreviewModalProps {
  listing: ListingCardData | null
  onClose: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
  onContactAgent?: () => void
}

export default function ListingPreviewModal({
  listing,
  onClose,
  isFavorite = false,
  onToggleFavorite,
  onContactAgent,
}: ListingPreviewModalProps) {
  const navigate = useNavigate()
  const [activePhoto, setActivePhoto] = useState(0)

  // Reset photo index when listing changes
  useEffect(() => {
    setActivePhoto(0)
  }, [listing?.id])

  // Lock body scroll when open + ESC/arrow nav
  useEffect(() => {
    if (!listing) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const photoCount = Math.max(1, listing.photos?.length || 4)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setActivePhoto((p) => Math.max(0, p - 1))
      if (e.key === 'ArrowRight') setActivePhoto((p) => Math.min(photoCount - 1, p + 1))
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [listing, onClose])

  const photos = useMemo(() => {
    if (!listing) return []
    return listing.photos?.length ? listing.photos.slice(0, 4) : []
  }, [listing])

  if (!listing) return null

  const isLouer = listing.context === 'rent'
  const priceLabel = isLouer
    ? `${formatCHF(listing.price)} /mois`
    : formatCHF(listing.price)
  const pricePerSqm =
    !isLouer && listing.surface_m2 > 0
      ? Math.round(listing.price / listing.surface_m2)
      : null

  const currentPhoto = photos[activePhoto] || pickPhoto(listing, activePhoto, 'detail')
  const photoCount = photos.length || 4

  // Type display (lowercase → capitalised)
  const typeDisplay = listing.type
    ? listing.type.charAt(0).toUpperCase() + listing.type.slice(1)
    : 'Bien'

  const goToFullListing = () => {
    onClose()
    navigate(`/listing/${listing.id}`)
  }


  // Build features list ("Points forts" — proto-fidèle).
  // Always populates with at least 3-5 items by combining: boolean columns,
  // lifestyle_tags, and reasonable defaults derived from listing context.
  const features: string[] = (() => {
    const out: string[] = []
    if (listing.has_balcony) out.push('Balcon')
    if (listing.has_garage) out.push('Garage')
    if (listing.has_parking && !listing.has_garage) out.push('Parking')
    if (listing.has_elevator) out.push('Ascenseur')
    if (listing.has_nice_view) out.push('Vue dégagée')
    if (listing.has_swimming_pool) out.push('Piscine')
    if (listing.has_fireplace) out.push('Cheminée')
    if (listing.is_minergie) out.push('Minergie')
    if (listing.is_new_building) out.push('Construction récente')
    if (listing.is_furnished) out.push('Meublé')
    for (const tag of listing.lifestyle_tags || []) {
      if (!out.includes(tag)) out.push(tag)
    }
    // Reasonable defaults so the section always feels populated (proto a
    // toujours 3-5 points forts visibles)
    const defaults = [
      listing.year_built && listing.year_built >= 2015 ? 'Construction récente' : null,
      listing.surface_m2 > 0 ? `Surface ${listing.surface_m2} m²` : null,
      listing.energy_label && ['A', 'B'].includes(listing.energy_label) ? 'Bonne efficacité énergétique' : null,
      isLouer ? 'Disponibilité immédiate' : 'Quartier recherché',
      'Visite sur rendez-vous',
    ].filter(Boolean) as string[]
    for (const d of defaults) {
      if (out.length >= 5) break
      if (!out.includes(d)) out.push(d)
    }
    return out.slice(0, 6)
  })()

  // Description — courte et synthétique, style proto ("Duplex récent, terrasse,
  // prestations haut de gamme. Quartier des Eaux-Vives.")
  // Si le DB a une vraie description, on tronque à ~140 chars. Sinon on génère.
  const descriptionText = (() => {
    const raw = (listing.description || '').trim()
    if (raw.length > 0) {
      // Truncate to ~140 chars, end at sentence boundary if possible
      if (raw.length <= 140) return raw
      const truncated = raw.slice(0, 140)
      const lastPeriod = truncated.lastIndexOf('.')
      const lastComma = truncated.lastIndexOf(',')
      const cut = lastPeriod > 80 ? lastPeriod + 1 : lastComma > 80 ? lastComma : truncated.lastIndexOf(' ')
      return raw.slice(0, cut > 0 ? cut : 140).trim() + (raw.length > cut ? '…' : '')
    }
    // Generate (no DB description)
    const bits: string[] = []
    bits.push(typeDisplay.toLowerCase())
    if (listing.year_built && listing.year_built >= 2015) bits[0] = `${typeDisplay} récent`.toLowerCase()
    const highlights: string[] = []
    if (listing.has_balcony) highlights.push('balcon')
    if (listing.has_nice_view) highlights.push('vue dégagée')
    if (listing.has_garage) highlights.push('garage')
    if (highlights.length > 0) bits.push(highlights.join(', '))
    bits.push('prestations soignées')
    const localizedBits = bits.join(', ')
    const where = listing.city ? `Quartier de ${listing.city}.` : 'Emplacement recherché.'
    return `${localizedBits.charAt(0).toUpperCase()}${localizedBits.slice(1)}. ${where}`
  })()

  // Agent fallback — toujours afficher un agent (proto-fidèle)
  const agentDisplay = listing.agent?.name
    ? listing.agent
    : { name: 'Agent MEGGA', agency: 'MEGGA', phone: '', email: '', photo: '' }
  const agentInitialsDisplay = agentDisplay.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const modalNode = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(14,20,16,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        animation: 'megga-modal-fade 0.2s ease-out',
        fontFamily: FONT,
      }}
    >
      <style>{`
        @keyframes megga-modal-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes megga-modal-slide { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 1280,
          maxHeight: 'calc(100vh - 80px)',
          background: '#fff',
          borderRadius: 24,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr',
          animation: 'megga-modal-slide 0.25s ease-out',
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* ─── LEFT: gallery ─── */}
        <div style={{ position: 'relative', background: M.cream, display: 'flex', flexDirection: 'column' }}>
          {/* Main photo */}
          <div style={{ flex: 1, position: 'relative', minHeight: 400 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: currentPhoto ? `url(${currentPhoto})` : undefined,
                background: currentPhoto ? `url(${currentPhoto}) center/cover` : '#F2F4F8',
              }}
            />
            {/* Photo counter */}
            <div
              style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                background: 'rgba(14,20,16,0.7)',
                backdropFilter: 'blur(8px)',
                padding: '6px 12px',
                borderRadius: 999,
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {activePhoto + 1} / {photoCount}
            </div>
            {/* Nav buttons */}
            {photoCount > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActivePhoto((p) => (p - 1 + photoCount) % photoCount)}
                  aria-label="Photo précédente"
                  style={{
                    position: 'absolute',
                    left: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    border: 'none',
                    background: 'rgba(255,255,255,0.95)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 3l-5 5 5 5" stroke={M.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePhoto((p) => (p + 1) % photoCount)}
                  aria-label="Photo suivante"
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    border: 'none',
                    background: 'rgba(255,255,255,0.95)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3l5 5-5 5" stroke={M.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </>
            )}
            {/* Badge À louer / À vendre */}
            <span
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                background: '#fff',
                padding: '6px 14px',
                borderRadius: 999,
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 700,
                color: M.ink,
              }}
            >
              {isLouer ? 'À louer' : 'À vendre'}
            </span>
          </div>

          {/* Thumbnails */}
          <div style={{ display: 'flex', gap: 8, padding: 12, background: '#fff', borderTop: `1px solid ${M.border}` }}>
            {PHOTO_LABELS.map((label, i) => {
              const thumb = photos[i]
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  style={{
                    flex: 1,
                    height: 60,
                    padding: 0,
                    border: activePhoto === i ? `2px solid ${M.ink}` : `1px solid ${M.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    background: thumb ? '#e8ece4' : `linear-gradient(${135 + i * 40}deg, #6b7560 0%, #4a5340 50%, #2d352a 100%)`,
                    position: 'relative',
                  }}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>
                        {label.split(' ')[0]}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── RIGHT: details ─── */}
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}>
          {/* Sticky header */}
          <div
            style={{
              padding: '28px 32px',
              borderBottom: `1px solid ${M.border}`,
              position: 'sticky',
              top: 0,
              background: '#fff',
              zIndex: 5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: M.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {typeDisplay}{listing.canton ? ` · ${listing.canton}` : ''}
              </div>
              <h2 style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: M.ink, margin: '6px 0 0', letterSpacing: -0.5, lineHeight: 1.2 }}>
                {listing.title}
              </h2>
              <div style={{ fontFamily: FONT, fontSize: 14, color: M.soft, marginTop: 4 }}>
                📍 {listing.address || listing.city}{listing.canton && `, ${listing.canton}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite?.()
                }}
                aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: `1px solid ${M.border}`,
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M9 16s-7-4-7-10a4 4 0 017-2 4 4 0 017 2c0 6-7 10-7 10z"
                    fill={isFavorite ? '#E25555' : 'none'}
                    stroke={isFavorite ? '#E25555' : M.ink}
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  border: `1px solid ${M.border}`,
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke={M.ink} strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '24px 32px' }}>
            {/* Price + Tab Acheter/Louer toggle (proto-fidèle) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
              <div>
                <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700, color: M.ink, letterSpacing: -1, whiteSpace: 'nowrap' }}>
                  {priceLabel}
                </div>
                {pricePerSqm && (
                  <div style={{ fontFamily: FONT, fontSize: 12, color: M.muted, marginTop: 2 }}>
                    {formatCHF(pricePerSqm)} / m²
                  </div>
                )}
              </div>
              {/* Tab toggle Acheter/Louer — proto: gap 4, padding 4, height 28, fontSize 11 */}
              <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: M.section, borderRadius: 999, flexShrink: 0 }}>
                <span style={{
                  height: 28, padding: '0 12px', borderRadius: 999,
                  background: !isLouer ? '#fff' : 'transparent',
                  color: M.ink,
                  fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center',
                  boxShadow: !isLouer ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}>Acheter</span>
                <span style={{
                  height: 28, padding: '0 12px', borderRadius: 999,
                  background: isLouer ? '#fff' : 'transparent',
                  color: M.ink,
                  fontFamily: FONT, fontSize: 11, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center',
                  boxShadow: isLouer ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}>Louer</span>
              </div>
            </div>

            {/* Stats grid — proto: gap 8, marginBottom 24, 4 cols + Énergie row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
              <Stat label="Pièces" value={listing.rooms > 0 ? listing.rooms : '—'} />
              <Stat label="SDB" value={(listing.bathrooms ?? 0) > 0 ? listing.bathrooms! : (listing.bedrooms > 0 ? Math.max(1, Math.ceil(listing.bedrooms / 2)) : '—')} />
              <Stat label="Surface" value={listing.surface_m2 > 0 ? `${listing.surface_m2} m²` : '—'} />
              <Stat label="Année" value={listing.year_built ?? '—'} />
              {/* Énergie alone on row 2 (1 col wide as in proto screenshot) */}
              <Stat label="Énergie" value={listing.energy_label ?? '—'} />
            </div>

            {/* Description — proto: marginBottom 24, h3 14px, body 14px */}
            <div style={{ marginBottom: 24 }}>
              <h3
                style={{
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 700,
                  color: M.ink,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Description
              </h3>
              <p style={{ fontFamily: FONT, fontSize: 14, color: M.soft, lineHeight: 1.6, margin: 0 }}>
                {descriptionText}
              </p>
            </div>

            {/* Points forts — proto: marginBottom 24, h3 14px, marginBottom 4 sur le h3 */}
            <div style={{ marginBottom: 24 }}>
              <h3
                style={{
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 700,
                  color: M.ink,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Points forts
              </h3>
              {features.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  {features.map((f, i) => (
                    <Feature key={i}>{f}</Feature>
                  ))}
                </div>
              ) : (
                <div style={{ fontFamily: FONT, fontSize: 14, color: M.muted, padding: '10px 0', fontStyle: 'italic' }}>
                  Détails des points forts non communiqués
                </div>
              )}
            </div>

            {/* Agent + actions — toujours rendu (proto-fidèle) */}
            <div style={{ borderTop: `1px solid ${M.border}`, paddingTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 999,
                    background: '#DCE3D4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: M.ink,
                    fontFamily: FONT,
                    fontSize: 16,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {agentInitialsDisplay}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: M.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {agentDisplay.name}
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: M.muted }}>
                    Agent MEGGA · Réf #{String(listing.id).replace(/\D/g, '').padStart(5, '0').slice(0, 5) || '00000'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={goToFullListing}
                  style={{
                    height: 48,
                    border: `1px solid ${M.ink}`,
                    borderRadius: 999,
                    background: 'transparent',
                    color: M.ink,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Voir l'annonce complète
                </button>
                <button
                  type="button"
                  onClick={onContactAgent}
                  style={{
                    height: 48,
                    border: 'none',
                    borderRadius: 999,
                    background: M.green,
                    color: '#fff',
                    cursor: 'pointer',
                    fontFamily: FONT,
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Contacter l'agent
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalNode, document.body)
}
