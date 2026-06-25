import type { CSSProperties, ReactNode } from 'react'
import Sheet from '@/components/ui/Sheet'
import { useMobileTokens } from '../useMobileTokens'

interface SgSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
  /**
   * Marge basse en px pour flotter au-dessus de la barre d'onglets (défaut
   * 94). Sur une vue détail (sans barre), passer ~12.
   */
  bottomGap?: number
  /** Hauteur max en fraction du viewport (défaut 0.78). */
  maxHeightVh?: number
}

/**
 * Grande feuille scrollable Sugar (détails, filtres, drilldowns, galeries).
 * Re-skin du primitive prod `ui/Sheet` (side="bottom") par composition —
 * AUCUNE modification de `Sheet.tsx` (sinon fuite de tokens vers le desktop).
 * On hérite ainsi de la mécanique éprouvée : portal, ressort iOS, verrou de
 * scroll, Échap, `prefers-reduced-motion`, drag-to-dismiss, poignée en haut.
 * La feuille épouse le bas au-dessus de la pilule de nav.
 */
export default function SgSheet({
  open,
  onClose,
  children,
  ariaLabel,
  bottomGap = 94,
  maxHeightVh = 0.78,
}: SgSheetProps) {
  const { tk } = useMobileTokens()
  const panelStyle: CSSProperties = {
    background: tk.card,
    borderRadius: 22,
    boxShadow: tk.shadowLg,
    bottom: `calc(${bottomGap}px + env(safe-area-inset-bottom))`,
    maxHeight: `${Math.round(maxHeightVh * 100)}vh`,
    overflowY: 'auto',
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="bottom"
      ariaLabel={ariaLabel}
      className="absolute left-3 right-3"
      style={panelStyle}
    >
      {children}
    </Sheet>
  )
}
