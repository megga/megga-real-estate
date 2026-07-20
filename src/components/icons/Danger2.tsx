// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Danger2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M21.5 20.3478L21.1369 20.8249H3.32881L3.00002 20.3478L12.1794 4.24451H12.3255L21.5 20.3478Z" stroke="currentColor" strokeLinecap="round"></path>
<path d="M12.2677 14.5507V11.7496" stroke="currentColor" strokeLinecap="square"></path>
<path d="M12.2612 17.3383H12.2703" stroke="currentColor" strokeLinecap="square"></path>
    </svg>
  ),
)

Danger2.displayName = 'Danger2'

export default Danger2
