/**
 * Coque racine du CRM mobile : enveloppe partagée que montent tous les écrans
 * mobiles (crm-mobile/shell), avec ou sans barre d'onglets selon `variant`.
 */
import type { ReactNode } from 'react'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import MobileTabBar from './MobileTabBar'

interface MobileShellProps {
  children: ReactNode
  /** 'tabs' (barre d'onglets flottante) | 'detail' (sans barre). Défaut 'tabs'. */
  variant?: 'tabs' | 'detail'
  /** En-tête partagé optionnel (ex. <MobileHeaderBack/>) ; sinon l'écran fournit le sien. */
  header?: ReactNode
}

/**
 * Coque mobile : fond canvas Sugar Pure + police Manrope + zone scrollable
 * dégagée au-dessus de la pilule fixe (padding-bottom safe-area). La barre
 * d'onglets n'apparaît qu'en variant 'tabs'. Le desktop ne monte JAMAIS cette
 * coque (sélection via ResponsiveRoute, fichiers séparés) → zéro régression.
 */
export default function MobileShell({ children, variant = 'tabs', header }: MobileShellProps) {
  const { tk } = useMobileTokens()
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: tk.canvas,
        color: tk.ink,
        fontFamily: MOBILE_FONT,
        WebkitFontSmoothing: 'antialiased',
        position: 'relative',
      }}
    >
      {header}
      <main
        style={{
          paddingBottom:
            variant === 'tabs'
              ? 'calc(94px + env(safe-area-inset-bottom))'
              : 'calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>
      {variant === 'tabs' ? <MobileTabBar /> : null}
    </div>
  )
}
