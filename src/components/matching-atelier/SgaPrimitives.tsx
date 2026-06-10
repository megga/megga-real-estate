// Atelier Matching — placeholder photo partagé (rayures subtiles + label mono).
// Les mappings/constantes vivent dans ./constants (contrainte react-refresh).

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import SgaIcon, { type SgaIconName } from './SgaIcon'

interface SgaPhotoProps {
  label?: string
  icon?: SgaIconName
  iconSize?: number
  children?: ReactNode
  className?: string
  style?: CSSProperties
  onClick?: MouseEventHandler<HTMLDivElement>
}

export function SgaPhoto({ label, icon = 'camera', iconSize = 22, children, className, style, onClick }: SgaPhotoProps) {
  return (
    <div className={className} style={style} onClick={onClick}>
      <div className="sga-ph">
        <div className="ph-lbl">
          <SgaIcon d={icon} size={iconSize} />
          {label && <span>{label}</span>}
        </div>
      </div>
      {children}
    </div>
  )
}
