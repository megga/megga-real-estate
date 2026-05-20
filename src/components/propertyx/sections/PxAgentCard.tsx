// MEGGA Marketplace — Property X agent profile card (compact).
// Source : Figma node 9552:21460 — sous-frame "Profile Card" (486×692).
//
// Carte agent autonome, props-driven. Utilisée :
//   - dans PxAgentProfile.tsx (page /agent/example)
//   - peut être plug&play dans n'importe quelle page (annuaire, listing, etc.)
//
// Composition fidèle Figma :
//   - Decoration dark band haut (140.5px, image ou gradient)
//   - Bouton "Contact me" top-right pill noir (sit sur la band)
//   - Avatar 100×100 (overlap sur la band, border 4 blanc)
//   - Name + @handle
//   - 4 ContactRow : email, phone, location, position
//   - URL pill bas + copy button

import { PX, PxFigmaIcon } from '..'

interface PxAgentCardProps {
  name: string
  handle: string                   // sans le @, ex: "johncarter"
  email: string
  phone: string
  location: string
  position: string
  shareUrl: string                 // ex: "property.com/@johncarter"
  avatarSrc?: string               // si undefined → cercle gris vide
  decorationSrc?: string           // image dark band haut (sinon gradient noir)
  onContact?: () => void
  onCopyUrl?: () => void
}

export default function PxAgentCard({
  name,
  handle,
  email,
  phone,
  location,
  position,
  shareUrl,
  avatarSrc,
  decorationSrc,
  onContact,
  onCopyUrl,
}: PxAgentCardProps) {
  function handleCopy() {
    if (onCopyUrl) {
      onCopyUrl()
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl)
    }
  }

  return (
    <div style={{
      position: 'relative',
      width: 486,
      height: 692,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* ─── Decoration dark band haut ─────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 486,
        height: 140.5,
        overflow: 'hidden',
        background: decorationSrc
          ? undefined
          : 'linear-gradient(135deg, #14161C 0%, #2B2E37 60%, #5A5E6A 100%)',
      }}>
        {decorationSrc && (
          <img
            src={decorationSrc}
            alt=""
            aria-hidden="true"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}
      </div>

      {/* ─── Bouton "Contact me" — top right, sit sur la band ──────── */}
      <button
        type="button"
        onClick={onContact}
        style={{
          position: 'absolute',
          top: 161,
          left: 297,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: PX.neutral700,
          paddingLeft: 16,
          paddingRight: 6,
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: PX.radius.pill,
          border: 0,
          cursor: 'pointer',
          fontFamily: PX.font.sans,
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
        }}>
          Contact me
        </span>
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
      </button>

      {/* ─── Avatar 100×100 — overlap sur la decoration ────────────── */}
      <div style={{
        position: 'absolute',
        top: 100,
        left: 41,
        width: 100,
        height: 100,
        borderRadius: '50%',
        overflow: 'hidden',
        background: PX.neutral300,
        border: `4px solid ${PX.neutral100}`,
        boxSizing: 'content-box',
        marginLeft: -4,
        marginTop: -4,
      }}>
        {avatarSrc && (
          <img
            src={avatarSrc}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>

      {/* ─── Name + handle ─────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 216,
        left: 41,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
      }}>
        <h2 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 36,
          lineHeight: 1.25,
          letterSpacing: '-1.08px',
          color: PX.neutral700,
        }}>
          {name}
        </h2>
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>
          @{handle}
        </span>
      </div>

      {/* ─── Contact wrapper — 4 info rows (gap 20) ────────────────── */}
      <div style={{
        position: 'absolute',
        top: 298,
        left: 41,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <ContactRow icon="agent-mail" label="Email address" value={email} />
        <ContactRow icon="agent-phone" label="Phone number" value={phone} />
        <ContactRow icon="location" label="Location" value={location} />
        <ContactRow icon="agent-briefcase" label="Position" value={position} />
      </div>

      {/* ─── URL pill bas + copy button ────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: 594,
        left: 43,
        width: 403,
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
        }}>
          {shareUrl}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy link"
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
          <CopyIcon />
        </button>
      </div>
    </div>
  )
}

// ─── Sous-composants internes ───────────────────────────────────────────

type ContactIcon = 'agent-mail' | 'agent-phone' | 'location' | 'agent-briefcase'

function ContactRow({ icon, label, value }: { icon: ContactIcon; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        flexShrink: 0,
        marginTop: 2,
      }}>
        <PxFigmaIcon name={icon} size={16} color={PX.neutral500} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 14,
          lineHeight: 1.25,
          letterSpacing: '-0.42px',
          color: PX.neutral400,
        }}>
          {label}
        </span>
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral700,
        }}>
          {value}
        </span>
      </div>
    </div>
  )
}

function CopyIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke={PX.neutral700} strokeWidth="1.4" />
      <path
        d="M11 5V3.5C11 2.67 10.33 2 9.5 2H3.5C2.67 2 2 2.67 2 3.5V9.5C2 10.33 2.67 11 3.5 11H5"
        stroke={PX.neutral700}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
