// MEGGA Marketplace — Property X primary button.
// Port fidèle du composant Buttons (page Components Figma — node 11706:23422).
//
// Anatomie Property X :
// - Pill radius 200px
// - Padding asymétrique : pl-16 (large) + pr-6 (small) ou pr-10 (large)
// - Texte Objectivity Medium 16px, ls -0.48
// - Icône arrow dans un cercle inverse (28px) à droite
// - Variants : primary (bg noir / texte blanc) · invert (bg blanc / texte noir)
// - Sizes : sm (32px height) · lg (40px height)

import type { ReactNode, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { PX } from './tokens'
import PxFigmaIcon from './PxFigmaIcon'

// Tap-down feedback shared across PxButton + PxCircleButton. Mirrors the
// `<Pressable>` atom but kept inline because PxButton renders three different
// elements (button / Link / a) and motion(Link) needs to wrap react-router's
// Link directly. iOS UIButton tap feels approx scale 0.96 with a quick spring.
const TAP_SCALE = 0.96
const TAP_SPRING = { type: 'spring' as const, stiffness: 480, damping: 28, mass: 0.6 }

const MotionLink = motion.create(Link)

export type PxButtonVariant = 'primary' | 'invert' | 'ghost'
export type PxButtonSize = 'sm' | 'lg'

interface BaseProps {
  variant?: PxButtonVariant
  size?: PxButtonSize
  showIcon?: boolean
  icon?: ReactNode  // override default arrow
  className?: string
  children: ReactNode
}

interface ButtonProps extends BaseProps {
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  type?: 'button' | 'submit'
  disabled?: boolean
  to?: never
  href?: never
}

interface LinkInternalProps extends BaseProps {
  to: string
  href?: never
  onClick?: never
}

interface LinkExternalProps extends BaseProps {
  href: string
  target?: '_blank' | '_self'
  to?: never
  onClick?: never
}

type PxButtonProps = ButtonProps | LinkInternalProps | LinkExternalProps

// ─── Default arrow icon (SVG exact Figma — node 11706:23422 imgElement4) ───
function DefaultArrow({ color }: { color: string }) {
  return <PxFigmaIcon name="arrow-right" size={8.4} color={color} />
}

function buttonStyle(variant: PxButtonVariant, size: PxButtonSize): React.CSSProperties {
  const isLarge = size === 'lg'
  const isPrimary = variant === 'primary'
  const isInvert = variant === 'invert'

  // Padding asymétrique Property X : large gauche, petit droite (pour laisser place à l'icône circulaire)
  const padLeft = 16            // numbers/spacings/large
  const padRight = isLarge ? 10 : 6  // numbers/spacings/regular ou x-small
  const padY = isLarge ? 10 : 6

  let bg: string
  let textColor: string
  let extraShadow: string | undefined

  if (isPrimary) {
    bg = PX.neutral700
    textColor = PX.neutral100
  } else if (isInvert) {
    bg = PX.neutral100
    textColor = PX.neutral700
    extraShadow = PX.shadow.small
  } else {
    // ghost
    bg = 'transparent'
    textColor = PX.neutral700
  }

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,                             // numbers/spacings/x-small
    paddingLeft: padLeft,
    paddingRight: padRight,
    paddingTop: padY,
    paddingBottom: padY,
    borderRadius: PX.radius.pill,
    background: bg,
    color: textColor,
    border: 0,
    fontFamily: PX.font.sans,
    fontWeight: 500,
    fontSize: 16,                       // Display/2/Medium
    lineHeight: 1.25,
    letterSpacing: '-0.48px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: extraShadow,
    transition: `transform ${PX.duration.fast} ${PX.ease}, opacity ${PX.duration.fast} ${PX.ease}`,
    textDecoration: 'none',
  }
}

function iconCircleStyle(variant: PxButtonVariant): React.CSSProperties {
  // L'icône est dans un cercle inverse : si bouton noir → cercle blanc, et vice versa.
  const bg = variant === 'primary' ? PX.neutral100 : PX.neutral700
  return {
    width: 28,
    height: 28,
    borderRadius: PX.radius.pill,
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
}

function iconColor(variant: PxButtonVariant): string {
  return variant === 'primary' ? PX.neutral700 : PX.neutral100
}

export default function PxButton(props: PxButtonProps) {
  const {
    variant = 'primary',
    size = 'lg',
    showIcon = true,
    icon,
    className,
    children,
  } = props
  const reducedMotion = useReducedMotion()

  const baseStyle = buttonStyle(variant, size)
  const isGhost = variant === 'ghost'
  const isDisabled = 'disabled' in props ? props.disabled : false
  const tap = reducedMotion || isDisabled ? undefined : { scale: TAP_SCALE }

  const content = (
    <>
      {/* Texte avec léger padding-top 2px (proto Figma : pt-xx-small) */}
      <span style={{ paddingTop: 2, display: 'inline-block' }}>{children}</span>
      {showIcon && !isGhost && (
        <span style={iconCircleStyle(variant)}>
          {icon ?? <DefaultArrow color={iconColor(variant)} />}
        </span>
      )}
      {showIcon && isGhost && icon}
    </>
  )

  if ('to' in props && props.to) {
    return (
      <MotionLink
        to={props.to}
        className={className}
        style={baseStyle}
        whileTap={tap}
        transition={TAP_SPRING}
      >
        {content}
      </MotionLink>
    )
  }

  if ('href' in props && props.href) {
    return (
      <motion.a
        href={props.href}
        target={props.target}
        rel={props.target === '_blank' ? 'noopener noreferrer' : undefined}
        className={className}
        style={baseStyle}
        whileTap={tap}
        transition={TAP_SPRING}
      >
        {content}
      </motion.a>
    )
  }

  return (
    <motion.button
      type={(props as ButtonProps).type || 'button'}
      onClick={(props as ButtonProps).onClick}
      disabled={(props as ButtonProps).disabled}
      className={className}
      whileTap={tap}
      transition={TAP_SPRING}
      style={{
        ...baseStyle,
        opacity: (props as ButtonProps).disabled ? 0.5 : 1,
      }}>
      {content}
    </motion.button>
  )
}

// ─── Backwards-compat exports (PxArrowRight from old API) ──────────
export function PxArrowRight({ color = 'currentColor' }: { size?: number; color?: string }) {
  return <DefaultArrow color={color} />
}

// ─── Circle icon button (variant of the DS PrimaryCircleButton) ─────
// Rond simple avec icône centrée. Pour nav arrows, fermer, etc.
interface PxCircleButtonProps {
  size?: 'sm' | 'lg'
  variant?: 'dark' | 'light'
  children: ReactNode
  onClick?: () => void
  ariaLabel?: string
}

export function PxCircleButton({
  size = 'sm', variant = 'dark', children, onClick, ariaLabel,
}: PxCircleButtonProps) {
  const reducedMotion = useReducedMotion()
  const dim = size === 'lg' ? 40 : 32
  const bg = variant === 'dark' ? PX.neutral700 : PX.neutral100
  const shadow = variant === 'light' ? PX.shadow.small : undefined

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      whileTap={reducedMotion ? undefined : { scale: TAP_SCALE }}
      transition={TAP_SPRING}
      style={{
        width: dim,
        height: dim,
        borderRadius: PX.radius.pill,
        background: bg,
        border: 0,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: shadow,
      }}>
      {children}
    </motion.button>
  )
}
