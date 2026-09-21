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
import type { CoinCadre } from '@/hooks/useCoinDuCadre'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { IconeTheme } from '../IconeTheme'
import { useAuth } from '@/hooks/useAuth'
import { useAgencySettings } from '@/hooks/useAgencySettings'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { useNavigate } from 'react-router-dom'
import { consoleAReprendre } from '@/lib/adminEntry'
import { PlanBadge } from '../PlanBadge'
import { CrmProfileCredits } from './CrmProfileCredits'
import { formuleDepuisBase, type FormuleAffichee } from '@/components/megga-x-crm/plans'

// ─── Inline icons not in MEIcon ──────────────────────────────────────
type InlineIconName = 'shield' | 'card' | 'help' | 'logout' | 'chevron' | 'console' | 'external'

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
  formule: FormuleAffichee | null
}

function ProfileHeader({ sp, name, initials, formule }: ProfileHeaderProps) {
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
          {formule && <PlanBadge formule={formule} />}
        </div>
      </div>
    </div>
  )
}

// ─── Main popover body ────────────────────────────────────────────────
/** Largeur de la coque — la pose `coin` s'en sert pour caler son bord DROIT. */
const LARGEUR = 304

interface CrmProfileDropdownProps {
  sp: CrmPalette
  dark: boolean
  /**
   * Bascule clair/sombre. Elle vivait dans le rail d'icônes ; le rail parti, ce
   * menu est le seul endroit du chrome où le réglage a encore un voisinage
   * sensé — celui des préférences du compte. Omise (console admin, bancs), la
   * ligne « Apparence » n'est pas rendue.
   */
  setDark?: (v: boolean) => void
  /**
   * Le coin du cadre de page où se loger, mesuré par l'appelant (`useCoinDuCadre`).
   * Tant qu'il est `null`, la coque attend hors de l'écran.
   *
   * ⚠ Une seule pose depuis le 14.09.2026 : le menu ne s'ouvre plus que depuis la
   * pastille en haut à droite de la bande (`CrmCompteBouton`). La pose latérale du
   * pied de la barre est partie avec sa pastille.
   */
  coin: CoinCadre | null
  onClose?: () => void
  onSettings?: () => void
  /**
   * Ouvre Réglages › Consommation — la section des crédits, pas la racine des Réglages.
   * Omise (console admin, bancs), la ligne « Crédits Labs » n'est plus qu'un affichage.
   */
  onCredits?: () => void
  onHelp?: () => void
  onLogout?: () => void
}

export default function CrmProfileDropdown({
  sp, dark, setDark, coin, onClose, onSettings, onCredits, onHelp, onLogout,
}: CrmProfileDropdownProps) {
  const { t } = useTranslation('common')
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const { plan } = useAgencySettings()
  const reduit = useReducedMotion()
  // Une des trois portes vers la console, avec la ligne rouge du pied de la
  // barre latérale (13 septembre 2026) et ⌘K. Gardée ici parce que le menu de
  // compte est l'endroit où l'on cherche ce qui dépend de SON rôle. Rendu
  // uniquement pour un super-admin confirmé par la DB (useSuperAdminGate → RPC
  // is_super_admin).
  const { allowed: isSuperAdmin } = useSuperAdminGate()

  const fullName = profile?.full_name?.trim() || user?.email?.split('@')[0] || t('profile.defaultName')
  const initials = fullName
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??'
  // Les noms des cartes de la facturation (Gratuit / Pro / Custom), pas le code de la base.
  const formule = plan ? formuleDepuisBase(plan) : null

  const wrap = (fn?: () => void) => () => {
    if (fn) fn()
    if (onClose) onClose()
  }

  return (
    <div style={{
      // Le coin haut-droit de la coque SUR celui du cadre : bord haut sur son bord
      // haut, bord droit sur son bord droit (largeur en `border-box`).
      position: 'fixed', top: coin ? coin.top : -9999, left: coin ? coin.right - LARGEUR : -9999,
      width: LARGEUR, padding: 'var(--crm-space-xl)', zIndex: 9000,
      background: sp.solidBg,
      border: `1px solid ${sp.solidBorder}`,
      // Rayon du pager : le popover retombe sur le coin haut-droit du pager, les
      // deux courbures doivent se répondre. ⛔ Les cadres portent 26 px (13 pages)
      // ou 24 (`6xl` : Calendrier, Messagerie, KYC) : un rayon écrit ici laisserait
      // dépasser un croissant du cadre sur l'une des deux familles. La coque prend
      // donc le rayon MESURÉ du cadre, le jeton n'étant qu'un repli sans cadre.
      // Bordure et ombre restent en tokens `solid*` — le popover est OPAQUE et
      // surélevé, il n'emprunte pas le verre du pager.
      borderRadius: coin?.rayon || 'var(--crm-radius-6xl)',
      boxShadow: sp.solidShadow,
      animation: 'crm-fade-up 280ms cubic-bezier(.22,1,.36,1)',
    }}>
      <ProfileHeader sp={sp} name={fullName} initials={initials} formule={formule} />

      {/* Les crédits du studio, tout en haut : c'est la seule donnée CHIFFRÉE du menu,
          et la seule qu'on vient y chercher plusieurs fois par jour. Le bloc se rend
          lui-même invisible si le plan n'ouvre pas le studio. */}
      <Sep sp={sp} />
      <CrmProfileCredits sp={sp} onVoirConsommation={onCredits} onClose={onClose} />

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
              CRM depuis juillet 2026, on n'ouvre plus d'onglet. Elle rouvre sur
              sa dernière page, comme depuis la barre latérale — deux lignes
              « Console admin » du même chrome ne mènent pas à deux endroits. */}
          <Row sp={sp} iconKind="inline" icon="console"
            label={t('profile.adminConsole')}
            trail={<InlineIco name="chevron" size={15} stroke={sp.sub} strokeWidth={2} />}
            onClick={wrap(() => navigate(consoleAReprendre()))} />
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

      {setDark && (
        <>
          <Sep sp={sp} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
            padding: 'var(--crm-space-md) var(--crm-space-lg)',
          }}>
            <div style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <IconeTheme dark={!!dark} size={20} color={sp.ink} strokeWidth={1.6} />
            </div>
            <span style={{
              flex: 1, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, letterSpacing: -0.1,
            }}>{t('nav.appearance')}</span>
            {/* Segmenté à deux crans plutôt qu'un interrupteur : « clair » et
                « sombre » sont deux choix nommés, pas l'activation d'un mode.
                Deux crans ÉGAUX : la pastille qui glisse de l'un à l'autre fait
                exactement la largeur d'un cran. */}
            <div style={{
              position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', flexShrink: 0,
              padding: 'var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)',
              background: sp.solidBgSub,
            }}>
              {/* La pastille GLISSE d'un cran à l'autre au lieu de sauter — en
                  translation LOCALE au segmenté, et pas au montage (`initial={false}`).
                  ⛔ Elle était animée par un `layoutId`, donc en coordonnées de
                  FENÊTRE : or la coque naît hors de l'écran le temps de mesurer le
                  coin du cadre, puis se pose, pendant son propre `crm-fade-up`. Chaque
                  déplacement de la coque se lisait comme un déplacement de la
                  pastille — filmé le 14.09.2026, elle passait par « Préférences »,
                  « Aide », sortait sous le menu et ne se posait qu'à ~500 ms. Une
                  translation dans le repère du segmenté ne voit pas bouger la coque. */}
              <motion.span
                aria-hidden
                initial={false}
                animate={{ x: dark ? '100%' : '0%' }}
                transition={reduit ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
                style={{
                  position: 'absolute', top: 'var(--crm-space-2xs)', bottom: 'var(--crm-space-2xs)',
                  left: 'var(--crm-space-2xs)', width: 'calc(50% - var(--crm-space-2xs))',
                  borderRadius: 'var(--crm-radius-pill)', background: sp.accent,
                }}
              />
              {([false, true] as const).map(v => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setDark(v)}
                  aria-pressed={dark === v}
                  style={{
                    position: 'relative',
                    border: 0, cursor: 'pointer', fontFamily: 'inherit',
                    padding: 'var(--crm-space-2xs) var(--crm-space-sm)',
                    borderRadius: 'var(--crm-radius-pill)',
                    background: 'transparent',
                    color: dark === v ? sp.accentInk : sp.sub,
                    fontSize: 'var(--crm-text-xs)', fontWeight: 600,
                  }}
                >
                  {v ? t('nav.dark') : t('nav.light')}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <Sep sp={sp} />

      <Row sp={sp} iconKind="inline" icon="logout"
        danger
        label={t('nav.logout')}
        onClick={wrap(onLogout)} />
    </div>
  )
}
