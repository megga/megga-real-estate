// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Setting22 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle cx="12.2507" cy="12.1386" r="2.8499" transform="rotate(90 12.2507 12.1386)" stroke="currentColor" strokeLinecap="round"></circle>
<path d="M22.25 12.1386L17.25 20.7989H7.25L2.25 12.1386L7.25 3.47839L17.25 3.47839L22.25 12.1386Z" stroke="currentColor" strokeLinecap="square"></path>
    </svg>
  ),
)

Setting22.displayName = 'Setting22'

export default Setting22
