// MEGGA Marketplace — Property X link (port fidèle du composant 🔗 Links).
//
// Anatomie :
// - Inline-flex, gap 6 (x-small)
// - Texte 16px Objectivity Regular ou Medium, ls -0.48
// - Variants : dark (ink 700 sur fond clair) · light (neutral 300 sur fond ink)
// - Icônes optionnelles à gauche/droite (16×16, arrow ou lock)

import type { ReactNode, MouseEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { PX } from './tokens'

export type PxLinkVariant = 'dark' | 'light'
export type PxLinkWeight = 'regular' | 'medium'

interface BaseProps {
  variant?: PxLinkVariant
  weight?: PxLinkWeight
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  arrow?: boolean    // shortcut : ajoute arrow-right standard à droite
  className?: string
  children: ReactNode
}

interface RouterLinkProps extends BaseProps {
  to: string
  href?: never
  onClick?: never
}

interface AnchorProps extends BaseProps {
  href: string
  target?: '_blank' | '_self'
  to?: never
  onClick?: never
}

interface ButtonProps extends BaseProps {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  to?: never
  href?: never
}

type PxLinkProps = RouterLinkProps | AnchorProps | ButtonProps

function ArrowRight({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8h9M9 4l4 4-4 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function makeStyle(variant: PxLinkVariant, weight: PxLinkWeight): React.CSSProperties {
  const color = variant === 'light' ? PX.neutral300 : PX.neutral700
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    color,
    fontFamily: PX.font.sans,
    fontWeight: weight === 'medium' ? 500 : 400,
    fontSize: 16,
    lineHeight: 1.25,
    letterSpacing: '-0.48px',
    textDecoration: 'none',
    cursor: 'pointer',
    background: 'transparent',
    border: 0,
    padding: 0,
    transition: `opacity ${PX.duration.fast} ${PX.ease}`,
  }
}

export default function PxLink(props: PxLinkProps) {
  const { variant = 'dark', weight = 'regular', leftIcon, rightIcon, arrow, className, children } = props
  const baseStyle = makeStyle(variant, weight)
  const iconColor = variant === 'light' ? PX.neutral300 : PX.neutral700

  const content = (
    <>
      {leftIcon}
      <span style={{ paddingTop: 2 }}>{children}</span>
      {rightIcon}
      {arrow && !rightIcon && <ArrowRight color={iconColor} />}
    </>
  )

  const handlers = {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.opacity = '0.7' },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.opacity = '1' },
  }

  if ('to' in props && props.to) {
    return (
      <RouterLink to={props.to} className={className} style={baseStyle} {...handlers}>
        {content}
      </RouterLink>
    )
  }

  if ('href' in props && props.href) {
    return (
      <a
        href={props.href}
        target={props.target}
        rel={props.target === '_blank' ? 'noopener noreferrer' : undefined}
        className={className}
        style={baseStyle}
        {...handlers}>
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={(props as ButtonProps).onClick}
      className={className}
      style={baseStyle}
      {...handlers}>
      {content}
    </button>
  )
}
