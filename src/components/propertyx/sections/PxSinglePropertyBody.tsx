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

import type { CSSProperties, FormEvent, MouseEvent } from 'react'
import { useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { PX, PxFigmaIcon, PxIcon } from '..'
import { formatCHF, formatRent } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useFavorites } from '@/hooks/useFavorites'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { ListingCardData } from '@/components/listings/ListingCard'

// Lazy-loaded — ReportListingDialog est rarement utilisé et embarque createPortal
const ReportListingDialog = lazy(() => import('@/components/listing/ReportListingDialog'))

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

  // Prix par m² : seulement si dispo dans le data ET pertinent (vente)
  // Pour la location, le ratio loyer/m² est moins parlant pour l'acheteur.
  const pricePerSqm = listing?.price_per_m2
  const showPricePerSqm = !isRent && pricePerSqm && pricePerSqm > 0

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
      {showPricePerSqm ? (
        <span style={{
          marginTop: 4,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 14,
          lineHeight: 1.4,
          letterSpacing: '-0.4px',
          color: PX.neutral500,
        }}>
          {t('marketplaceProperty.pricePerSqm', { value: pricePerSqm.toLocaleString('fr-CH').replace(/\s/g, "'") })}
        </span>
      ) : null}
    </div>
  )
}

// ─── Long description with "Read more / Read less" ────────────────────
// Les descriptions Flatfox font souvent 1500-3000 caractères et écrasent la
// mise en page. On tronque à ~400 chars avec un bouton expand/collapse.
// Si la description fait déjà < 400 chars, pas de bouton.

const DESCRIPTION_TRUNCATE_THRESHOLD = 400

function LongDescription({ text }: { text: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > DESCRIPTION_TRUNCATE_THRESHOLD

  const displayed = !isLong || expanded
    ? text
    // On coupe sur un espace pour éviter de trancher un mot au milieu
    : (() => {
        const slice = text.slice(0, DESCRIPTION_TRUNCATE_THRESHOLD)
        const lastSpace = slice.lastIndexOf(' ')
        return slice.slice(0, lastSpace > 200 ? lastSpace : DESCRIPTION_TRUNCATE_THRESHOLD) + '…'
      })()

  return (
    <>
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
        {displayed}
      </p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            marginTop: 8,
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 14,
            lineHeight: 1.4,
            letterSpacing: '-0.4px',
            color: PX.neutral700,
            textDecoration: 'underline',
          }}
        >
          {expanded ? t('marketplaceProperty.description.readLess') : t('marketplaceProperty.description.readMore')}
        </button>
      ) : null}
    </>
  )
}

// ─── Freshness badges ──────────────────────────────────────────────────
// Affiche jusqu'à 3 badges signalétiques sous le titre (Nouveau / Prix
// baissé / Publié il y a X). Aide l'acheteur à jauger l'opportunité.

function publishedLabel(t: ReturnType<typeof useTranslation>['t'], publishedAt?: string, daysOnMarket?: number): string | null {
  // days_on_market est calculé côté Supabase quand dispo (market_listings).
  // Sinon fallback sur le diff avec publishedAt.
  let days = daysOnMarket
  if (days == null && publishedAt) {
    const diff = Date.now() - new Date(publishedAt).getTime()
    days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
  }
  if (days == null) return null
  if (days === 0) return t('marketplaceProperty.badges.publishedToday')
  if (days < 14) return t('marketplaceProperty.badges.publishedAgo_day', { count: days })
  if (days < 60) return t('marketplaceProperty.badges.publishedAgo_week', { count: Math.round(days / 7) })
  return t('marketplaceProperty.badges.publishedAgo_month', { count: Math.round(days / 30) })
}

function FreshnessBadges({ listing }: { listing?: ListingCardData }) {
  const { t } = useTranslation()
  if (!listing) return null

  const isNew = listing.is_new === true || (listing.days_on_market != null && listing.days_on_market <= 3)
  const priceDropPct = listing.price_drop_pct
  const publishedText = publishedLabel(t, listing.published_at, listing.days_on_market)

  const badges: Array<{ label: string; tone: 'neutral' | 'accent' | 'warning' }> = []
  if (isNew) badges.push({ label: t('marketplaceProperty.badges.new'), tone: 'accent' })
  if (priceDropPct && priceDropPct > 0) {
    badges.push({ label: t('marketplaceProperty.badges.priceDrop', { percent: priceDropPct }), tone: 'warning' })
  }
  if (publishedText) badges.push({ label: publishedText, tone: 'neutral' })

  if (badges.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 16 }}>
      {badges.map((b) => {
        const palette = b.tone === 'accent'
          ? { bg: PX.neutral700, fg: PX.neutral100 }
          : b.tone === 'warning'
            ? { bg: '#FCE8DE', fg: '#9B3A0B' }
            : { bg: PX.neutral200, fg: PX.neutral500 }
        return (
          <span
            key={b.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 6,
              paddingBottom: 6,
              background: palette.bg,
              color: palette.fg,
              borderRadius: PX.radius.pill,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 13,
              lineHeight: 1.3,
              letterSpacing: '-0.3px',
            }}
          >
            {b.label}
          </span>
        )
      })}
    </div>
  )
}

// ─── Action bar ────────────────────────────────────────────────────────
// Boutons utilitaires sous le titre : partager, favoris, signaler.
// Mobile : row sous le title. Desktop : row right-aligned à côté du title.

function ActionBar({ listing, layout = 'inline' }: { listing?: ListingCardData; layout?: 'inline' | 'stacked' }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [shareCopied, setShareCopied] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const favoriteOn = listing ? isFavorite(listing.id) : false

  const handleShare = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (typeof window === 'undefined') return
    const url = window.location.href
    const shareTitle = listing?.title ?? t('marketplaceProperty.actions.shareTitle')
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url })
        return
      }
    } catch {
      // user cancelled — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleFavorite = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (listing) toggleFavorite(listing.id, !!user)
  }

  const buttonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 8,
    paddingBottom: 8,
    background: PX.neutral100,
    border: `1px solid ${PX.neutral300}`,
    borderRadius: PX.radius.pill,
    cursor: 'pointer',
    fontFamily: PX.font.sans,
    fontWeight: 500,
    fontSize: 14,
    lineHeight: 1.3,
    letterSpacing: '-0.4px',
    color: PX.neutral700,
    transition: 'background 0.18s ease, border-color 0.18s ease',
  }

  return (
    <>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: layout === 'inline' ? 'flex-end' : 'flex-start',
      }}>
        <button type="button" onClick={handleShare} aria-label={t('marketplaceProperty.actions.share')} style={buttonStyle}>
          <PxIcon name="share" size={14} color={PX.neutral700} />
          <span style={{ paddingTop: 1 }}>
            {shareCopied ? t('marketplaceProperty.actions.shareCopied') : t('marketplaceProperty.actions.share')}
          </span>
        </button>
        <button
          type="button"
          onClick={handleFavorite}
          aria-label={favoriteOn ? t('marketplaceProperty.favoriteRemove') : t('marketplaceProperty.favoriteAdd')}
          aria-pressed={favoriteOn}
          disabled={!listing}
          style={{
            ...buttonStyle,
            background: favoriteOn ? PX.neutral700 : PX.neutral100,
            borderColor: favoriteOn ? PX.neutral700 : PX.neutral300,
            color: favoriteOn ? PX.neutral100 : PX.neutral700,
            opacity: listing ? 1 : 0.4,
          }}
        >
          <PxIcon name="heart" size={14} color={favoriteOn ? PX.neutral100 : PX.neutral700} />
          <span style={{ paddingTop: 1 }}>
            {favoriteOn ? t('marketplaceProperty.favoriteRemove') : t('marketplaceProperty.favoriteAdd')}
          </span>
        </button>
        {listing ? (
          <button type="button" onClick={() => setReportOpen(true)} aria-label={t('marketplaceProperty.actions.report')} style={buttonStyle}>
            <PxIcon name="flag" size={14} color={PX.neutral700} />
            <span style={{ paddingTop: 1 }}>{t('marketplaceProperty.actions.report')}</span>
          </button>
        ) : null}
      </div>
      {reportOpen && listing ? (
        <Suspense fallback={null}>
          <ReportListingDialog
            listingId={listing.id}
            listingTitle={listing.title}
            onClose={() => setReportOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
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
    <div
      id="contact-form"
      style={{
        ...sidebarCard,
        padding: isMobile ? '32px 24px' : '56px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        scrollMarginTop: 96,
      }}
    >
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
            {/* Title — placé en premier pour s'aligner visuellement avec la
                PricingCard à droite (les deux démarrent au paddingTop du grid). */}
            <div style={{ paddingBottom: 12 }}>
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

            {/* Location — sous le titre, pin + adresse */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 16 }}>
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

            {/* Freshness badges (Nouveau / Prix baissé / Publié il y a X) */}
            <FreshnessBadges listing={listing} />

            {/* Amenities inline — remontées sous les badges de fraîcheur car
                la description peut être très longue (Flatfox 1500-3000 chars). */}
            <div style={{
              display: 'flex',
              gap: 24,
              alignItems: 'center',
              flexWrap: 'wrap',
              paddingBottom: 24,
            }}>
              <MetaItem icon={<PxFigmaIcon name="surface" size={20} color={PX.neutral400} />} label={surfaceLabel} />
              <MetaItem icon={<PxFigmaIcon name="home-simple" size={20} color={PX.neutral400} />} label={roomsLabel} />
              {listing?.bedrooms ? <MetaItem icon={<PxFigmaIcon name="bed" size={20} color={PX.neutral400} />} label={bedroomsLabel} /> : null}
              {listing?.bathrooms ? <MetaItem icon={<PxFigmaIcon name="bath" size={20} color={PX.neutral400} />} label={bathroomsLabel} /> : null}
              {!listing ? <MetaItem icon={<PxFigmaIcon name="parking" size={20} color={PX.neutral400} />} label="3" /> : null}
            </div>

            {/* ActionBar mobile-only — pills accessibles près du titre sans
                avoir à scroller la description + la sidebar. Sur desktop elle
                est dans la sidebar sous le PricingCard (cf. <aside>). */}
            {listing && isMobile ? (
              <div style={{ paddingBottom: 24 }}>
                <ActionBar listing={listing} layout="stacked" />
              </div>
            ) : null}

            {/* Paragraph */}
            <div style={{ paddingBottom: 24 }}>
              <LongDescription text={descriptionLabel} />
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
          // Sticky desktop : la sidebar reste à l'écran pendant qu'on scrolle
          // le contenu (description, équipements). top = nav height (~88) + 24.
          ...(isMobile ? {} : { position: 'sticky', top: 112, alignSelf: 'start' }),
        }}>
          <PricingCard listing={listing} isMobile={isMobile} />
          {/* Pills d'actions (Partager / Favoris / Signaler) — desktop seulement.
              Sur mobile, elles sont rendues dans la colonne principale, juste
              après les MetaItems, pour rester accessibles sans long scroll. */}
          {listing && !isMobile ? <ActionBar listing={listing} layout="stacked" /> : null}
          <ContactFormCard isMobile={isMobile} listing={listing} />
          <AgenceCard listing={listing} isMobile={isMobile} />
        </aside>
      </div>
    </section>
  )
}
