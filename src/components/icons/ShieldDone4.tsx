// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldDone4 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M19.3237 13.6284C19.3237 19.7416 12.0001 21.959 12.0001 21.959C12.0001 21.959 4.67654 19.7426 4.67654 13.6284C4.67654 7.51419 4.40994 7.03648 4.99762 6.44878C5.58627 5.86018 11.0398 3.95898 12.0001 3.95898C12.9604 3.95898 18.4149 5.85528 19.0026 6.44878C19.5893 7.04138 19.3237 7.51519 19.3237 13.6284Z" stroke="currentColor"></path>
<path d="M9.51855 12.6698L11.3244 14.4785L15.046 10.7559" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldDone4.displayName = 'ShieldDone4'

export default ShieldDone4
