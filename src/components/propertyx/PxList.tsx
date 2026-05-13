// MEGGA Marketplace — Property X list (port fidèle du pattern Links Items observé
// dans les sidebars 🎛️ Lists).
//
// Anatomie :
// - Container vertical, gap 8
// - Item : flex row, gap 12, padding 12, radius 8 (tiny), bg white
// - Active : border 1px solid ink (neutral 700)
// - Hover : light bg
// - Icon left (16×16 dans wrapper 22×22) + label (14px Regular / Medium si active)

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PX } from './tokens'

// ─── PxList (container) ─────────────────────────────────────────────
interface PxListProps {
  children: ReactNode
  gap?: number
  className?: string
}

export function PxList({ children, gap = 8, className }: PxListProps) {
  return (
    <ul
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        listStyle: 'none',
        padding: 0,
        margin: 0,
      }}>
      {children}
    </ul>
  )
}

// ─── PxListItem ────────────────────────────────────────────────────
interface PxListItemBaseProps {
  leftIcon?: ReactNode
  rightSlot?: ReactNode
  active?: boolean
  children: ReactNode
}

interface PxListItemLinkProps extends PxListItemBaseProps {
  to: string
  onClick?: never
}

interface PxListItemButtonProps extends PxListItemBaseProps {
  onClick: () => void
  to?: never
}

interface PxListItemStaticProps extends PxListItemBaseProps {
  to?: never
  onClick?: never
}

type PxListItemProps = PxListItemLinkProps | PxListItemButtonProps | PxListItemStaticProps

function itemStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: PX.radius.tiny,
    background: PX.neutral100,
    border: active ? `1px solid ${PX.neutral700}` : '1px solid transparent',
    fontFamily: PX.font.sans,
    fontWeight: active ? 500 : 400,
    fontSize: 14,
    lineHeight: 1.25,
    letterSpacing: '-0.42px',
    color: PX.neutral700,
    textDecoration: 'none',
    cursor: 'pointer',
    width: '100%',
    transition: `background ${PX.duration.fast} ${PX.ease}`,
  }
}

export function PxListItem(props: PxListItemProps) {
  const { leftIcon, rightSlot, active = false, children } = props
  const style = itemStyle(active)

  const inner = (
    <>
      {leftIcon && (
        <span style={{
          width: 22, height: 22,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: PX.neutral700,
        }}>
          {leftIcon}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>{children}</span>
      {rightSlot}
    </>
  )

  if ('to' in props && props.to) {
    return (
      <li>
        <Link to={props.to} style={style}>{inner}</Link>
      </li>
    )
  }

  if ('onClick' in props && props.onClick) {
    return (
      <li>
        <button type="button" onClick={props.onClick} style={style}>{inner}</button>
      </li>
    )
  }

  return (
    <li style={style}>{inner}</li>
  )
}
