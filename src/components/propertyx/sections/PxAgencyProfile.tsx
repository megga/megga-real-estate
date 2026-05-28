// MEGGA Marketplace — Property X "🏢 Agency Single".
// Adapté de PxAgentProfile (Figma node 9552:21460) pour les données agence
// Supabase (table agency_profiles + agents + market_listings).
//
// Composition (top → bottom) :
//   1. Hero Section
//      • ProfileCard 486w auto-h : logo overlap sur band neutral700,
//        nom + ville/canton, contact rows (email/tel/adresse/fondée),
//        share URL pill, bouton "Contacter" top-right
//      • RichText 657w : "À propos" + description + "Spécialités" bullets
//   2. Properties Section (dark neutral700) : biens actifs de l'agence
//      (2-col grid de PropertyCardV2 — pattern PxAgentProfile)
//   3. Team Section (light) : agents de l'agence (3-col grid de cards)

import { Link } from 'react-router-dom'
import { useState } from 'react'
import { PX, PxFigmaIcon } from '..'
import { formatCHF, formatRent } from '@/lib/utils'

// ─── Types (sous-ensemble d'AgencyProfileRow + AgentProfileRow) ─────────
export interface AgencyData {
  id: string
  name: string
  slug: string
  logo_url: string | null
  canton: string | null
  city: string | null
  address: string | null
  description: string | null
  founded_year: number | null
  specialties: string[]
  languages: string[]
  certifications: string[]
  zones_covered: string[]
  website_url: string | null
  phone: string | null
  email: string | null
  status: 'unclaimed' | 'claimed' | 'verified'
  agent_count: number
  active_listings_count: number
}

export interface AgentMini {
  id: string
  slug: string | null
  first_name: string | null
  last_name: string | null
  photo_url: string | null
  specialties?: string[]
  status?: string
}

export interface ListingMini {
  id: string
  title: string
  price: number | string | null
  current_price: number | string | null
  address: string | null
  city: string | null
  canton: string | null
  rooms: number | null
  surface_m2: number | null
  photos: string[] | null
  transaction_type: string
  type: string | null
}

interface PxAgencyProfileProps {
  agency: AgencyData
  agents: AgentMini[]
  listings: ListingMini[]
}

const CANTON_LABELS: Record<string, string> = {
  AG: 'Argovie', AI: 'Appenzell RI', AR: 'Appenzell RE', BE: 'Berne', BL: 'Bâle-Campagne',
  BS: 'Bâle-Ville', FR: 'Fribourg', GE: 'Genève', GL: 'Glaris', GR: 'Grisons', JU: 'Jura',
  LU: 'Lucerne', NE: 'Neuchâtel', NW: 'Nidwald', OW: 'Obwald', SG: 'Saint-Gall',
  SH: 'Schaffhouse', SO: 'Soleure', SZ: 'Schwytz', TG: 'Thurgovie', TI: 'Tessin',
  UR: 'Uri', VD: 'Vaud', VS: 'Valais', ZG: 'Zoug', ZH: 'Zurich',
}

// ─── Contact row (icon + label/value stack) ─────────────────────────────
function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: 'agent-mail' | 'agent-phone' | 'location' | 'agent-briefcase'
  label: string
  value: string
  href?: string
}) {
  const valueEl = (
    <span style={{
      paddingTop: 2,
      fontFamily: PX.font.sans,
      fontWeight: 500,
      fontSize: 16,
      lineHeight: 1.25,
      letterSpacing: '-0.48px',
      color: PX.neutral700,
      wordBreak: 'break-word',
    }}>{value}</span>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        flexShrink: 0,
        marginTop: 4,
      }}>
        <PxFigmaIcon name={icon} size={16} color={PX.neutral500} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 14,
          lineHeight: 1.25,
          letterSpacing: '-0.42px',
          color: PX.neutral400,
        }}>{label}</span>
        {href ? (
          <a href={href} style={{ textDecoration: 'none' }}>{valueEl}</a>
        ) : valueEl}
      </div>
    </div>
  )
}

// ─── Copy URL pill (bottom of ProfileCard) ──────────────────────────────
function CopyIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke={PX.neutral700} strokeWidth="1.4" />
      <path d="M11 5V3.5C11 2.67 10.33 2 9.5 2H3.5C2.67 2 2 2.67 2 3.5V9.5C2 10.33 2.67 11 3.5 11H5" stroke={PX.neutral700} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function ShareUrlPill({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(`https://${url}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => { /* silently fail */ })
  }
  return (
    <div style={{
      width: '100%',
      minHeight: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      background: PX.neutral200,
      paddingLeft: 16,
      paddingRight: 6,
      paddingTop: 6,
      paddingBottom: 6,
      borderRadius: PX.radius.pill,
      boxSizing: 'border-box',
    }}>
      <span style={{
        paddingTop: 2,
        fontFamily: PX.font.sans,
        fontWeight: 400,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral400,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flex: 1,
        minWidth: 0,
      }}>{url}</span>
      <button
        type="button"
        aria-label="Copier le lien"
        onClick={copy}
        style={{
          width: 40,
          height: 40,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: PX.neutral100,
          borderRadius: PX.radius.pill,
          border: 0,
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: PX.shadow.small,
        }}
      >
        {copied ? <span style={{ fontFamily: PX.font.sans, fontSize: 12, fontWeight: 500, color: PX.neutral700 }}>✓</span> : <CopyIcon />}
      </button>
    </div>
  )
}

// Normalise une URL de logo : whitespace/empty/malformée → null
function normalizeLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (!/^(https?:|data:)/i.test(trimmed)) return null
  return trimmed
}

function safeInitials(name: string | null | undefined): string {
  if (!name) return ''
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── ProfileCard (left of hero) ─────────────────────────────────────────
function ProfileCard({ agency }: { agency: AgencyData }) {
  const initials = safeInitials(agency.name)
  const logoUrl = normalizeLogoUrl(agency.logo_url)
  const cantonLabel = agency.canton ? (CANTON_LABELS[agency.canton] || agency.canton) : null
  const handle = [agency.city, cantonLabel ? `(${agency.canton})` : null].filter(Boolean).join(' ')
  const founded = agency.founded_year
  const contactHref = agency.email ? `mailto:${agency.email}` : (agency.phone ? `tel:${agency.phone}` : '#')

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: 486,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
      flexShrink: 0,
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Decoration dark band — solid neutral700 (pas d'image, plus neutre pour une agence) */}
      <div style={{
        height: 140,
        background: PX.neutral700,
        backgroundImage: `radial-gradient(circle at 80% 30%, ${PX.neutral600} 0%, transparent 60%), radial-gradient(circle at 20% 90%, ${PX.neutral600} 0%, transparent 50%)`,
      }} />

      {/* Logo overlap (size 120, white background card, overlap -60) */}
      <div style={{
        marginLeft: 32,
        marginTop: -60,
        width: 120,
        height: 120,
        borderRadius: PX.radius.medium,
        background: PX.neutral100,
        border: `4px solid ${PX.neutral100}`,
        boxSizing: 'border-box',
        boxShadow: PX.shadow.small,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2,
      }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={agency.name || ''}
            decoding="async"
            referrerPolicy="no-referrer"
            style={{
              maxWidth: 88,
              maxHeight: 88,
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
            onError={e => {
              const img = e.currentTarget
              img.style.display = 'none'
              const sib = img.nextElementSibling as HTMLElement | null
              if (sib) sib.style.display = 'inline-flex'
            }}
          />
        ) : null}
        <span style={{
          display: logoUrl ? 'none' : 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: PX.font.sans,
          fontSize: 36,
          fontWeight: 500,
          color: PX.neutral500,
          letterSpacing: '-1.08px',
        }}>{initials || 'AG'}</span>
      </div>

      {/* Contact button — top right, overlap on band */}
      <a
        href={contactHref}
        style={{
          position: 'absolute',
          top: 86,
          right: 24,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: PX.neutral700,
          paddingLeft: 16,
          paddingRight: 6,
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: PX.radius.pill,
          textDecoration: 'none',
          zIndex: 3,
        }}
      >
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          whiteSpace: 'nowrap',
        }}>Contacter</span>
        <span style={{
          width: 28,
          height: 28,
          background: PX.neutral100,
          borderRadius: PX.radius.pill,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <PxFigmaIcon name="arrow-right" size={12} color={PX.neutral700} />
        </span>
      </a>

      {/* Content body — padding 32, gap 24 */}
      <div style={{
        padding: '20px 32px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {/* Name + verified badge inline + city */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 32,
              lineHeight: 1.15,
              letterSpacing: '-0.96px',
              color: PX.neutral700,
            }}>{agency.name}</h1>
            {agency.status === 'verified' && (
              <span title="Agence vérifiée" style={{
                display: 'inline-grid',
                placeItems: 'center',
                width: 22,
                height: 22,
                borderRadius: 999,
                background: PX.neutral700,
                color: PX.neutral100,
                fontFamily: PX.font.sans,
                fontSize: 12,
                fontWeight: 700,
              }}>✓</span>
            )}
          </div>
          {handle && (
            <span style={{
              paddingTop: 2,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
            }}>{handle}</span>
          )}
        </div>

        {/* Contact rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {agency.email && (
            <ContactRow icon="agent-mail" label="Email" value={agency.email} href={`mailto:${agency.email}`} />
          )}
          {agency.phone && (
            <ContactRow icon="agent-phone" label="Téléphone" value={agency.phone} href={`tel:${agency.phone}`} />
          )}
          {(agency.address || agency.city) && (
            <ContactRow
              icon="location"
              label="Adresse"
              value={[agency.address, agency.city, agency.canton ? `(${agency.canton})` : null].filter(Boolean).join(', ')}
            />
          )}
          {founded != null && (
            <ContactRow icon="agent-briefcase" label="Fondée" value={String(founded)} />
          )}
        </div>

        {/* Share URL pill */}
        <ShareUrlPill url={`megga.ch/agencies/${agency.slug}`} />
      </div>
    </div>
  )
}

// ─── RichText (right of hero) ───────────────────────────────────────────
function RichText({ agency }: { agency: AgencyData }) {
  const hasDescription = !!agency.description
  const hasSpecialties = agency.specialties && agency.specialties.length > 0
  const hasZones = agency.zones_covered && agency.zones_covered.length > 0
  const hasLanguages = agency.languages && agency.languages.length > 0

  return (
    <div style={{
      flex: 1,
      maxWidth: 657,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* À propos */}
      <h2 style={{
        margin: 0,
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 36,
        lineHeight: 1.25,
        letterSpacing: '-1.08px',
        color: PX.neutral700,
      }}>À propos de l’agence</h2>

      <p style={{
        margin: '24px 0 0 0',
        fontFamily: PX.font.sans,
        fontWeight: 400,
        fontSize: 16,
        lineHeight: 1.5,
        letterSpacing: '-0.48px',
        color: PX.neutral500,
      }}>
        {hasDescription
          ? agency.description
          : `${agency.name} est une agence immobilière active${agency.city ? ` à ${agency.city}` : ''}${agency.canton ? ` dans le canton de ${CANTON_LABELS[agency.canton] || agency.canton}` : ''}. ${agency.agent_count > 0 ? `L’équipe compte ${agency.agent_count} agent${agency.agent_count > 1 ? 's' : ''}` : ''}${agency.active_listings_count > 0 ? ` et propose actuellement ${agency.active_listings_count} bien${agency.active_listings_count > 1 ? 's' : ''} actif${agency.active_listings_count > 1 ? 's' : ''} sur le marché.` : '.'}`
        }
      </p>

      {/* Spécialités */}
      {hasSpecialties && (
        <>
          <h2 style={{
            margin: '64px 0 0 0',
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 36,
            lineHeight: 1.25,
            letterSpacing: '-1.08px',
            color: PX.neutral700,
          }}>Spécialités</h2>
          <ul style={{
            margin: '24px 0 0 0',
            paddingLeft: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            listStyle: 'none',
          }}>
            {agency.specialties.map((s, i) => (
              <li key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  background: PX.neutral500,
                  borderRadius: '50%',
                  flexShrink: 0,
                }} />
                {s}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Zones couvertes */}
      {hasZones && (
        <>
          <h2 style={{
            margin: '48px 0 0 0',
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 24,
            lineHeight: 1.25,
            letterSpacing: '-0.72px',
            color: PX.neutral700,
          }}>Zones couvertes</h2>
          <div style={{
            marginTop: 16,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            {agency.zones_covered.map((z, i) => (
              <span key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 14px',
                background: PX.neutral200,
                borderRadius: PX.radius.pill,
                fontFamily: PX.font.sans,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: '-0.42px',
                color: PX.neutral700,
              }}>{CANTON_LABELS[z] || z}</span>
            ))}
          </div>
        </>
      )}

      {/* Langues */}
      {hasLanguages && (
        <>
          <h2 style={{
            margin: '48px 0 0 0',
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 24,
            lineHeight: 1.25,
            letterSpacing: '-0.72px',
            color: PX.neutral700,
          }}>Langues parlées</h2>
          <div style={{
            marginTop: 16,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            {agency.languages.map((l, i) => (
              <span key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 14px',
                background: PX.neutral200,
                borderRadius: PX.radius.pill,
                fontFamily: PX.font.sans,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: '-0.42px',
                color: PX.neutral700,
              }}>{l.toUpperCase()}</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Property card (dark section) — pattern PxAgentProfile PropertyCardV2 ─
function PropertyCardDark({ listing }: { listing: ListingMini }) {
  const isRent = listing.transaction_type === 'rent'
  const price = listing.current_price ?? listing.price
  const priceLabel = isRent ? formatRent(price) : formatCHF(price)
  const image = listing.photos?.[0]
  const address = [listing.address, listing.city].filter(Boolean).join(', ') || listing.canton || ''
  const surface = listing.surface_m2 ? `${listing.surface_m2} m²` : '—'

  return (
    <Link
      to={`/propriete/${listing.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        flexShrink: 0,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      {/* Card image */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 320,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        background: PX.neutral500,
        backgroundImage: image ? `url("${image}")` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 24,
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: PX.neutral700,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: PX.radius.pill,
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              transform: isRent ? 'rotate(-45deg)' : 'none',
            }}>
              <PxFigmaIcon name={isRent ? 'key' : 'tag'} size={16} color={PX.neutral100} />
            </span>
            <span style={{
              paddingTop: 2,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 14,
              lineHeight: 1.25,
              letterSpacing: '-0.42px',
              color: PX.neutral100,
              whiteSpace: 'nowrap',
            }}>{isRent ? 'À louer' : 'À vendre'}</span>
          </span>
        </div>
      </div>

      {/* Bottom content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 22,
          lineHeight: 1.25,
          letterSpacing: '-0.66px',
          color: PX.neutral100,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{listing.title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PxFigmaIcon name="location" size={18} color={PX.neutral400} />
          <span style={{
            paddingTop: 4,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 14,
            lineHeight: 1.25,
            letterSpacing: '-0.42px',
            color: PX.neutral400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{address}</span>
        </div>
      </div>

      <div style={{ width: '100%', height: 1, background: PX.borderInverse }} />

      {/* Amenities + price */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <PxFigmaIcon name="surface" size={18} color={PX.neutral100} />
            <span style={{
              paddingTop: 2,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 14,
              lineHeight: 1.25,
              letterSpacing: '-0.42px',
              color: PX.neutral100,
            }}>{surface}</span>
          </span>
          {listing.rooms != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <PxFigmaIcon name="bed" size={18} color={PX.neutral100} />
              <span style={{
                paddingTop: 2,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 14,
                lineHeight: 1.25,
                letterSpacing: '-0.42px',
                color: PX.neutral100,
              }}>{listing.rooms}</span>
            </span>
          )}
        </div>
        <span style={{
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          whiteSpace: 'nowrap',
        }}>{priceLabel}</span>
      </div>
    </Link>
  )
}

// ─── Properties section (dark) ──────────────────────────────────────────
function PropertiesSection({
  agencyName,
  listings,
}: {
  agencyName: string
  listings: ListingMini[]
}) {
  if (listings.length === 0) return null
  return (
    <section style={{
      width: '100%',
      background: PX.surfaceBg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{
        width: 'min(1392px, calc(100% - 48px))',
        background: PX.neutral700,
        borderRadius: PX.radius.large,
        paddingTop: 96,
        paddingBottom: 96,
        paddingLeft: 'clamp(24px, 5vw, 96px)',
        paddingRight: 'clamp(24px, 5vw, 96px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 48,
        boxSizing: 'border-box',
      }}>
        {/* Eyebrow + title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 6,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            background: PX.neutral600,
            borderRadius: PX.radius.pill,
            alignSelf: 'flex-start',
          }}>
            <span style={{
              width: 26, height: 26,
              borderRadius: PX.radius.pill,
              background: PX.neutral500,
              display: 'grid', placeItems: 'center',
              flexShrink: 0,
            }}>
              <PxFigmaIcon name="badge-allprops-home" size={14.857} color={PX.neutral100} />
            </span>
            <span style={{
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral100,
            }}>Biens actifs</span>
          </span>
          <h2 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 'clamp(32px, 5vw, 48px)',
            lineHeight: 1.15,
            letterSpacing: '-1.44px',
            color: PX.neutral100,
          }}>Les biens de {agencyName}</h2>
        </div>

        {/* Grid 2-col (responsive : 1-col en dessous de 720) */}
        <div style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))',
          gap: 48,
        }}>
          {listings.slice(0, 6).map(l => <PropertyCardDark key={l.id} listing={l} />)}
        </div>
      </div>
    </section>
  )
}

// ─── Team section (light) ───────────────────────────────────────────────
function AgentCardPx({ agent }: { agent: AgentMini }) {
  const fullName = [agent.first_name, agent.last_name].filter(Boolean).join(' ')
  const initials = [agent.first_name?.[0], agent.last_name?.[0]].filter(Boolean).join('').toUpperCase()
  const specialty = agent.specialties?.[0] || ''
  return (
    <Link
      to={agent.slug ? `/agents/${agent.slug}` : '#'}
      className="px-team-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 24,
        background: PX.neutral100,
        borderRadius: PX.radius.large,
        boxShadow: PX.shadow.small,
        textDecoration: 'none',
        color: 'inherit',
        transition: `transform ${PX.duration.base} ${PX.ease}, box-shadow ${PX.duration.base} ${PX.ease}`,
      }}
    >
      {/* Photo */}
      <div style={{
        width: '100%',
        aspectRatio: '1 / 1',
        borderRadius: PX.radius.medium,
        overflow: 'hidden',
        background: PX.neutral200,
        display: 'grid',
        placeItems: 'center',
      }}>
        {agent.photo_url ? (
          <img
            src={agent.photo_url}
            alt={fullName}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{
            fontFamily: PX.font.sans,
            fontSize: 36,
            fontWeight: 500,
            color: PX.neutral500,
            letterSpacing: '-1.08px',
          }}>{initials || 'AG'}</span>
        )}
      </div>

      {/* Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 20,
          lineHeight: 1.25,
          letterSpacing: '-0.6px',
          color: PX.neutral700,
        }}>{fullName || '—'}</h3>
        {specialty && (
          <span style={{
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 14,
            lineHeight: 1.5,
            letterSpacing: '-0.42px',
            color: PX.neutral500,
          }}>{specialty}</span>
        )}
      </div>
    </Link>
  )
}

function TeamSection({ agencyName, agents }: { agencyName: string; agents: AgentMini[] }) {
  if (agents.length === 0) return null
  return (
    <section style={{
      width: '100%',
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 96,
      paddingBottom: 160,
      paddingLeft: 24,
      paddingRight: 24,
      boxSizing: 'border-box',
    }}>
      <style>{`
        .px-team-card:hover {
          box-shadow: ${PX.shadow.medium};
          transform: translateY(-2px);
        }
      `}</style>
      <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 6,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            background: PX.neutral200,
            borderRadius: PX.radius.pill,
          }}>
            <span style={{
              width: 26, height: 26,
              borderRadius: PX.radius.pill,
              background: PX.neutral400,
              display: 'grid', placeItems: 'center',
              flexShrink: 0,
            }}>
              <PxFigmaIcon name="badge-about-user" size={14.857} color={PX.neutral100} />
            </span>
            <span style={{
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
            }}>L’équipe</span>
          </span>
          <h2 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 'clamp(32px, 5vw, 48px)',
            lineHeight: 1.15,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
          }}>Les agents de {agencyName}</h2>
        </div>

        <div style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          gap: 24,
        }}>
          {agents.slice(0, 12).map(a => <AgentCardPx key={a.id} agent={a} />)}
        </div>
      </div>
    </section>
  )
}

// ─── Main composition ──────────────────────────────────────────────────
export default function PxAgencyProfile({ agency, agents, listings }: PxAgencyProfileProps) {
  return (
    <>
      <style>{`
        .px-agency-hero {
          width: 100%;
          background: ${PX.surfaceBg};
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 64px 24px 96px;
          box-sizing: border-box;
        }
        .px-agency-hero__inner {
          width: 100%;
          max-width: 1200px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 57px;
        }
        @media (max-width: 960px) {
          .px-agency-hero__inner {
            flex-direction: column;
            align-items: center;
            gap: 48px;
          }
        }
        @media (max-width: 640px) {
          .px-agency-hero { padding: 32px 16px 64px !important; }
          .px-agency-hero__inner { gap: 32px !important; }
        }
      `}</style>

      {/* ============== HERO SECTION ============== */}
      <section className="px-agency-hero">
        <div className="px-agency-hero__inner">
          <ProfileCard agency={agency} />
          <RichText agency={agency} />
        </div>
      </section>

      {/* ============== PROPERTIES SECTION ============== */}
      <PropertiesSection agencyName={agency.name} listings={listings} />

      {/* ============== TEAM SECTION ============== */}
      <TeamSection agencyName={agency.name} agents={agents} />
    </>
  )
}
