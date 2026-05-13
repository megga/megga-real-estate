// MEGGA Marketplace — Property X pill button.
// Style : ronds (border-radius 999px), 14/16px padding, font 14/600.
// Variants : "primary" (fond noir, texte blanc) · "secondary" (fond blanc,
// border subtile, texte noir) · "ghost" (transparent, texte noir, underline
// au hover).

import type { ReactNode, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { PX } from './tokens'

export type PxButtonVariant = 'primary' | 'secondary' | 'ghost' | 'invert'
export type PxButtonSize = 'sm' | 'md' | 'lg'

interface BaseProps {
  variant?: PxButtonVariant
  size?: PxButtonSize
  trail?: ReactNode    // icon/arrow on the right
  lead?: ReactNode     // icon on the left
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

function styles(variant: PxButtonVariant, size: PxButtonSize): React.CSSProperties {
  const sizing = size === 'lg'
    ? { padding: '14px 22px', fontSize: 14, gap: 8 }
    : size === 'sm'
      ? { padding: '8px 14px', fontSize: 12.5, gap: 6 }
      : { padding: '11px 18px', fontSize: 14, gap: 7 }

  const variantStyle: Record<PxButtonVariant, React.CSSProperties> = {
    primary: {
      background: PX.ink,
      color: PX.inkInverse,
      border: 0,
      boxShadow: PX.shadow.pillBlack,
    },
    secondary: {
      background: PX.surfaceBg,
      color: PX.ink,
      border: `1px solid ${PX.border}`,
      boxShadow: PX.shadow.soft,
    },
    ghost: {
      background: 'transparent',
      color: PX.ink,
      border: 0,
    },
    invert: {
      background: PX.surfaceBg,
      color: PX.ink,
      border: 0,
      boxShadow: PX.shadow.pillWhite,
    },
  }

  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: PX.radiusPill,
    fontFamily: PX.font.sans,
    fontWeight: PX.type.cta.weight,
    letterSpacing: 0,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: `transform ${PX.duration.fast} ${PX.ease}, box-shadow ${PX.duration.fast} ${PX.ease}, background ${PX.duration.fast} ${PX.ease}`,
    ...sizing,
    ...variantStyle[variant],
  }
}

export default function PxButton(props: PxButtonProps) {
  const { variant = 'primary', size = 'md', trail, lead, className, children } = props
  const baseStyle = styles(variant, size)

  const content = (
    <>
      {lead}
      <span>{children}</span>
      {trail}
    </>
  )

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={className} style={baseStyle}>
        {content}
      </Link>
    )
  }

  if ('href' in props && props.href) {
    return (
      <a href={props.href} target={props.target} rel={props.target === '_blank' ? 'noopener noreferrer' : undefined} className={className} style={baseStyle}>
        {content}
      </a>
    )
  }

  return (
    <button
      type={(props as ButtonProps).type || 'button'}
      onClick={(props as ButtonProps).onClick}
      disabled={(props as ButtonProps).disabled}
      className={className}
      style={{
        ...baseStyle,
        opacity: (props as ButtonProps).disabled ? 0.5 : 1,
      }}>
      {content}
    </button>
  )
}

// ─── Arrow icon (utilisé comme trail dans les CTAs) ──────────────────
export function PxArrowRight({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
