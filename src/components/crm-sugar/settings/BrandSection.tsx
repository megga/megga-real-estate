// MEGGA CRM Sugar v2 — Settings Brand & Présentation section (Tier 3.k)
// 1:1 port from `crm-screen-settings-step5.jsx` (SettingsBrandSection + helpers).
// Skip: PublicPagePreview (marked legacy/unused dans le proto, eslint-disable).

import { useState, type ReactNode } from 'react'
import {
  SectionHeader,
  SetCard,
  SetGhostBtn,
  SetIcon,
  StickySaveBar,
  Toast,
  ToggleRow,
} from './atoms'
import { SET_PALETTE, type SettingsIconName } from './data'

const SET = SET_PALETTE

// ─── Local icons spécifiques à cette section ──────────────────────────────
type BrandIconName = 'upload' | 'image' | 'type' | 'globe' | 'eye' | 'external' | 'copy' | 'qr' | 'sparkle'

const BRAND_PATHS: Record<BrandIconName, ReactNode> = {
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8 12 3 7 8" />
      <path d="M12 3v12" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  type: (
    <>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  external: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
    </>
  ),
  sparkle: (
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  ),
}

interface BrandIconProps {
  name: BrandIconName
  size?: number
  stroke?: string
  sw?: number
}

function BrandIcon({ name, size = 18, stroke = 'currentColor', sw = 1.6 }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {BRAND_PATHS[name] || null}
    </svg>
  )
}

// ─── Données par défaut ──────────────────────────────────────────────────
const ACCENT_PRESETS = [
  { id: 'graphite', label: 'Graphite', hex: '#0B0C0E' },
  { id: 'indigo', label: 'Indigo', hex: '#1E2A78' },
  { id: 'emerald', label: 'Émeraude', hex: '#0F766E' },
  { id: 'burgundy', label: 'Bordeaux', hex: '#7F1D2F' },
  { id: 'rust', label: 'Terracotta', hex: '#9C4B2E' },
  { id: 'stone', label: 'Pierre', hex: '#6B7280' },
]

interface Gabarit {
  id: 'minimal' | 'editorial' | 'boutique'
  label: string
  desc: string
  bgHead: string
  accent: string
}

const TEMPLATE_GABARITS: Gabarit[] = [
  { id: 'minimal', label: 'Minimal', desc: 'Beaucoup de blanc, type sérif élégant', bgHead: '#F4F2EC', accent: '#0B0C0E' },
  { id: 'editorial', label: 'Éditorial', desc: 'Photo pleine largeur, texte sur image', bgHead: '#1F2937', accent: '#FFFFFF' },
  { id: 'boutique', label: 'Boutique', desc: 'Mise en page magazine, accents dorés', bgHead: '#FAF7EE', accent: '#9C7B3F' },
]

const FONT_PAIRS = [
  { id: 'inter', headline: 'Söhne', body: 'Inter', sample: 'Söhne / Inter' },
  { id: 'fraunces', headline: 'Fraunces', body: 'Söhne', sample: 'Fraunces / Söhne' },
  { id: 'ibm', headline: 'IBM Plex Sans', body: 'IBM Plex Serif', sample: 'IBM Plex Sans / Serif' },
  { id: 'system', headline: 'System UI', body: 'System UI', sample: 'System UI' },
]

interface BrandSocials {
  linkedin: string
  instagram: string
  website: string
}

interface BrandData {
  legalName: string
  tradeName: string
  tagline: string
  accent: string
  accentCustom: string
  fontPair: string
  logoVariant: 'monogram' | 'wordmark' | 'combo'
  sigPhone: string
  sigMobile: string
  sigShowQR: boolean
  sigShowSocial: boolean
  sigShowDisclaimer: boolean
  sigDisclaimer: string
  emailDomain: string
  domainStatus: 'pending' | 'verified' | 'error'
  docTemplate: string
  docColor: string
  docFooter: string
  docCoverPhoto: boolean
  agentCardShow: boolean
  agentCardPhoto: boolean
  agentCardBio: string
  agentCardLanguages: string[]
  agentCardSpecialities: string[]
  isAdmin: boolean
  agencySlug: string
  agencyPageActive: boolean
  agencyShowAgents: boolean
  agencyShowListings: boolean
  agencyIntegration: 'redirect' | 'native'
  agencyExternalUrl: string
  socials: BrandSocials
}

const DEFAULT_BRAND: BrandData = {
  legalName: 'MEGGA College SA',
  tradeName: 'MEGGA College',
  tagline: "L'immobilier suisse, sans intermédiaire pour ce qui compte.",
  accent: 'graphite',
  accentCustom: '#0B0C0E',
  fontPair: 'inter',
  logoVariant: 'monogram',
  sigPhone: '+41 22 123 45 67',
  sigMobile: '+41 79 555 12 34',
  sigShowQR: false,
  sigShowSocial: true,
  sigShowDisclaimer: true,
  sigDisclaimer:
    'Membre du registre cantonal genevois des intermédiaires immobiliers (Réf. RIG-2024-0341).',
  emailDomain: 'meggacollege.ch',
  domainStatus: 'verified',
  docTemplate: 'minimal',
  docColor: '#0B0C0E',
  docFooter:
    'MEGGA College SA · 12 rue du Mont-Blanc, 1201 Genève · +41 22 123 45 67 · meggacollege.ch',
  docCoverPhoto: true,
  agentCardShow: true,
  agentCardPhoto: true,
  agentCardBio:
    'Spécialisée en propriétés du Léman supérieur depuis 12 ans. Approche posée, transactions discrètes, regard architectural.',
  agentCardLanguages: ['fr', 'en', 'de'],
  agentCardSpecialities: ['Vente résidentielle', 'Patrimoine luxe'],
  isAdmin: true,
  agencySlug: 'regis-aebischer',
  agencyPageActive: true,
  agencyShowAgents: true,
  agencyShowListings: true,
  agencyIntegration: 'redirect',
  agencyExternalUrl: 'https://www.aebischer-cie.ch',
  socials: {
    linkedin: 'linkedin.com/in/diane-weiss',
    instagram: '@diane.weiss.megga',
    website: 'meggacollege.ch/agents/diane-weiss',
  },
}

// ─── TextField (différent de SetInput — avec copyable + icon + prefix/suffix props proto-spécifiques) ─
interface TextFieldProps {
  label?: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  icon?: ReactNode
  mono?: boolean
  hint?: string
  prefix?: string
  suffix?: string
  copyable?: boolean
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  mono,
  hint,
  prefix,
  suffix,
  copyable,
}: TextFieldProps) {
  const [copied, setCopied] = useState(false)
  return (
    <label style={{ display: 'block' }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SET.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 48,
          padding: '0 4px 0 16px',
          borderRadius: 14,
          background: SET.cardSubtle,
          boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
        }}
      >
        {icon}
        {prefix && (
          <span
            style={{
              color: SET.muted,
              fontSize: 14,
              fontWeight: 500,
              marginRight: 4,
            }}
          >
            {prefix}
          </span>
        )}
        <input
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            height: '100%',
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontFamily: mono
              ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
              : 'inherit',
            fontSize: mono ? 13.5 : 14.5,
            fontWeight: 600,
            color: SET.ink,
            minWidth: 0,
          }}
        />
        {suffix && (
          <span
            style={{
              color: SET.muted,
              fontSize: 13,
              fontWeight: 500,
              marginRight: 12,
            }}
          >
            {suffix}
          </span>
        )}
        {copyable && (
          <button
            onClick={() => {
              navigator.clipboard?.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
            style={{
              height: 36,
              padding: '0 12px',
              border: 0,
              borderRadius: 10,
              background: copied ? SET.ok : 'transparent',
              color: copied ? '#fff' : SET.inkSoft,
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginRight: 4,
              transition: 'all .15s',
            }}
          >
            {copied ? (
              <>
                <SetIcon name="check" size={12} stroke="#fff" sw={2.6} />
                Copié
              </>
            ) : (
              <>
                <BrandIcon name="copy" size={12} stroke={SET.inkSoft} />
                Copier
              </>
            )}
          </button>
        )}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 12,
            color: SET.muted,
            fontWeight: 500,
            marginTop: 8,
            lineHeight: 1.45,
          }}
        >
          {hint}
        </div>
      )}
    </label>
  )
}

// ─── Textarea (différent de SetTextarea — avec max counter inline) ────────
interface TextareaProps {
  label?: string
  value: string
  onChange: (v: string) => void
  rows?: number
  hint?: string
  max?: number
}

function Textarea({ label, value, onChange, rows = 3, hint, max }: TextareaProps) {
  return (
    <label style={{ display: 'block' }}>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SET.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
          {max && (
            <div
              style={{
                fontSize: 11,
                color: (value || '').length > max ? SET.warn : SET.muted,
                fontWeight: 600,
              }}
            >
              {(value || '').length}/{max}
            </div>
          )}
        </div>
      )}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: 14,
          border: 0,
          outline: 'none',
          background: SET.cardSubtle,
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 500,
          color: SET.ink,
          lineHeight: 1.55,
          boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          resize: 'vertical',
        }}
      />
      {hint && (
        <div
          style={{
            fontSize: 12,
            color: SET.muted,
            fontWeight: 500,
            marginTop: 6,
            lineHeight: 1.45,
          }}
        >
          {hint}
        </div>
      )}
    </label>
  )
}

// ─── DomainBadge ─────────────────────────────────────────────────────────
interface DomainBadgeProps {
  status: 'verified' | 'pending' | 'error'
}

function DomainBadge({ status }: DomainBadgeProps) {
  const map: Record<DomainBadgeProps['status'], { label: string; bg: string; color: string; icon: SettingsIconName }> = {
    verified: { label: 'Vérifié', bg: `${SET.ok}18`, color: SET.ok, icon: 'check' },
    pending: { label: 'En attente', bg: `${SET.warn}18`, color: SET.warn, icon: 'info' },
    error: { label: 'Erreur DNS', bg: `${SET.bad}18`, color: SET.bad, icon: 'x' },
  }
  const s = map[status] || map.verified
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        background: s.bg,
        color: s.color,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.1,
      }}
    >
      <SetIcon name={s.icon} size={12} stroke={s.color} sw={3} />
      {s.label}
    </span>
  )
}

// ─── Logo Mark ───────────────────────────────────────────────────────────
interface LogoMarkProps {
  variant: 'monogram' | 'wordmark' | 'combo'
  accent: string
  tradeName: string
  size?: 'sm' | 'md' | 'lg'
}

function LogoMark({ variant, accent, tradeName, size = 'md' }: LogoMarkProps) {
  const dim = size === 'lg' ? 64 : size === 'md' ? 36 : 22
  const fontSize = size === 'lg' ? 26 : size === 'md' ? 16 : 11

  const Mark = (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: dim * 0.22,
        background: accent,
        display: 'grid',
        placeItems: 'center',
        boxShadow: `0 6px 18px ${accent}38`,
      }}
    >
      <svg width={dim * 0.55} height={dim * 0.55} viewBox="0 0 24 24" fill="none">
        <path
          d="M3 20V4L9 12 12 8 15 12 21 4V20"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )

  if (variant === 'monogram') return Mark
  if (variant === 'wordmark')
    return (
      <div
        style={{
          fontSize,
          fontWeight: 700,
          color: accent,
          letterSpacing: -0.6,
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        {tradeName}
      </div>
    )
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: dim * 0.32,
      }}
    >
      {Mark}
      <div
        style={{
          fontSize,
          fontWeight: 700,
          color: accent,
          letterSpacing: -0.6,
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        {tradeName}
      </div>
    </div>
  )
}

// ─── Logo Uploader ───────────────────────────────────────────────────────
interface LogoUploaderProps {
  variant: BrandData['logoVariant']
  onVariantChange: (v: BrandData['logoVariant']) => void
  accent: string
  tradeName: string
}

function LogoUploader({ variant, onVariantChange, accent, tradeName }: LogoUploaderProps) {
  const variants: { id: BrandData['logoVariant']; label: string }[] = [
    { id: 'monogram', label: 'Monogramme' },
    { id: 'wordmark', label: 'Texte' },
    { id: 'combo', label: 'Combiné' },
  ]
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: SET.muted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Logo
      </div>
      <div
        style={{
          height: 200,
          borderRadius: 18,
          background: SET.cardSubtle,
          boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          position: 'relative',
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <LogoMark variant={variant} accent={accent} tradeName={tradeName} size="lg" />
        <button
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            height: 32,
            padding: '0 12px',
            border: 0,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.95)',
            color: SET.ink,
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(11,12,14,0.10)',
          }}
        >
          <BrandIcon name="upload" size={12} stroke={SET.ink} />
          Remplacer
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          marginTop: 10,
        }}
      >
        {variants.map(v => {
          const active = variant === v.id
          return (
            <button
              key={v.id}
              onClick={() => onVariantChange(v.id)}
              style={{
                height: 36,
                border: 0,
                borderRadius: 10,
                background: active ? SET.black : SET.cardSubtle,
                color: active ? '#fff' : SET.inkSoft,
                fontFamily: 'inherit',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: 0.1,
                transition: 'all .15s',
              }}
            >
              {v.label}
            </button>
          )
        })}
      </div>
      <div
        style={{
          marginTop: 10,
          padding: '10px 12px',
          borderRadius: 12,
          background: `${SET.ok}10`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11.5,
          color: SET.inkSoft,
          fontWeight: 500,
        }}
      >
        <SetIcon name="info" size={13} stroke={SET.muted} />
        SVG · 64 KB · Mis à jour il y a 18 jours
      </div>
    </div>
  )
}

// ─── FakeQR ──────────────────────────────────────────────────────────────
function FakeQR({ size = 56, color = '#0B0C0E' }: { size?: number; color?: string }) {
  const cells = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ]
  const inner = [
    [0, 1, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1, 1, 1],
    [0, 1, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 0, 1, 0],
    [0, 1, 0, 1, 1, 0, 1],
    [1, 1, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 1, 1],
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 21 21">
      {cells.map((row, y) =>
        row.map((c, x) =>
          c ? (
            <rect key={`tl-${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />
          ) : null,
        ),
      )}
      {cells.map((row, y) =>
        row.map((c, x) =>
          c ? (
            <rect
              key={`tr-${x}-${y}`}
              x={x + 14}
              y={y}
              width={1}
              height={1}
              fill={color}
            />
          ) : null,
        ),
      )}
      {cells.map((row, y) =>
        row.map((c, x) =>
          c ? (
            <rect
              key={`bl-${x}-${y}`}
              x={x}
              y={y + 14}
              width={1}
              height={1}
              fill={color}
            />
          ) : null,
        ),
      )}
      {inner.map((row, y) =>
        row.map((c, x) =>
          c ? (
            <rect
              key={`m-${x}-${y}`}
              x={x + 7}
              y={y + 7}
              width={1}
              height={1}
              fill={color}
            />
          ) : null,
        ),
      )}
    </svg>
  )
}

// ─── SignaturePreview ────────────────────────────────────────────────────
interface SignaturePreviewProps {
  data: BrandData
  accentHex: string
}

function SignaturePreview({ data, accentHex }: SignaturePreviewProps) {
  return (
    <div
      style={{
        background: SET.card,
        borderRadius: 18,
        padding: 6,
        boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
        position: 'sticky',
        top: 24,
      }}
    >
      <div style={{ background: SET.cardSubtle, borderRadius: 14, overflow: 'hidden' }}>
        <div
          style={{
            padding: '10px 14px',
            borderBottom: `1px solid ${SET.line}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: '#FF5F57' }} />
            <span style={{ width: 9, height: 9, borderRadius: 999, background: '#FEBC2E' }} />
            <span style={{ width: 9, height: 9, borderRadius: 999, background: '#28C840' }} />
          </div>
          <div
            style={{
              fontSize: 11,
              color: SET.muted,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            Aperçu signature — Mail.app
          </div>
        </div>
        <div style={{ padding: '20px 22px 8px', background: '#fff' }}>
          <div
            style={{
              fontSize: 13,
              color: SET.inkSoft,
              fontWeight: 500,
              lineHeight: 1.6,
            }}
          >
            Bonjour Madame Reverdin,
          </div>
          <div
            style={{
              fontSize: 13,
              color: SET.inkSoft,
              fontWeight: 500,
              lineHeight: 1.6,
              marginTop: 6,
            }}
          >
            Comme convenu, je vous transmets le dossier complet pour la propriété de Cologny.
            Je reste à votre disposition.
          </div>
          <div
            style={{
              fontSize: 13,
              color: SET.inkSoft,
              fontWeight: 500,
              lineHeight: 1.6,
              marginTop: 6,
            }}
          >
            Bien cordialement,
          </div>
        </div>
        <div
          style={{
            padding: '16px 22px 22px',
            background: '#fff',
            borderTop: `1px solid ${SET.line}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#0B0C0E',
                  letterSpacing: -0.2,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}
              >
                Diane Weiss
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#556070',
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                Conseillère senior · {data.tradeName}
              </div>
              <div
                style={{
                  height: 1,
                  width: 32,
                  background: accentHex,
                  margin: '10px 0',
                }}
              />
              <div
                style={{
                  fontSize: 11.5,
                  color: '#374151',
                  fontWeight: 500,
                  lineHeight: 1.7,
                }}
              >
                <div>
                  {data.sigPhone} · <span style={{ color: '#6B7280' }}>direct</span>
                </div>
                <div>
                  {data.sigMobile} · <span style={{ color: '#6B7280' }}>mobile</span>
                </div>
                <div
                  style={{
                    color: accentHex,
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  diane.weiss@{data.emailDomain}
                </div>
              </div>
              {data.sigShowSocial && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginTop: 12,
                    fontSize: 11,
                    color: '#6B7280',
                    fontWeight: 600,
                  }}
                >
                  <span>LinkedIn</span>
                  <span style={{ color: '#D1D5DB' }}>·</span>
                  <span>Instagram</span>
                  <span style={{ color: '#D1D5DB' }}>·</span>
                  <span>{data.tradeName.toLowerCase().replace(/\s/g, '')}.ch</span>
                </div>
              )}
            </div>
            {data.sigShowQR && (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  background: '#fff',
                  padding: 4,
                  boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.10)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <FakeQR size={56} color="#0B0C0E" />
              </div>
            )}
            <LogoMark
              variant="monogram"
              accent={accentHex}
              tradeName={data.tradeName}
              size="md"
            />
          </div>
          {data.sigShowDisclaimer && (
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: `1px solid ${SET.line}`,
                fontSize: 10,
                color: '#9CA3AF',
                fontWeight: 500,
                lineHeight: 1.55,
                fontStyle: 'italic',
              }}
            >
              {data.sigDisclaimer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── DocPreview ──────────────────────────────────────────────────────────
interface DocPreviewProps {
  gabarit: Gabarit
  accent: string
  tradeName: string
}

function DocPreview({ gabarit, accent: _accent, tradeName }: DocPreviewProps) {
  if (gabarit.id === 'minimal') {
    return (
      <div
        style={{
          height: 220,
          background: gabarit.bgHead,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          position: 'relative',
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: gabarit.accent,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            fontFamily: 'inherit',
          }}
        >
          Mandat exclusif de vente
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 400,
            color: gabarit.accent,
            letterSpacing: -0.6,
            lineHeight: 1.1,
            marginTop: 24,
          }}
        >
          Propriété de caractère
          <br />
          Cologny — Genève
        </div>
        <div
          style={{
            position: 'absolute',
            left: 22,
            right: 22,
            bottom: 18,
            height: 1,
            background: `${gabarit.accent}30`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 22,
            bottom: 8,
            fontSize: 10,
            color: gabarit.accent,
            opacity: 0.7,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 500,
          }}
        >
          {tradeName}
        </div>
        <div
          style={{
            position: 'absolute',
            right: 22,
            bottom: 8,
            fontSize: 10,
            color: gabarit.accent,
            opacity: 0.7,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 500,
          }}
        >
          01 / 12
        </div>
      </div>
    )
  }
  if (gabarit.id === 'editorial') {
    return (
      <div
        style={{
          height: 220,
          background:
            'linear-gradient(135deg, #1F2937 0%, #374151 60%, #6B7280 100%)',
          padding: '20px 22px',
          position: 'relative',
          overflow: 'hidden',
          color: '#fff',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(circle at 20% 40%, rgba(0,0,0,0.4), transparent 50%)',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: '#fff',
              display: 'grid',
              placeItems: 'center',
              color: '#0B0C0E',
              fontSize: 14,
              fontWeight: 800,
              fontFamily: 'Georgia, serif',
            }}
          >
            M
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 22,
            right: 22,
            bottom: 18,
            color: '#fff',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              opacity: 0.85,
            }}
          >
            Dossier de visite
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 400,
              marginTop: 4,
              fontFamily: "Georgia, 'Times New Roman', serif",
              letterSpacing: -0.5,
              lineHeight: 1.1,
            }}
          >
            Villa contemporaine
            <br />
            Vue sur le lac
          </div>
        </div>
      </div>
    )
  }
  // boutique
  return (
    <div
      style={{
        height: 220,
        background: gabarit.bgHead,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 140,
          height: 140,
          borderRadius: 999,
          background: `${gabarit.accent}14`,
        }}
      />
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: gabarit.accent,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
        }}
      >
        Brochure premium
      </div>
      <div
        style={{
          marginTop: 20,
          fontSize: 24,
          fontWeight: 400,
          color: '#0B0C0E',
          fontFamily: "Georgia, 'Times New Roman', serif",
          letterSpacing: -0.6,
          lineHeight: 1.05,
        }}
      >
        Le dernier
        <br />
        <em style={{ color: gabarit.accent }}>refuge alpin</em>
      </div>
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{ width: 30, height: 1, background: gabarit.accent }}
        />
        <div
          style={{
            fontSize: 10,
            color: gabarit.accent,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {tradeName}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION — MARQUE & PRÉSENTATION
// ═══════════════════════════════════════════════════════════════════════
const DNS_RECORDS: { type: string; name: string; val: string }[] = [
  { type: 'TXT', name: '@', val: 'v=spf1 include:_spf.megga.ch ~all' },
  { type: 'TXT', name: '_dmarc', val: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@...' },
  { type: 'CNAME', name: 'megga._domainkey', val: 'megga.dkim.megga.ch' },
  { type: 'MX', name: '@', val: '10 mx.megga.ch' },
]

export function BrandSection() {
  const [data, setData] = useState<BrandData>(DEFAULT_BRAND)
  const [saved, setSaved] = useState<BrandData>(DEFAULT_BRAND)
  const dirty = JSON.stringify(data) !== JSON.stringify(saved)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [domainCheckOpen, setDomainCheckOpen] = useState(false)

  const set = <K extends keyof BrandData>(key: K, value: BrandData[K]) =>
    setData(d => ({ ...d, [key]: value }))
  const setSocial = <K extends keyof BrandSocials>(key: K, value: BrandSocials[K]) =>
    setData(d => ({ ...d, socials: { ...d.socials, [key]: value } }))

  const accentHex =
    data.accent === 'custom'
      ? data.accentCustom
      : ACCENT_PRESETS.find(p => p.id === data.accent)?.hex || '#0B0C0E'

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaved(data)
      setSaving(false)
      setToast(true)
      setTimeout(() => setToast(false), 2400)
    }, 750)
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: dirty ? 96 : 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker="Marque & présentation"
          title="Comment vos clients vous voient"
          sub="Tout ce qui apparaît dans vos emails, brochures, page publique et documents officiels. Une cohérence visuelle, pour vous démarquer auprès des vendeurs comme des acheteurs."
        />

        {/* ───────── Identité visuelle ───────── */}
        <SetCard
          title="Identité visuelle"
          sub="Logo, couleur d'accent et typographie utilisés sur tous vos supports."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 320px) 1fr',
              gap: 28,
              alignItems: 'start',
            }}
          >
            <LogoUploader
              variant={data.logoVariant}
              onVariantChange={v => set('logoVariant', v)}
              accent={accentHex}
              tradeName={data.tradeName}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                }}
              >
                <TextField
                  label="Raison sociale"
                  value={data.legalName}
                  onChange={v => set('legalName', v)}
                />
                <TextField
                  label="Nom commercial"
                  value={data.tradeName}
                  onChange={v => set('tradeName', v)}
                />
              </div>
              <Textarea
                label="Baseline"
                value={data.tagline}
                onChange={v => set('tagline', v)}
                rows={2}
                max={120}
                hint="Apparaît sous le logo dans les brochures et le pied des emails."
              />
            </div>
          </div>

          <div style={{ height: 1, background: SET.line, margin: '26px 0 22px' }} />

          {/* Couleur d'accent */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr',
              gap: 22,
              alignItems: 'start',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SET.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Couleur d'accent
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: SET.muted,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                Boutons, liens et accents dans vos documents et emails.
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
              }}
            >
              {ACCENT_PRESETS.map(p => {
                const active = data.accent === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => set('accent', p.id)}
                    style={{
                      height: 44,
                      padding: '0 14px 0 8px',
                      borderRadius: 999,
                      border: 0,
                      background: active ? SET.cardSubtle : 'transparent',
                      boxShadow: active
                        ? `inset 0 0 0 1.5px ${SET.ink}`
                        : 'inset 0 0 0 1px rgba(15,23,42,0.06)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      transition: 'all .15s',
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: p.hex,
                        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: SET.ink }}>
                      {p.label}
                    </span>
                  </button>
                )
              })}
              <button
                onClick={() => set('accent', 'custom')}
                style={{
                  height: 44,
                  padding: '0 14px 0 8px',
                  borderRadius: 999,
                  border: 0,
                  background: data.accent === 'custom' ? SET.cardSubtle : 'transparent',
                  boxShadow:
                    data.accent === 'custom'
                      ? `inset 0 0 0 1.5px ${SET.ink}`
                      : 'inset 0 0 0 1px rgba(15,23,42,0.06)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background:
                      'conic-gradient(from 220deg, #ef4444, #f59e0b, #84cc16, #22c55e, #06b6d4, #8b5cf6, #ec4899, #ef4444)',
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: SET.ink }}>
                  Personnalisé
                </span>
              </button>
              {data.accent === 'custom' && (
                <input
                  type="color"
                  value={data.accentCustom}
                  onChange={e => set('accentCustom', e.target.value)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                />
              )}
            </div>
          </div>

          <div style={{ height: 1, background: SET.line, margin: '22px 0' }} />

          {/* Typographie */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr',
              gap: 22,
              alignItems: 'start',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SET.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Typographie
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: SET.muted,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                Couple titrage / texte courant pour vos documents.
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                gap: 10,
              }}
            >
              {FONT_PAIRS.map(f => {
                const active = data.fontPair === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => set('fontPair', f.id)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 14,
                      border: 0,
                      textAlign: 'left',
                      background: active ? SET.card : SET.cardSubtle,
                      boxShadow: active
                        ? `inset 0 0 0 1.5px ${SET.ink}`
                        : 'inset 0 0 0 1px rgba(15,23,42,0.04)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      transition: 'all .15s',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 19,
                        fontWeight: 700,
                        color: SET.ink,
                        letterSpacing: -0.4,
                        lineHeight: 1.05,
                      }}
                    >
                      Aa
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: SET.ink,
                        letterSpacing: -0.1,
                      }}
                    >
                      {f.headline}
                    </div>
                    <div style={{ fontSize: 11, color: SET.muted, fontWeight: 500 }}>
                      Texte courant — {f.body}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </SetCard>

        {/* ───────── Signature email ───────── */}
        <SetCard
          title="Signature email"
          sub="Apparaît au bas de chaque email envoyé depuis le CRM."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)',
              gap: 24,
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <TextField
                  label="Téléphone direct"
                  value={data.sigPhone}
                  onChange={v => set('sigPhone', v)}
                />
                <TextField
                  label="Mobile"
                  value={data.sigMobile}
                  onChange={v => set('sigMobile', v)}
                />
              </div>
              <TextField
                label="LinkedIn"
                value={data.socials.linkedin}
                onChange={v => setSocial('linkedin', v)}
                prefix="linkedin.com/in/"
              />
              <TextField
                label="Instagram"
                value={data.socials.instagram}
                onChange={v => setSocial('instagram', v)}
              />
              <TextField
                label="Site"
                value={data.socials.website}
                onChange={v => setSocial('website', v)}
              />
              <div style={{ height: 1, background: SET.line, margin: '4px 0' }} />
              <ToggleRow
                label="Afficher les réseaux"
                desc="LinkedIn, Instagram et site web sous le bloc contact."
                value={data.sigShowSocial}
                onChange={v => set('sigShowSocial', v)}
              />
              <ToggleRow
                label="QR code agence"
                desc="Petit QR à droite, vers la page publique de l'agence."
                value={data.sigShowQR}
                onChange={v => set('sigShowQR', v)}
              />
              <ToggleRow
                label="Mention légale en pied"
                desc="Numéro de registre cantonal et clause de confidentialité."
                value={data.sigShowDisclaimer}
                onChange={v => set('sigShowDisclaimer', v)}
              />
              {data.sigShowDisclaimer && (
                <Textarea
                  value={data.sigDisclaimer}
                  onChange={v => set('sigDisclaimer', v)}
                  rows={3}
                  max={240}
                />
              )}
            </div>
            <SignaturePreview data={data} accentHex={accentHex} />
          </div>
        </SetCard>

        {/* ───────── Domaine email ───────── */}
        <SetCard
          title="Domaine email"
          sub="Envoyez vos emails depuis prenom.nom@votredomaine.ch — meilleur taux de délivrance, mieux perçu par les clients."
          action={<DomainBadge status={data.domainStatus} />}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              marginBottom: 14,
            }}
          >
            <TextField
              label="Domaine connecté"
              value={data.emailDomain}
              onChange={v => set('emailDomain', v)}
              icon={<BrandIcon name="globe" size={16} stroke={SET.muted} />}
              copyable
            />
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SET.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Adresse expéditeur
              </div>
              <div
                style={{
                  height: 48,
                  padding: '0 16px',
                  borderRadius: 14,
                  background: SET.cardSubtle,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: SET.ink,
                  letterSpacing: -0.1,
                  boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                diane.weiss<span style={{ color: SET.muted }}>@{data.emailDomain}</span>
              </div>
            </div>
          </div>
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 14,
              background: SET.cardSubtle,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background:
                  data.domainStatus === 'verified' ? `${SET.ok}18` : `${SET.warn}18`,
                color: data.domainStatus === 'verified' ? SET.ok : SET.warn,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <SetIcon
                name={data.domainStatus === 'verified' ? 'check' : 'info'}
                size={18}
                sw={2.4}
                stroke={data.domainStatus === 'verified' ? SET.ok : SET.warn}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: SET.ink,
                  marginBottom: 2,
                }}
              >
                {data.domainStatus === 'verified'
                  ? 'Tous les enregistrements DNS sont valides'
                  : 'Configuration en cours'}
              </div>
              <div
                style={{ fontSize: 12.5, color: SET.muted, fontWeight: 500 }}
              >
                SPF · DKIM · DMARC · Vérifiés il y a 3 jours par notre service de monitoring
              </div>
            </div>
            <SetGhostBtn
              size="sm"
              onClick={() => setDomainCheckOpen(o => !o)}
              icon={<BrandIcon name="external" size={13} stroke={SET.inkSoft} />}
            >
              Voir les DNS
            </SetGhostBtn>
          </div>
          {domainCheckOpen && (
            <div
              style={{
                marginTop: 12,
                padding: '16px 18px',
                borderRadius: 14,
                background: SET.card,
                boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
                animation: 'setFadeUp .25s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 100px 1fr 80px',
                  gap: 12,
                  padding: '8px 0',
                  fontSize: 11,
                  fontWeight: 700,
                  color: SET.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  borderBottom: `1px solid ${SET.line}`,
                }}
              >
                <span>Type</span>
                <span>Nom</span>
                <span>Valeur</span>
                <span style={{ textAlign: 'right' }}>État</span>
              </div>
              {DNS_RECORDS.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 100px 1fr 80px',
                    gap: 12,
                    padding: '12px 0',
                    borderTop: i > 0 ? `1px solid ${SET.line}` : 'none',
                    alignItems: 'center',
                    fontSize: 12.5,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                >
                  <span style={{ fontWeight: 700, color: SET.ink }}>{row.type}</span>
                  <span style={{ color: SET.inkSoft }}>{row.name}</span>
                  <span
                    style={{
                      color: SET.muted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.val}
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 9px',
                        borderRadius: 999,
                        background: `${SET.ok}18`,
                        color: SET.ok,
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                      }}
                    >
                      <SetIcon name="check" size={11} stroke={SET.ok} sw={3} />
                      OK
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </SetCard>

        {/* ───────── Documents ───────── */}
        <SetCard
          title="Documents & brochures"
          sub="Gabarit visuel par défaut pour mandats, dossiers de visite et brochures imprimées."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 14,
              marginBottom: 22,
            }}
          >
            {TEMPLATE_GABARITS.map(g => {
              const active = data.docTemplate === g.id
              return (
                <button
                  key={g.id}
                  onClick={() => set('docTemplate', g.id)}
                  style={{
                    padding: 0,
                    border: 0,
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: SET.card,
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: active
                      ? `inset 0 0 0 2px ${SET.ink}, 0 12px 28px rgba(11,12,14,0.10)`
                      : 'inset 0 0 0 1px rgba(15,23,42,0.06)',
                    transition: 'all .2s',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <DocPreview gabarit={g} accent={accentHex} tradeName={data.tradeName} />
                  <div
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: SET.ink,
                          letterSpacing: -0.1,
                        }}
                      >
                        {g.label}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: SET.muted,
                          fontWeight: 500,
                          marginTop: 2,
                        }}
                      >
                        {g.desc}
                      </div>
                    </div>
                    {active && (
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: SET.ink,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <SetIcon name="check" size={12} stroke="#fff" sw={3} />
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Textarea
              label="Pied de document"
              value={data.docFooter}
              onChange={v => set('docFooter', v)}
              rows={2}
              hint="Reproduit en bas de chaque page imprimée et PDF générés depuis le CRM."
            />
            <ToggleRow
              label="Photo de couverture sur les dossiers de visite"
              desc="Première page = photo principale du bien en pleine largeur, sous le logo."
              value={data.docCoverPhoto}
              onChange={v => set('docCoverPhoto', v)}
            />
          </div>
        </SetCard>

        {/* ───────── Ma fiche dans l'agence ───────── */}
        <SetCard
          title="Ma fiche dans l'agence"
          sub="Apparaît dans l'annuaire de la page publique de l'agence (si activé). Pas de page individuelle — uniquement nom, photo et coordonnées."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ToggleRow
              label="Apparaître dans l'annuaire de l'agence"
              desc="Si désactivée, votre fiche reste interne au CRM."
              value={data.agentCardShow}
              onChange={v => set('agentCardShow', v)}
              emphasis
            />
            <Textarea
              label="Bio courte (annuaire)"
              value={data.agentCardBio}
              onChange={v => set('agentCardBio', v)}
              rows={3}
              max={200}
              hint="Apparaît sous votre photo, dans l'annuaire de l'agence."
            />
            <div style={{ height: 1, background: SET.line, margin: '4px 0' }} />
            <ToggleRow
              label="Photo professionnelle"
              desc="Cadre carré, 320×320 minimum."
              value={data.agentCardPhoto}
              onChange={v => set('agentCardPhoto', v)}
            />
          </div>
        </SetCard>

        {/* ───────── Page publique agence (admin only) ───────── */}
        {data.isAdmin && (
          <SetCard
            title="Page publique agence"
            sub="Vitrine de l'agence sur megga.ch. Réservé aux administrateurs."
            action={
              <SetGhostBtn
                size="sm"
                icon={<BrandIcon name="eye" size={13} stroke={SET.inkSoft} />}
              >
                Aperçu live
              </SetGhostBtn>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ToggleRow
                label="Page publique active"
                desc="Si désactivée, l'agence reste invisible sur megga.ch."
                value={data.agencyPageActive}
                onChange={v => set('agencyPageActive', v)}
                emphasis
              />
              <TextField
                label="URL publique"
                value={data.agencySlug}
                onChange={v => set('agencySlug', v)}
                prefix="megga.ch/agence/"
                hint="Lettres minuscules, tirets uniquement."
                copyable
              />
              <div style={{ height: 1, background: SET.line, margin: '4px 0' }} />
              <ToggleRow
                label="Annuaire des collaborateurs"
                desc="Affiche la grille des agents (sans page individuelle)."
                value={data.agencyShowAgents}
                onChange={v => set('agencyShowAgents', v)}
              />
              <ToggleRow
                label="Listing des biens"
                desc="Affiche la grille des biens en mandat sur la page agence."
                value={data.agencyShowListings}
                onChange={v => set('agencyShowListings', v)}
              />
              <div style={{ height: 1, background: SET.line, margin: '4px 0' }} />
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: SET.muted,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Mode d'intégration
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                  }}
                >
                  {(
                    [
                      {
                        id: 'redirect',
                        label: 'Redirect',
                        desc: "Les cards renvoient vers le site de l'agence.",
                      },
                      {
                        id: 'native',
                        label: 'Natif CRM',
                        desc: 'Les biens sont gérés directement dans MEGGA.',
                      },
                    ] as { id: BrandData['agencyIntegration']; label: string; desc: string }[]
                  ).map(opt => {
                    const active = data.agencyIntegration === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => set('agencyIntegration', opt.id)}
                        style={{
                          textAlign: 'left',
                          padding: 14,
                          borderRadius: 14,
                          border: 0,
                          cursor: 'pointer',
                          background: active ? SET.cardSubtle : '#fff',
                          boxShadow: active
                            ? 'inset 0 0 0 2px #0B0C0E'
                            : 'inset 0 0 0 1px rgba(15,23,42,0.06)',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: SET.ink,
                          }}
                        >
                          {opt.label}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: SET.muted,
                            marginTop: 4,
                            lineHeight: 1.4,
                          }}
                        >
                          {opt.desc}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              {data.agencyIntegration === 'redirect' && (
                <TextField
                  label="Site externe de l'agence"
                  value={data.agencyExternalUrl}
                  onChange={v => set('agencyExternalUrl', v)}
                  placeholder="https://www.exemple.ch"
                  hint="Les cards de la page publique redirigent vers ce domaine."
                />
              )}
            </div>
          </SetCard>
        )}
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onCancel={() => setData(saved)}
      />
      <Toast open={toast} label="Marque & présentation enregistrées" />
    </>
  )
}
