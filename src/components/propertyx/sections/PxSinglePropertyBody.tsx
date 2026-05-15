// MEGGA Marketplace — Property X "Single Property — Body" section.
// Source : Figma node 11781:17162 (Rich Text Section) — fidélité maquette stricte.
//
// Anatomie :
// - Container 1200px centered, 2 colonnes : Rich Text (670w) + Sidebar (412w)
// - Rich Text :
//   - Block 1 (py-64) : Location + Title H2 48 + Paragraph + Amenities inline
//   - Divider
//   - Block 2 (py-64) : H3 "About the property" + paragraph + bullet list + paragraph
//   - Divider
//   - Block 3 (pt-64 pb-120) : H3 "Amenities" + paragraph + grid 3×8 badges
// - Sidebar (pt-64) :
//   - Card Pricing (p-40, rounded 24, shadow small)
//   - Card Form (px-40 py-56) : titre + 3 inputs pill + bouton "Request information"
//   - Card Agent (px-40 py-56) : titre + paragraph + avatar 80 + nom + mail + phone

import type { CSSProperties, FormEvent } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PX, PxFigmaIcon } from '..'
import { formatCHF, formatRent } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { supabase } from '@/lib/supabase'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface PxSinglePropertyBodyProps {
  listing?: ListingCardData
}

// ───────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────

const sectionDivider: CSSProperties = {
  height: 1,
  width: '100%',
  background: PX.neutral300,
  border: 0,
  margin: 0,
}

function MetaItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: PX.neutral400 }}>
        {icon}
      </span>
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral400,
        whiteSpace: 'nowrap',
        paddingTop: 2,
      }}>
        {label}
      </span>
    </div>
  )
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: PX.neutral500,
        display: 'inline-block',
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral500,
      }}>
        {children}
      </span>
    </div>
  )
}

function AmenityBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      width: '100%',
      minWidth: 0,
      background: PX.neutral100,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 16px',
      borderRadius: PX.radius.small,
      boxShadow: PX.shadow.small,
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: PX.radius.pill,
        background: PX.neutral700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <img src={icon} alt="" style={{ width: 16, height: 16, display: 'block' }} />
      </div>
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        minWidth: 0,
      }}>
        {label}
      </span>
    </div>
  )
}

const AMENITY_BASE = '/images/sections/single-property/amenities'
const AMENITIES: Array<{ icon: string; label: string }> = [
  { icon: `${AMENITY_BASE}/air-conditioner.svg`, label: 'Climatisation' },
  { icon: `${AMENITY_BASE}/cable-tv.svg`, label: 'TV câblée' },
  { icon: `${AMENITY_BASE}/dishwasher.svg`, label: 'Lave-vaisselle' },
  { icon: `${AMENITY_BASE}/fire-extinguisher.svg`, label: 'Extincteur' },
  { icon: `${AMENITY_BASE}/elevator.svg`, label: 'Ascenseur' },
  { icon: `${AMENITY_BASE}/garden.svg`, label: 'Jardin' },
  { icon: `${AMENITY_BASE}/internet.svg`, label: 'Internet' },
  { icon: `${AMENITY_BASE}/pool.svg`, label: 'Piscine' },
  { icon: `${AMENITY_BASE}/laundry.svg`, label: 'Buanderie' },
  { icon: `${AMENITY_BASE}/security-cameras.svg`, label: 'Vidéosurveillance' },
  { icon: `${AMENITY_BASE}/iron.svg`, label: 'Fer à repasser' },
  { icon: `${AMENITY_BASE}/gym.svg`, label: 'Salle de sport' },
  { icon: `${AMENITY_BASE}/kitchen.svg`, label: 'Cuisine équipée' },
  { icon: `${AMENITY_BASE}/grill.svg`, label: 'Grill' },
  { icon: `${AMENITY_BASE}/refrigerator.svg`, label: 'Réfrigérateur' },
  { icon: `${AMENITY_BASE}/heater.svg`, label: 'Chauffage' },
  { icon: `${AMENITY_BASE}/chimney.svg`, label: 'Cheminée' },
  { icon: `${AMENITY_BASE}/sports-fields.svg`, label: 'Terrains de sport' },
  { icon: `${AMENITY_BASE}/pet-friendly.svg`, label: 'Animaux acceptés' },
  { icon: `${AMENITY_BASE}/smoking-area.svg`, label: 'Espace fumeurs' },
  { icon: `${AMENITY_BASE}/microwave.svg`, label: 'Micro-ondes' },
  { icon: `${AMENITY_BASE}/lockpad.svg`, label: 'Sécurité renforcée' },
  { icon: `${AMENITY_BASE}/kids-zone.svg`, label: 'Espace enfants' },
  { icon: `${AMENITY_BASE}/garage.svg`, label: 'Garage' },
]

// ─── Sidebar sub-components ────────────────────────────────────────────

const sidebarCard: CSSProperties = {
  background: PX.neutral100,
  borderRadius: PX.radius.large,
  boxShadow: PX.shadow.small,
  width: '100%',
  boxSizing: 'border-box',
}

function PricingCard({ listing, isMobile }: { listing?: ListingCardData; isMobile: boolean }) {
  const { t } = useTranslation()
  // Affiche le prix CHF formaté (apostrophe suisse) + sublabel selon
  // transaction_type. Fallback démo si pas de listing.
  const isRent = listing?.context === 'rent'
  const priceLabel = listing
    ? (isRent ? formatRent(listing.price) : formatCHF(listing.price))
    : "CHF 3'200/mois"
  const sublabel = listing && !isRent
    ? t('marketplaceProperty.pricing.sublabelSale')
    : t('marketplaceProperty.pricing.sublabelRent')

  return (
    <div style={{
      ...sidebarCard,
      padding: isMobile ? 24 : 40,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: isMobile ? 32 : 40,
        lineHeight: 1.25,
        letterSpacing: '-1.2px',
        color: PX.neutral700,
      }}>
        {priceLabel}
      </span>
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: isMobile ? 16 : 20,
        lineHeight: 1.25,
        letterSpacing: '-0.6px',
        color: PX.neutral400,
      }}>
        {sublabel}
      </span>
    </div>
  )
}

interface FormInputProps {
  iconName: 'form-person' | 'form-mail' | 'form-phone'
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'email' | 'tel'
  name: string
  required?: boolean
  autoComplete?: string
  disabled?: boolean
  ariaLabel: string
}

function FormInput({ iconName, placeholder, value, onChange, type = 'text', name, required, autoComplete, disabled, ariaLabel }: FormInputProps) {
  return (
    <div style={{
      background: PX.neutral200,
      borderRadius: PX.radius.pill,
      minHeight: 48,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 16,
      paddingRight: 6,
      paddingTop: 6,
      paddingBottom: 6,
      boxSizing: 'border-box',
      opacity: disabled ? 0.6 : 1,
    }}>
      <PxFigmaIcon name={iconName} size={16} color={PX.neutral500} />
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-label={ariaLabel}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 0,
          outline: 'none',
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral700,
          paddingTop: 2,
        }}
      />
    </div>
  )
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

function ContactFormCard({ isMobile, listing }: { isMobile: boolean; listing?: ListingCardData }) {
  const { t } = useTranslation()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isSubmitting = status === 'submitting'
  const isSuccess = status === 'success'

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedName) {
      setErrorMessage(t('marketplaceProperty.contact.errorNameRequired'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage(t('marketplaceProperty.contact.errorEmailInvalid'))
      return
    }

    setStatus('submitting')

    const prefixedId = listing?.id ?? null
    const rawId = prefixedId?.replace(/^(market-|internal-)/, '') ?? null
    const isMarket = prefixedId?.startsWith('market-') ?? false
    const isInternal = prefixedId?.startsWith('internal-') ?? false

    const payload = {
      listing_prefixed_id: prefixedId,
      market_listing_id: isMarket ? rawId : null,
      property_id: isInternal ? rawId : null,
      listing_title: listing?.title ?? null,
      listing_city: listing?.city ?? null,
      listing_canton: listing?.canton ?? null,
      listing_transaction_type: listing?.context ?? null,
      full_name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone || null,
      agency_name: listing?.agency_name ?? null,
      source_portal: listing?.source_portal ?? null,
      source_url: listing?.source_url ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      referer: typeof document !== 'undefined' ? document.referrer || null : null,
    }

    const { error } = await supabase.from('marketplace_inquiries').insert(payload)

    if (error) {
      console.error('[marketplace_inquiries] insert failed', error)
      setStatus('error')
      setErrorMessage(t('marketplaceProperty.contact.errorGeneric'))
      return
    }

    setStatus('success')
    setFullName('')
    setEmail('')
    setPhone('')
  }

  return (
    <div style={{
      ...sidebarCard,
      padding: isMobile ? '32px 24px' : '56px 40px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start', width: '100%' }}>
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 20,
          lineHeight: 1.25,
          letterSpacing: '-0.6px',
          color: PX.neutral700,
        }}>
          {t('marketplaceProperty.contact.title')}
        </p>
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>
          {t('marketplaceProperty.contact.subtitle')}
        </p>
      </div>
      {isSuccess ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 16,
            padding: '16px 20px',
            background: PX.neutral200,
            borderRadius: PX.radius.large,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.4,
            letterSpacing: '-0.48px',
            color: PX.neutral700,
          }}>
            {t('marketplaceProperty.contact.successTitle')}
          </p>
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '-0.4px',
            color: PX.neutral500,
          }}>
            {t('marketplaceProperty.contact.successBody')}
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            width: '100%',
          }}
          noValidate
        >
          <FormInput
            iconName="form-person"
            name="full_name"
            placeholder={t('marketplaceProperty.contact.fullName')}
            value={fullName}
            onChange={setFullName}
            autoComplete="name"
            required
            disabled={isSubmitting}
            ariaLabel={t('marketplaceProperty.contact.fullName')}
          />
          <FormInput
            iconName="form-mail"
            name="email"
            type="email"
            placeholder={t('marketplaceProperty.contact.email')}
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
            disabled={isSubmitting}
            ariaLabel={t('marketplaceProperty.contact.email')}
          />
          <FormInput
            iconName="form-phone"
            name="phone"
            type="tel"
            placeholder={t('marketplaceProperty.contact.phone')}
            value={phone}
            onChange={setPhone}
            autoComplete="tel"
            disabled={isSubmitting}
            ariaLabel={t('marketplaceProperty.contact.phone')}
          />
          {errorMessage ? (
            <p
              role="alert"
              style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 14,
                lineHeight: 1.4,
                letterSpacing: '-0.4px',
                color: '#C0392B',
              }}
            >
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 16,
              paddingRight: 10,
              paddingTop: 10,
              paddingBottom: 10,
              borderRadius: PX.radius.pill,
              background: PX.neutral700,
              color: PX.neutral100,
              border: 0,
              width: '100%',
              cursor: isSubmitting ? 'wait' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              transition: 'opacity 0.18s ease',
            }}
          >
            <span style={{ paddingTop: 2 }}>
              {isSubmitting ? t('marketplaceProperty.contact.submitting') : t('marketplaceProperty.contact.submit')}
            </span>
            <span style={{
              width: 28,
              height: 28,
              borderRadius: PX.radius.pill,
              background: PX.neutral100,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <PxFigmaIcon name="arrow-right" size={12} color={PX.neutral700} />
            </span>
          </button>
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 12,
            lineHeight: 1.4,
            letterSpacing: '-0.3px',
            color: PX.neutral400,
          }}>
            {t('marketplaceProperty.contact.consent')}
          </p>
        </form>
      )}
    </div>
  )
}

function AgenceCard({ listing, isMobile }: { listing?: ListingCardData; isMobile: boolean }) {
  const { t } = useTranslation()
  // En CH le concept central c'est l'AGENCE / régie, pas l'agent individuel
  // comme aux USA. On affiche donc :
  //   - agency_name (régie qui a publié)
  //   - agency_logo_url
  //   - source_portal + source_url pour rebondir vers l'annonce d'origine
  // Sans données contact directes (email/phone au niveau agency_profiles),
  // les visiteurs passent par le ContactFormCard juste au-dessus.
  // Sans listing : fallback démo Figma.
  const agencyName = listing?.agency_name
    || (listing ? t('marketplaceProperty.agency.fallbackName') : 'Naef Immobilier — Genève')
  const agencyLogo = listing?.agency_logo_url || '/images/sections/single-property/agent-sophie.jpg'
  const sourceLabel = listing?.source_portal
    ? t('marketplaceProperty.agency.publishedOn', { portal: listing.source_portal })
    : 'Régie partenaire certifiée'
  const intro = listing
    ? t('marketplaceProperty.agency.intro')
    : 'L’agence en charge de ce bien vous répond sous 24 h, du lundi au samedi.'
  const externalUrl = listing?.source_url

  return (
    <div style={{
      ...sidebarCard,
      padding: isMobile ? '32px 24px' : '56px 40px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      alignItems: 'flex-start',
      justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 20,
          lineHeight: 1.25,
          letterSpacing: '-0.6px',
          color: PX.neutral700,
        }}>
          {t('marketplaceProperty.agency.title')}
        </p>
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>
          {intro}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: PX.neutral300,
          overflow: 'hidden',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
        }}>
          {agencyLogo ? (
            <img
              src={agencyLogo}
              alt={agencyName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <span style={{
              fontFamily: PX.font.sans,
              fontWeight: 600,
              fontSize: 24,
              color: PX.neutral500,
            }}>
              {agencyName.slice(0, 1)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 20,
            lineHeight: 1.25,
            letterSpacing: '-0.6px',
            color: PX.neutral700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {agencyName}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <PxFigmaIcon name="form-mail" size={16} color={PX.neutral400} />
              <span style={{
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 14,
                lineHeight: 1.5,
                letterSpacing: '-0.4px',
                color: PX.neutral400,
                paddingTop: 2,
              }}>
                {sourceLabel}
              </span>
            </div>
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: PX.font.sans,
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: 1.5,
                  letterSpacing: '-0.4px',
                  color: PX.neutral700,
                  textDecoration: 'underline',
                  paddingTop: 2,
                }}
              >
                {t('marketplaceProperty.agency.viewOriginal')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────────────

export default function PxSinglePropertyBody({ listing }: PxSinglePropertyBodyProps) {
  const isMobile = useIsMobile()
  const { t } = useTranslation()
  // Champs dérivés du listing avec fallback démo Figma.
  const locationLabel = listing
    ? [listing.address, listing.city].filter(Boolean).join(', ') || 'Suisse'
    : 'Rue de la Servette, 1202 Genève'
  const titleLabel = listing?.title || 'Loft lumineux au cœur de Genève'
  const descriptionLabel = listing?.description?.trim()
    || 'Magnifique loft de 120 m² entièrement rénové, situé dans un quartier animé à proximité immédiate des transports publics et des commerces. Belle hauteur sous plafond, parquet d’origine, cuisine ouverte sur séjour et grande baie vitrée donnant sur cour intérieure calme.'
  const surfaceLabel = listing?.surface_m2 ? `${listing.surface_m2} m²` : '120 m²'
  const roomsLabel = listing?.rooms ? `${listing.rooms} p.` : '3.5 p.'
  const bedroomsLabel = listing?.bedrooms ? String(listing.bedrooms) : '3'
  const bathroomsLabel = listing?.bathrooms ? String(listing.bathrooms) : '2'

  // Mapping booléens Supabase → badges amenities. On affiche uniquement
  // ceux qui sont true sur le listing. Sans listing, on garde la grid
  // de 24 badges démo Figma (pour la route /propriete sans :id).
  const amenitiesToShow = listing
    ? (() => {
        const items: Array<{ icon: string; label: string }> = []
        if (listing.has_balcony) items.push({ icon: `${AMENITY_BASE}/garden.svg`, label: t('marketplaceProperty.amenities.balcony') })
        if (listing.has_swimming_pool) items.push({ icon: `${AMENITY_BASE}/pool.svg`, label: t('marketplaceProperty.amenities.swimmingPool') })
        if (listing.has_nice_view) items.push({ icon: `${AMENITY_BASE}/security-cameras.svg`, label: t('marketplaceProperty.amenities.niceView') })
        if (listing.has_garage) items.push({ icon: `${AMENITY_BASE}/garage.svg`, label: t('marketplaceProperty.amenities.garage') })
        if (listing.has_parking) items.push({ icon: `${AMENITY_BASE}/garage.svg`, label: t('marketplaceProperty.amenities.parking') })
        if (listing.has_elevator) items.push({ icon: `${AMENITY_BASE}/elevator.svg`, label: t('marketplaceProperty.amenities.elevator') })
        if (listing.has_fireplace) items.push({ icon: `${AMENITY_BASE}/chimney.svg`, label: t('marketplaceProperty.amenities.fireplace') })
        if (listing.is_furnished) items.push({ icon: `${AMENITY_BASE}/kitchen.svg`, label: t('marketplaceProperty.amenities.furnished') })
        if (listing.is_minergie) items.push({ icon: `${AMENITY_BASE}/heater.svg`, label: t('marketplaceProperty.amenities.minergie') })
        if (listing.is_new_building) items.push({ icon: `${AMENITY_BASE}/lockpad.svg`, label: t('marketplaceProperty.amenities.newBuilding') })
        return items
      })()
    : AMENITIES
  return (
    <section style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      background: PX.pageBg,
    }}>
      <div style={{
        width: isMobile ? 'calc(100% - 32px)' : 'min(1200px, calc(100% - 48px))',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 670fr) minmax(0, 412fr)',
        columnGap: isMobile ? 0 : 118,
        rowGap: isMobile ? 32 : 0,
        alignItems: 'start',
      }}>
        {/* ─── LEFT — Rich Text ──────────────────────────────────── */}
        <div style={{ width: '100%', minWidth: 0 }}>
          {/* Block 1 — Title + location + amenities inline */}
          <div style={{
            paddingTop: isMobile ? 32 : 64,
            paddingBottom: isMobile ? 32 : 64,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            {/* Location */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PxFigmaIcon name="location" size={20} color={PX.neutral700} />
              <span style={{
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 16,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral700,
                paddingTop: 6,
              }}>
                {locationLabel}
              </span>
            </div>

            {/* Title */}
            <div style={{ paddingTop: 16, paddingBottom: 16 }}>
              <h1 style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: isMobile ? 32 : 48,
                lineHeight: 1.25,
                letterSpacing: isMobile ? '-0.96px' : '-1.44px',
                color: PX.neutral700,
              }}>
                {titleLabel}
              </h1>
            </div>

            {/* Paragraph */}
            <div style={{ paddingBottom: 24 }}>
              <p style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
                whiteSpace: 'pre-wrap',
              }}>
                {descriptionLabel}
              </p>
            </div>

            {/* Amenities inline */}
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <MetaItem icon={<PxFigmaIcon name="surface" size={20} color={PX.neutral400} />} label={surfaceLabel} />
              <MetaItem icon={<PxFigmaIcon name="bed" size={20} color={PX.neutral400} />} label={roomsLabel} />
              {listing?.bedrooms ? <MetaItem icon={<PxFigmaIcon name="bed" size={20} color={PX.neutral400} />} label={bedroomsLabel} /> : null}
              {listing?.bathrooms ? <MetaItem icon={<PxFigmaIcon name="bath" size={20} color={PX.neutral400} />} label={bathroomsLabel} /> : null}
              {!listing ? <MetaItem icon={<PxFigmaIcon name="parking" size={20} color={PX.neutral400} />} label="3" /> : null}
            </div>
          </div>

          {!listing && <hr style={sectionDivider} />}

          {/* Block 2 — About the property (hidden when real listing → description
              already shown in block 1 lead paragraph above). */}
          {!listing && <div style={{ paddingTop: isMobile ? 32 : 64, paddingBottom: isMobile ? 32 : 64 }}>
            <div style={{ paddingTop: 16, paddingBottom: 16 }}>
              <h2 style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: isMobile ? 24 : 36,
                lineHeight: 1.25,
                letterSpacing: isMobile ? '-0.72px' : '-1.08px',
                color: PX.neutral700,
              }}>
                {t('marketplaceProperty.body.aboutTitle')}
              </h2>
            </div>
            <div style={{ paddingBottom: 24 }}>
              <p style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
              }}>
                Bien rénové en 2023, ce loft offre des prestations soignées et un cadre de vie agréable. Les volumes sont généreux et la luminosité exceptionnelle grâce à l’orientation sud-ouest. À deux pas des transports publics, des commerces et des espaces verts.
              </p>

              <div style={{
                paddingTop: 16,
                paddingBottom: 24,
                paddingLeft: 32,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <BulletItem>Hauteur sous plafond 3,2 m et parquet chêne d’origine</BulletItem>
                <BulletItem>Cuisine ouverte entièrement équipée (induction, four pyrolyse, lave-vaisselle)</BulletItem>
                <BulletItem>Cave privative et accès direct à la cour intérieure arborée</BulletItem>
                <BulletItem>Immeuble Minergie, ascenseur et local vélos sécurisé</BulletItem>
              </div>

              <p style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
              }}>
                À proximité&nbsp;: école primaire des Cropettes (3 min), parc Geisendorf (5 min), gare Cornavin (8 min en tram). Quartier réputé pour sa vie de quartier dynamique, ses bistrots et son marché hebdomadaire.
              </p>
            </div>
          </div>}

          {/* Divider avant Amenities — affiché uniquement s'il y a des
              amenities à montrer, sinon la section devient une grid vide. */}
          {(amenitiesToShow.length > 0 || !listing) && <hr style={sectionDivider} />}

          {/* Block 3 — Amenities grid (caché si aucun amenities sur listing) */}
          {(amenitiesToShow.length > 0 || !listing) && <div style={{ paddingTop: isMobile ? 32 : 64, paddingBottom: isMobile ? 64 : 120 }}>
            <div style={{ paddingTop: 16, paddingBottom: 16 }}>
              <h2 style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: isMobile ? 24 : 36,
                lineHeight: 1.25,
                letterSpacing: isMobile ? '-0.72px' : '-1.08px',
                color: PX.neutral700,
              }}>
                {t('marketplaceProperty.body.amenitiesTitle')}
              </h2>
            </div>
            {!listing && <div style={{ paddingBottom: 24 }}>
              <p style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
              }}>
                Liste complète des équipements et prestations inclus dans le bien. Tous les éléments sont en parfait état de fonctionnement.
              </p>
            </div>}
            <div style={{ paddingBottom: listing ? 16 : 0 }} />

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
              gap: isMobile ? 8 : 12,
            }}>
              {amenitiesToShow.map((a) => (
                <AmenityBadge key={a.label} icon={a.icon} label={a.label} />
              ))}
            </div>
          </div>}
        </div>

        {/* ─── RIGHT — Sidebar ────────────────────────────────────── */}
        <aside style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 16 : 24,
          paddingTop: isMobile ? 0 : 64,
          paddingBottom: isMobile ? 48 : 0,
          width: '100%',
          minWidth: 0,
        }}>
          <PricingCard listing={listing} isMobile={isMobile} />
          <ContactFormCard isMobile={isMobile} listing={listing} />
          <AgenceCard listing={listing} isMobile={isMobile} />
        </aside>
      </div>
    </section>
  )
}
