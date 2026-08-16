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
import type { CrmPalette } from '../tokens'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useAuth } from '@/hooks/useAuth'
import { useAgencySettings } from '@/hooks/useAgencySettings'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { useNavigate } from 'react-router-dom'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'

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
  sp: CrmPalette
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
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
        width: '100%', padding: 'var(--crm-space-md) var(--crm-space-lg)',
        border: 0, background: hover ? sp.solidBgSub : 'transparent',
        cursor: 'pointer', textAlign: 'left',
        // Concentrique avec la coque : 26 (rayon du pager) − 12 (padding) = 14.
        borderRadius: 'var(--crm-radius-xl)', fontFamily: 'inherit',
        // ⚠️ pas de transition de fond (bug pastilles noires)
      }}>
      {/* Pas de pastille derrière l'icône : le survol ne colore que la ligne,
          et l'icône seule à 20 px porte mieux que 15 px dans un carré. */}
      <div style={{
        width: 26, height: 26,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        {iconKind === 'crm'
          ? <MEIcon name={icon as MEIconName} size={20} color={tint} strokeWidth={1.6} />
          : <InlineIco name={icon as InlineIconName} size={20} stroke={tint} strokeWidth={1.6} />
        }
      </div>
      <span style={{
        flex: 1, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tint, letterSpacing: -0.1,
      }}>{label}</span>
      {trail}
    </button>
  )
}

// ─── Section separator ────────────────────────────────────────────────
function Sep({ sp }: { sp: CrmPalette }) {
  return (
    <div style={{
      height: 1, background: sp.frameBorder,
      margin: '7px 4px', opacity: 0.5,
    }} />
  )
}

// ─── Header (identity + plan pill) ────────────────────────────────────
interface ProfileHeaderProps {
  sp: CrmPalette
  name: string
  initials: string
  subtitle: string
  planLabel: string | null
}

function ProfileHeader({ sp, name, initials, subtitle, planLabel }: ProfileHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
      padding: 'var(--crm-space-lg) var(--crm-space-xl) var(--crm-space-xl)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--crm-radius-pill)',
        background: sp.ink, color: sp.solidBg,
        display: 'grid', placeItems: 'center',
        fontSize: 'var(--crm-text-xl)', fontWeight: 600,
        flexShrink: 0,
      }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
          <span style={{
            fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, letterSpacing: -0.2,
            lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{name}</span>
          {planLabel && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)',
              padding: 'var(--crm-space-2xs) var(--crm-space-sm) var(--crm-space-2xs) var(--crm-space-xs)', borderRadius: 'var(--crm-radius-pill)',
              background: sp.ink, color: sp.solidBg,
              fontSize: 'var(--crm-text-xs)', fontWeight: 500,
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              <InlineIco name="spark" size={9} stroke={sp.solidBg} strokeWidth={2} />
              {planLabel}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 'var(--crm-text-sm)', color: sp.sub, marginTop: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{subtitle}</div>
      </div>
    </div>
  )
}

// ─── Main popover body ────────────────────────────────────────────────
interface CrmProfileDropdownProps {
  sp: CrmPalette
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

export default function CrmProfileDropdown({
  sp, onClose, onSettings, onHelp, onLogout,
}: CrmProfileDropdownProps) {
  const { t } = useTranslation('common')
  const { profile, user } = useAuth()
  const navigate = useNavigate()
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
      width: 304, padding: 'var(--crm-space-xl)', zIndex: 9000,
      background: sp.solidBg,
      border: `1px solid ${sp.solidBorder}`,
      // Rayon du pager (viewport 26 px, cf. ContactsPager/BiensPager/CalendarApp) :
      // le popover retombe sur le coin haut-droit du pager, les deux courbures
      // doivent se répondre. Bordure et ombre restent en tokens `solid*` — le
      // popover est OPAQUE et surélevé, il n'emprunte pas le verre du pager.
      borderRadius: 'var(--crm-radius-6xl)',
      boxShadow: sp.solidShadow,
      animation: 'crm-fade-up 280ms cubic-bezier(.22,1,.36,1)',
    }}>
      <ProfileHeader sp={sp} name={fullName} initials={initials} subtitle={subtitle} planLabel={planLabel} />

      {/* Section « Plateforme » — libellée, pour que la console se distingue des
          réglages du compte : on ne quitte pas son agence, on change d'outil. */}
      {isSuperAdmin && (
        <>
          <Sep sp={sp} />
          <div style={{
            padding: 'var(--crm-space-2xs) var(--crm-space-lg) var(--crm-space-sm)',
            fontSize: 'var(--crm-text-xs)', fontWeight: 500, letterSpacing: 0.2,
            color: sp.sub,
          }}>{t('profile.platformSection')}</div>
          {/* Chevron et non flèche « sortie » : la console est une surface du
              CRM depuis juillet 2026, on n'ouvre plus d'onglet. */}
          <Row sp={sp} iconKind="inline" icon="console"
            label={t('profile.adminConsole')}
            trail={<InlineIco name="chevron" size={15} stroke={sp.sub} strokeWidth={2} />}
            onClick={wrap(() => navigate(ADMIN_CONSOLE_PATH))} />
        </>
      )}

      <Sep sp={sp} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
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
