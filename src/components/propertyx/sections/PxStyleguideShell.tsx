// MEGGA Marketplace — Property X Design System styleguide shell.
// Source : Figma node 11706:23422 (et autres pages /design-system/*).
//
// Wrapper partagé pour TOUTES les pages /design-system/* — gère :
//   - Outer card light gray rounded-24 avec shadow
//   - Sidebar nav 246px avec 10 items (Logo / Buttons / Links / Badges / ...)
//   - Page title en haut du main pane (icône + texte + divider)
//   - Slot `children` pour le contenu spécifique de chaque page
//
// Les pages spécifiques (`PxButtonsStyleGuide`, `PxLinksStyleGuide`, etc.)
// fournissent `selected`, `title`, `iconName` et le contenu sections via children.
//
// Icônes sidebar : /public/icons/figma/ds-sidebar/*.svg

import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { PX, PxLogo, PxFigmaIcon } from '..'

// ─── Type de chaque item de nav (Components + Basic Styles) ────────────
export type PxStyleguideKey =
  // Components
  | 'logo'
  | 'buttons'
  | 'links'
  | 'badges'
  | 'lists'
  | 'icons'
  | 'iconfonts'
  | 'avatars'
  | 'inputs'
  | 'images'
  // Basic Styles
  | 'colors'
  | 'typography'
  | 'shadows'

interface NavItemDef {
  key: PxStyleguideKey
  icon: string
  label: string
  route: string | null   // null = pas encore implémenté
}

// ─── Components (10 items) ───────────────────────────────────────────
const COMPONENTS_ITEMS: ReadonlyArray<NavItemDef> = [
  { key: 'logo',      icon: 'logo',          label: 'Logo',       route: null },
  { key: 'buttons',   icon: 'buttons-small', label: 'Buttons',    route: '/design-system/buttons' },
  { key: 'links',     icon: 'links',         label: 'Links',      route: '/design-system/links' },
  { key: 'badges',    icon: 'badges',        label: 'Badges',     route: '/design-system/badges' },
  { key: 'lists',     icon: 'lists',         label: 'Lists',      route: '/design-system/lists' },
  { key: 'icons',     icon: 'icons',         label: 'Icons',      route: '/design-system/icons' },
  { key: 'iconfonts', icon: 'iconfonts',     label: 'Icon Fonts', route: '/design-system/iconfonts' },
  { key: 'avatars',   icon: 'avatars',       label: 'Avatars',    route: '/design-system/avatars' },
  { key: 'inputs',    icon: 'inputs',        label: 'Inputs',     route: '/design-system/inputs' },
  { key: 'images',    icon: 'images',        label: 'Images',     route: null },
]

// ─── Basic Styles (3 items) ──────────────────────────────────────────
const BASIC_STYLES_ITEMS: ReadonlyArray<NavItemDef> = [
  { key: 'colors',     icon: 'colors',     label: 'Colors',     route: '/design-system/colors' },
  { key: 'typography', icon: 'typography', label: 'Typography', route: '/design-system/typography' },
  { key: 'shadows',    icon: 'shadows',    label: 'Shadows',    route: '/design-system/shadows' },
]

// ─── Sidebar icon wrapper (img avec drop-shadow Figma) ─────────────────
function SidebarIconImg({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        flexShrink: 0,
        filter: 'drop-shadow(0px 1px 1px rgba(20, 22, 28, 0.15))',
      }}
    >
      <img
        src={`/icons/figma/ds-sidebar/${name}.svg`}
        alt=""
        style={{ width: size, height: size, display: 'block' }}
      />
    </span>
  )
}

// ─── Single nav item ─────────────────────────────────────────────────
function NavItem({
  iconName,
  label,
  selected,
  route,
}: {
  iconName: string
  label: string
  selected: boolean
  route: string | null
}) {
  const inner = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 246,
        padding: 12,
        background: PX.neutral100,
        border: selected ? `1px solid ${PX.neutral700}` : '1px solid transparent',
        borderRadius: PX.radius.tiny,
        overflow: 'hidden',
        textDecoration: 'none',
        cursor: route ? 'pointer' : 'default',
        opacity: route || selected ? 1 : 0.85,
      }}
    >
      <SidebarIconImg name={iconName} />
      <p
        style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: selected ? 500 : 400,
          fontSize: 14,
          lineHeight: 1.25,
          letterSpacing: '-0.42px',
          color: PX.neutral700,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </p>
    </div>
  )

  if (route) {
    return <RouterLink to={route} style={{ textDecoration: 'none' }}>{inner}</RouterLink>
  }
  return inner
}

// ─── Helper : underline title (pour les sections internes) ────────────
export function PxStyleguideSectionTitle({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 564 }}>
      <p
        style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 20,
          lineHeight: 1.25,
          letterSpacing: '-0.6px',
          color: PX.neutral700,
        }}
      >
        {title}
      </p>
      <div style={{ height: 0, width: '100%', borderTop: `1.5px solid ${PX.neutral300}` }} />
    </div>
  )
}

// ─── Helper : showcase frame (cadre pointillé contenant les variantes) ─
export function PxStyleguideShowcase({
  children,
  style,
}: {
  children: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        padding: 40,
        border: `1px dashed ${PX.neutral400}`,
        borderRadius: PX.radius.medium,
        width: 540,
        minHeight: 140,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Main shell ──────────────────────────────────────────────────────
interface PxStyleguideShellProps {
  selected: PxStyleguideKey
  title: string
  iconName: string          // ds-sidebar/<iconName>.svg pour le page title (ex: 'buttons-regular')
  /** 'components' = Components section expanded + badge "Components" (default)
   *  'styles'     = Basic Styles section expanded + badge "Styles" */
  tab?: 'components' | 'styles'
  children: ReactNode
}

// ─── Helper : section header (titre uppercase + chevron up/down) ──────
function SectionHeader({ label, expanded }: { label: string; expanded: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        width: '100%',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 14,
          lineHeight: 1.25,
          letterSpacing: '-0.42px',
          color: PX.neutral400,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </p>
      <span style={{ width: 20, height: 20, display: 'inline-flex', color: PX.neutral400, transform: expanded ? 'rotate(180deg)' : 'none' }}>
        <PxFigmaIcon name="chevron-down" size={12} color={PX.neutral400} />
      </span>
    </div>
  )
}

export default function PxStyleguideShell({
  selected,
  title,
  iconName,
  tab = 'components',
  children,
}: PxStyleguideShellProps) {
  const stylesExpanded = tab === 'styles'
  const componentsExpanded = tab === 'components'
  const badgeText = tab === 'styles' ? 'Styles' : 'Components'
  return (
    <>
      {/* Bannière "Internal" — rappelle que ces pages sont une référence interne, pas client-facing */}
      <div
        role="note"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 16px',
          marginBottom: 16,
          background: PX.neutral700,
          color: PX.neutral100,
          borderRadius: PX.radius.tiny,
          fontFamily: PX.font.sans,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.39px',
          textAlign: 'center',
        }}
      >
        <span style={{ opacity: 0.6 }}>🔒 Internal —</span>
        <span>Design System Property X · source de vérité pour tout composant / page du marketplace</span>
      </div>
      <section
        style={{
          background: PX.neutral200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          overflow: 'hidden',
          paddingLeft: 20,
          paddingRight: 32,
          paddingTop: 20,
          paddingBottom: 20,
          borderRadius: PX.radius.large,
          boxShadow: PX.shadow.regular,
          width: '100%',
          minHeight: '100vh',
        }}
      >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 40,
          width: '100%',
          flex: 1,
        }}
      >
        {/* ─── Sidebar (DS UI Kit nav) ─── */}
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 24,
            padding: 24,
            background: PX.neutral100,
            borderRadius: PX.radius.small,
            filter: 'drop-shadow(0px 4px 4px rgba(0, 19, 88, 0.10))',
            alignSelf: 'stretch',
          }}
        >
          {/* Info heading */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <PxLogo variant="dark" form="text" size="sm" />
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: PX.neutral200,
                  border: `1px solid ${PX.neutral500}`,
                  borderRadius: PX.radius.small,
                  boxShadow: '0 2px 2px 0 rgba(20, 22, 28, 0.15)',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: PX.font.sans,
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: 1.25,
                    letterSpacing: '-0.42px',
                    color: PX.neutral700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {badgeText}
                </p>
              </div>
            </div>
            <div style={{ paddingTop: 24, width: '100%' }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: PX.font.sans,
                  fontWeight: 400,
                  fontSize: 14,
                  lineHeight: 1.5,
                  letterSpacing: '-0.42px',
                  color: PX.neutral500,
                }}
              >
                Browse all the basic styles and components inside this UI Kit
              </p>
            </div>
          </div>

          <div style={{ height: 0, width: 246, borderTop: `1px solid ${PX.neutral300}` }} />

          {/* ─── Basic Styles section ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 246 }}>
            <SectionHeader label="Basic Styles" expanded={stylesExpanded} />
            {stylesExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                {BASIC_STYLES_ITEMS.map(item => (
                  <NavItem
                    key={item.key}
                    iconName={item.icon}
                    label={item.label}
                    selected={item.key === selected}
                    route={item.route}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ─── Components section ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 246 }}>
            <SectionHeader label="Components" expanded={componentsExpanded} />
            {componentsExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                {COMPONENTS_ITEMS.map(item => (
                  <NavItem
                    key={item.key}
                    iconName={item.icon}
                    label={item.label}
                    selected={item.key === selected}
                    route={item.route}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 160,
            minWidth: 0,
          }}
        >
          {/* Page title wrapper */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              paddingTop: 24,
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
              <SidebarIconImg name={iconName} size={22} />
              <p
                style={{
                  margin: 0,
                  fontFamily: PX.font.sans,
                  fontWeight: 500,
                  fontSize: 24,
                  lineHeight: 1.25,
                  letterSpacing: '-0.72px',
                  color: PX.neutral700,
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </p>
            </div>
            <div style={{ height: 0, width: '100%', borderTop: `1.5px solid ${PX.neutral300}` }} />
          </div>

          {/* Sections (children) — pt-80 (mg-3x-extra-large) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 40,
              paddingTop: 80,
              width: '100%',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </section>
    </>
  )
}
