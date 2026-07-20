// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Unarchive = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
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
      <path d="M21 16.2178V7.78313C21 4.83503 18.9188 3 15.9736 3H8.02638C5.08119 3 3 4.83503 3 7.78411V16.2178C3 19.1659 5.08119 21 8.02638 21H15.9736C18.9188 21 21 19.1572 21 16.2178Z" stroke="currentColor"></path>
<path d="M15 10L11.9982 7L9 10" stroke="currentColor"></path>
<path d="M11.998 7V14" stroke="currentColor"></path>
<path d="M20.9336 17H3.05859" stroke="currentColor"></path>
    </svg>
  ),
)

Unarchive.displayName = 'Unarchive'

export default Unarchive
