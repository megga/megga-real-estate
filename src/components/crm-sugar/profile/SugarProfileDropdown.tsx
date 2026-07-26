// MEGGA CRM Sugar v2 — Profile dropdown (concept « badge minimal »).
// Refonte design (handoff dropdown_motion_v1) : en-tête identité + pastille de
// plan, lignes épurées, surface OPAQUE issue des tokens `solid*` (correcte en
// clair ET sombre, sans dépendre du prop `dark`).
//
// ⚠️ Bug « pastilles noires » : AUCUNE `transition: background` sur le bouton de
// ligne ni sur le chip d'icône. Avec des nœuds DOM réutilisés entre clair↔sombre,
// une transition de background-color reste bloquée à mi-course et peint la couleur
// sombre périmée. Le fond doit s'appliquer immédiatement.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { SugarPalette } from '../tokens'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useAuth } from '@/hooks/useAuth'
import { useAgencySettings } from '@/hooks/useAgencySettings'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { ADMIN_IS_EXTERNAL, openAdminConsole } from '@/lib/adminEntry'

// ─── Inline icons not in MEIcon ──────────────────────────────────────
type InlineIconName = 'shield' | 'card' | 'help' | 'logout' | 'chevron' | 'spark' | 'console' | 'external'

function InlineIco({
  name, size = 18, stroke = 'currentColor', strokeWidth = 1.6,
}: { name: InlineIconName; size?: number; stroke?: string; strokeWidth?: number }) {
  const paths: Record<InlineIconName, ReactNode> = {
    shield:  <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/></>,
    card:    <><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/></>,
    help:    <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 2"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></>,
    logout:  <><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5"/><path d="M15 12H5"/></>,
    chevron: <><path d="m9 6 6 6-6 6"/></>,
    // Console plateforme : deux baies empilées (lecture « infra », distincte du
    // bouclier de « Sécurité & sessions » juste en dessous).
    console: <><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></>,
    external: <><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></>,
    spark:   <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

// ─── Menu row (chip + label + trailing) ───────────────────────────────
interface RowProps {
  icon: MEIconName | InlineIconName
  iconKind?: 'crm' | 'inline'
  label: string
  trail?: ReactNode
  onClick?: () => void
  sp: SugarPalette
  danger?: boolean
}

function Row({ icon, iconKind = 'crm', label, trail, onClick, sp, danger = false }: RowProps) {
  const [hover, setHover] = useState(false)
  const tint = danger ? '#E5484D' : sp.ink
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '9px 10px',
        border: 0, background: hover ? sp.solidBgSub : 'transparent',
        cursor: 'pointer', textAlign: 'left',
        borderRadius: 12, fontFamily: 'inherit',
        // ⚠️ pas de transition de fond (bug pastilles noires)
      }}>
      <div style={{
        width: 30, height: 30, borderRadius: 10,
        background: hover ? (danger ? 'rgba(229,72,77,0.12)' : sp.solidBgSub2) : sp.solidBgSub,
        display: 'grid', placeItems: 'center', flexShrink: 0,
        // ⚠️ pas de transition de fond
      }}>
        {iconKind === 'crm'
          ? <MEIcon name={icon as MEIconName} size={15} color={tint} strokeWidth={1.7} />
          : <InlineIco name={icon as InlineIconName} size={15} stroke={tint} strokeWidth={1.7} />
        }
      </div>
      <span style={{
        flex: 1, fontSize: 13.5, fontWeight: 600, color: tint, letterSpacing: -0.1,
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
      margin: '7px 4px', opacity: 0.5,
    }} />
  )
}

// ─── Header (identity + plan pill) ────────────────────────────────────
interface ProfileHeaderProps {
  sp: SugarPalette
  name: string
  initials: string
  subtitle: string
  planLabel: string | null
}

function ProfileHeader({ sp, name, initials, subtitle, planLabel }: ProfileHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 12px 12px',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 999,
        background: sp.ink, color: sp.solidBg,
        display: 'grid', placeItems: 'center',
        fontSize: 14.5, fontWeight: 800, letterSpacing: 0.3,
        flexShrink: 0,
      }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            fontSize: 14.5, fontWeight: 800, color: sp.ink, letterSpacing: -0.2,
            lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{name}</span>
          {planLabel && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px 2px 5px', borderRadius: 999,
              background: sp.ink, color: sp.solidBg,
              fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              <InlineIco name="spark" size={9} stroke={sp.solidBg} strokeWidth={2} />
              {planLabel}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 11.5, color: sp.sub, marginTop: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{subtitle}</div>
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
  onHelp?: () => void
  onLogout?: () => void
  // Conservés optionnels pour compat appelant (non utilisés par le concept
  // « badge minimal » — KYC reste accessible via le rail/TopNav).
  onKyc?: () => void
  onAgencyPublic?: () => void
}

export default function SugarProfileDropdown({
  sp, onClose, onSettings, onHelp, onLogout,
}: SugarProfileDropdownProps) {
  const { t } = useTranslation('common')
  const { profile, user, session } = useAuth()
  const { agency: agencyData, plan } = useAgencySettings()
  // Seule porte d'entrée vers la console depuis le CRM refondu : le rail et la
  // TopNav ne portent aucune trace de l'admin, et la sidebar legacy qui le
  // proposait n'est plus montée sur les surfaces Sugar. Rendu uniquement pour
  // un super-admin confirmé par la DB (useSuperAdminGate → RPC is_super_admin).
  const { allowed: isSuperAdmin } = useSuperAdminGate()

  const fullName = profile?.full_name?.trim() || user?.email?.split('@')[0] || t('profile.defaultName')
  const initials = fullName
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??'
  const role = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : t('profile.defaultName')
  const agencyName = agencyData?.name?.trim() || t('profile.noAgency')
  const subtitle = user?.email?.trim() || `${role} · ${agencyName}`
  const planLabel = plan ? plan.toUpperCase() : null

  const wrap = (fn?: () => void) => () => {
    if (fn) fn()
    if (onClose) onClose()
  }

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 10px)', right: 0,
      width: 304, padding: 12, zIndex: 9000,
      background: sp.solidBg,
      border: `1px solid ${sp.solidBorder}`,
      borderRadius: 20,
      boxShadow: sp.solidShadow,
      animation: 'sugar-fade-up 280ms cubic-bezier(.22,1,.36,1)',
    }}>
      <ProfileHeader sp={sp} name={fullName} initials={initials} subtitle={subtitle} planLabel={planLabel} />

      {isSuperAdmin && (
        <>
          <Sep sp={sp} />
          <Row sp={sp} iconKind="inline" icon="console"
            label={t('profile.adminConsole')}
            trail={ADMIN_IS_EXTERNAL
              ? <InlineIco name="external" size={14} stroke={sp.sub} strokeWidth={1.8} />
              : <InlineIco name="chevron" size={15} stroke={sp.sub} strokeWidth={2} />}
            onClick={wrap(() => openAdminConsole(session))} />
        </>
      )}

      <Sep sp={sp} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Row sp={sp} icon="settings" label={t('profile.preferences')}
          onClick={wrap(onSettings)} />
        <Row sp={sp} iconKind="inline" icon="shield"
          label={t('profile.security')}
          onClick={wrap(onSettings)} />
        <Row sp={sp} iconKind="inline" icon="card"
          label={t('profile.billing')}
          trail={<InlineIco name="chevron" size={15} stroke={sp.sub} strokeWidth={2} />}
          onClick={wrap(onSettings)} />
        <Row sp={sp} iconKind="inline" icon="help"
          label={t('profile.help')}
          onClick={wrap(onHelp)} />
      </div>

      <Sep sp={sp} />

      <Row sp={sp} iconKind="inline" icon="logout"
        danger
        label={t('nav.logout')}
        onClick={wrap(onLogout)} />
    </div>
  )
}
