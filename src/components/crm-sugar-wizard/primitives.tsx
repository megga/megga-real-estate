// MEGGA CRM Sugar v2 Wizard — Shared primitives.
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-v2.jsx + step1.jsx + step3.jsx).

import { useState, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2 } from './tokens'

// ─── Icons (line-style, Sugar) ──────────────────────────────────────────
export type SgIconName =
  | 'upload' | 'inbox' | 'edit' | 'arrowL' | 'arrowR' | 'close' | 'search'
  | 'bell' | 'moon' | 'check' | 'plus' | 'cal' | 'computer' | 'phone' | 'cloud'

const PATHS: Record<SgIconName, ReactNode> = {
  upload:   <><path d="M12 16V4M12 4l-5 5M12 4l5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
  inbox:    <><path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/><path d="M3 13l3-7a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l3 7"/><path d="M3 13h5l1 2h6l1-2h5"/></>,
  edit:     <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></>,
  arrowL:   <><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></>,
  arrowR:   <><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></>,
  close:    <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
  search:   <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  bell:     <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
  moon:     <><path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/></>,
  check:    <><path d="m5 13 4 4 10-12"/></>,
  plus:     <><path d="M12 5v14M5 12h14"/></>,
  cal:      <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
  computer: <><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  phone:    <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></>,
  cloud:    <><path d="M18 10a4 4 0 0 0-7.55-1A4 4 0 1 0 7 18h11a4 4 0 0 0 0-8Z"/></>,
}

export function SgIcon({
  name, size = 22, stroke = 'currentColor', sw = 1.6,
}: { name: SgIconName; size?: number; stroke?: string; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name] || null}
    </svg>
  )
}

// ─── Bouton circulaire gris (style Sugar topbar) ──────────────────────
export function SgCircleBtn({
  icon, onClick, size = 44, badge, title,
}: {
  icon: ReactNode
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  size?: number
  badge?: boolean
  title?: string
}) {
  return (
    <button onClick={onClick} title={title} style={{
      width: size, height: size, borderRadius: 'var(--crm-radius-pill)', border: 0,
      background: SugarV2.cardSubtle, color: SugarV2.inkSoft,
      cursor: 'pointer', display: 'grid', placeItems: 'center',
      position: 'relative', transition: 'all .18s ease',
      boxShadow: SugarV2.shadowSm,
    }}
    onMouseEnter={e => { e.currentTarget.style.background = SugarV2.card; e.currentTarget.style.boxShadow = SugarV2.shadow }}
    onMouseLeave={e => { e.currentTarget.style.background = SugarV2.cardSubtle; e.currentTarget.style.boxShadow = SugarV2.shadowSm }}
    >
      {icon}
      {badge && <span style={{
        position: 'absolute', top: 8, right: 8,
        width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)', background: SugarV2.err,
        boxShadow: `0 0 0 2px ${SugarV2.cardSubtle}`,
      }} />}
    </button>
  )
}

// ─── Pilule noire (CTA principal) ──────────────────────────────────────
export function SgBlackPill({
  children, onClick, disabled, icon, size = 'lg',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
  size?: 'lg' | 'sm'
}) {
  const [hover, setHover] = useState(false)
  const h = size === 'lg' ? 50 : 40
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: h, padding: size === 'lg' ? '0 28px' : '0 20px',
        borderRadius: 'var(--crm-radius-pill)', border: 0,
        background: disabled ? SugarV2.ghostSolid : (hover ? SugarV2.blackHover : SugarV2.black),
        color: SugarV2.onBlack,
        fontFamily: 'inherit', fontWeight: 600,
        fontSize: size === 'lg' ? 'var(--crm-text-lg)' : 'var(--crm-text-md)',
        letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
        boxShadow: disabled ? 'none' : (hover ? SugarV2.pillShadowHover : SugarV2.pillShadow),
        transition: 'all .18s ease',
        transform: hover && !disabled ? 'translateY(-1px)' : 'translateY(0)',
      }}>
      {children}
      {icon}
    </button>
  )
}

// ─── Pilule fantôme ────────────────────────────────────────────────────
export function SgGhostPill({
  children, onClick, icon,
}: { children: ReactNode; onClick?: () => void; icon?: ReactNode }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: 50, padding: '0 var(--crm-space-7xl)', borderRadius: 'var(--crm-radius-pill)',
        border: 0, background: hover ? SugarV2.card : 'transparent',
        color: SugarV2.inkSoft, fontFamily: 'inherit',
        fontSize: 'var(--crm-text-xl)', fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)',
        boxShadow: hover ? SugarV2.shadow : 'none',
        transition: 'all .18s ease',
      }}>
      {icon}
      {children}
    </button>
  )
}

// ─── Petit input Sugar ────────────────────────────────────────────────
export function SgInput({
  label, value, onChange, type = 'text', placeholder, autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoFocus?: boolean
}) {
  const [focus, setFocus] = useState(false)
  return (
    <label style={{ display: 'block' }}>
      {/* Libellé de champ : casse normale, 16 px, poids 400 — la règle portée sur
          les Réglages, où ils étaient en 12-13 px UPPERCASE poids 700. C'est le
          seul point d'appui du wizard : tous ses champs passent par ici. */}
      <div style={{
        fontSize: 'var(--crm-text-2xl)', fontWeight: 400, color: SugarV2.inkSoft,
        marginBottom: 8,
      }}>{label}</div>
      <input type={type} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          height: 48, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-xl)',
          border: 0, outline: 'none', fontFamily: 'inherit',
          background: focus ? SugarV2.card : SugarV2.cardSubtle,
          color: SugarV2.ink, fontSize: 'var(--crm-text-xl)', fontWeight: 500,
          boxShadow: focus
            ? `0 0 0 2px ${SugarV2.black}, 0 4px 12px rgba(0,0,0,0.05)`
            : `inset 0 0 0 1px ${SugarV2.line}`,
          transition: 'all .18s ease',
        }} />
    </label>
  )
}

// ─── Avatar (cercle coloré, halo doux) ─────────────────────────────────
export function SgAvatar({
  contact, size = 44,
}: {
  contact: { firstName: string; lastName: string; avatarBg?: string }
  size?: number
}) {
  const initials = `${contact.firstName[0] ?? ''}${contact.lastName[0] ?? ''}`.toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--crm-radius-pill)',
      background: contact.avatarBg || '#3B82F6',
      color: '#fff', display: 'grid', placeItems: 'center',
      fontSize: Math.max(11, size * 0.34), fontWeight: 600,
      flexShrink: 0,
      boxShadow: `0 0 0 4px ${contact.avatarBg ? contact.avatarBg + '26' : 'rgba(59,130,246,0.15)'}`,
    }}>{initials}</div>
  )
}

// ─── Pastille KYC ──────────────────────────────────────────────────────
// KYC = assist optionnel, jamais bloquant : « à faire » reste un état facultatif.
export function SgKycChip({ status }: { status?: 'verified' | 'pending' | 'none' | 'stale' | string }) {
  const { t } = useTranslation('listings')
  // Couleurs thème par statut (non traduites) ; le libellé vient de l'i18n.
  const tone: Record<string, { color: string; bg: string }> = {
    verified: { color: SugarV2.ok,    bg: 'rgba(16,185,129,0.10)' },
    pending:  { color: SugarV2.warn,  bg: 'rgba(245,158,11,0.10)' },
    none:     { color: SugarV2.muted, bg: 'rgba(122,128,136,0.10)' },
    stale:    { color: SugarV2.warn,  bg: 'rgba(245,158,11,0.10)' },
  }
  const key = status && tone[status] ? status : 'none'
  const m = tone[key]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
      padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
      background: m.bg, color: m.color,
      fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: 0.2,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 'var(--crm-radius-pill)', background: m.color }} />
      {t(`wizard.kyc.${key}`)}
    </span>
  )
}
