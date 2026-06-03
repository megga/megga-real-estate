// MEGGA CRM Sugar v2 — Profile dropdown anchored on the topbar avatar.
// 1:1 port from the Claude Design bundle (crm-profile-dropdown-sugar.jsx).
// Note: keyboard shortcut pills (kbd) intentionally omitted per user request.

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { SugarPalette } from '../tokens'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useAuth } from '@/hooks/useAuth'
import { useAgencySettings } from '@/hooks/useAgencySettings'

// ─── Inline icons not in MEIcon ──────────────────────────────────────
type InlineIconName = 'external' | 'shield' | 'card' | 'help' | 'logout' | 'check'

function InlineIco({
  name, size = 18, stroke = 'currentColor', strokeWidth = 1.6,
}: { name: InlineIconName; size?: number; stroke?: string; strokeWidth?: number }) {
  const paths: Record<InlineIconName, ReactNode> = {
    external: <><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></>,
    shield:   <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/></>,
    card:     <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></>,
    help:     <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 2"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></>,
    logout:   <><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5"/><path d="M15 12H5"/></>,
    check:    <><path d="m5 13 4 4 10-12"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

// ─── Menu row ─────────────────────────────────────────────────────────
interface RowProps {
  icon: MEIconName | InlineIconName
  iconKind?: 'crm' | 'inline'
  label: string
  trail?: ReactNode
  onClick?: () => void
  sp: SugarPalette
}

function Row({ icon, iconKind = 'crm', label, trail, onClick, sp }: RowProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '10px 12px',
        border: 0, background: hover ? sp.cardSubBg : 'transparent',
        cursor: 'pointer', textAlign: 'left',
        borderRadius: 12, fontFamily: 'inherit',
        color: sp.ink,
        transition: 'background 140ms ease',
      }}>
      <div style={{
        width: 30, height: 30, borderRadius: 10,
        background: hover ? sp.frameBg : sp.cardSubBg,
        display: 'grid', placeItems: 'center', flexShrink: 0,
        transition: 'background 140ms ease',
      }}>
        {iconKind === 'crm'
          ? <MEIcon name={icon as MEIconName} size={15} color={sp.ink} strokeWidth={1.7} />
          : <InlineIco name={icon as InlineIconName} size={15} stroke={sp.ink} strokeWidth={1.7} />
        }
      </div>
      <span style={{
        flex: 1, fontSize: 13.5, fontWeight: 600, color: sp.ink, letterSpacing: -0.1,
      }}>{label}</span>
      {trail}
    </button>
  )
}

// ─── Section separator ────────────────────────────────────────────────
function Sep({ sp }: { sp: SugarPalette }) {
  return (
    <div style={{
      height: 1, background: sp.frameBorder,
      margin: '6px 4px', opacity: 0.55,
    }} />
  )
}

// ─── Verified pill ────────────────────────────────────────────────────
function VerifiedPill() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px 3px 6px', borderRadius: 999,
      background: 'rgba(14,159,110,0.12)',
      color: '#0E9F6E',
      fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2,
      textTransform: 'uppercase',
    }}>
      <InlineIco name="check" size={11} stroke="#0E9F6E" strokeWidth={2.2} />
      Vérifié
    </span>
  )
}

// ─── Header card (identity) ───────────────────────────────────────────
interface ProfileHeaderProps {
  sp: SugarPalette
  agent: { name: string; role: string; agency: string; initials: string }
}

function ProfileHeader({ sp, agent }: ProfileHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      background: sp.cardSubBg,
      borderRadius: 14,
      marginBottom: 8,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 999,
        background: '#0041D9', color: '#fff',
        display: 'grid', placeItems: 'center',
        fontSize: 14.5, fontWeight: 800, letterSpacing: 0.3,
        boxShadow: '0 2px 8px rgba(0,65,217,0.30)',
        flexShrink: 0,
      }}>{agent.initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 800, color: sp.ink, letterSpacing: -0.2,
          lineHeight: 1.25,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{agent.name}</div>
        <div style={{
          fontSize: 11.5, color: sp.sub, marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{agent.role} · {agent.agency}</div>
      </div>
    </div>
  )
}

// ─── Main popover body ────────────────────────────────────────────────
interface SugarProfileDropdownProps {
  sp: SugarPalette
  dark: boolean
  onClose?: () => void
  onSettings?: () => void
  onKyc?: () => void
  onAgencyPublic?: () => void
  onHelp?: () => void
  onLogout?: () => void
}

export default function SugarProfileDropdown({
  sp, dark, onClose, onSettings, onKyc, onAgencyPublic, onHelp, onLogout,
}: SugarProfileDropdownProps) {
  const { profile, user } = useAuth()
  const { agency: agencyData } = useAgencySettings()

  const fullName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Agent'
  const initials = fullName
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??'
  const role = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : 'Agent'
  const agencyName = agencyData?.name?.trim() || 'Agence non définie'

  const agent = {
    name: fullName,
    role,
    agency: agencyName,
    initials,
  }

  const solidBg = dark ? '#1A1B1F' : '#FFFFFF'

  const wrap = (fn?: () => void) => () => {
    if (fn) fn()
    if (onClose) onClose()
  }

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 10px)', right: 0,
      width: 300, padding: 12, zIndex: 9000,
      background: solidBg,
      border: `1px solid ${sp.frameBorder}`,
      borderRadius: 20,
      boxShadow: '0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)',
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      animation: 'sugar-fade-up 280ms cubic-bezier(.22,1,.36,1)',
    }}>
      <ProfileHeader sp={sp} agent={agent} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Row sp={sp} iconKind="inline" icon="external"
          label="Voir notre fiche publique"
          onClick={wrap(onAgencyPublic)} />
        <Row sp={sp} icon="settings" label="Préférences"
          onClick={wrap(onSettings)} />
        <Row sp={sp} iconKind="inline" icon="shield"
          label="Sécurité & sessions"
          onClick={wrap(onSettings)} />
      </div>

      <Sep sp={sp} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Row sp={sp} icon="shield" label="Mon KYC agent"
          trail={<VerifiedPill />}
          onClick={wrap(onKyc)} />
        <Row sp={sp} iconKind="inline" icon="card"
          label="Facturation & abonnement"
          onClick={wrap(onSettings)} />
        <Row sp={sp} iconKind="inline" icon="help"
          label="Centre d'aide"
          onClick={wrap(onHelp)} />
      </div>

      <Sep sp={sp} />

      <Row sp={sp} iconKind="inline" icon="logout"
        label="Se déconnecter"
        onClick={wrap(onLogout)} />
    </div>
  )
}
