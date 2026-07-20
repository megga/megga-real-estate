// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerRack6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.72116 20.9999H17.2788C19.3187 20.9999 20.9726 19.3461 20.9726 17.3061C20.9726 15.2662 19.3187 13.6123 17.2788 13.6123H6.72116C4.68122 13.6123 3.02734 15.2662 3.02734 17.3061C3.02734 19.3461 4.68122 20.9999 6.72116 20.9999Z" stroke="currentColor"></path>
<path d="M6.72116 10.3867H17.2788C19.3187 10.3867 20.9726 8.73278 20.9726 6.69284C20.9726 4.6529 19.3187 3 17.2788 3H6.72116C4.68122 3 3.02734 4.6529 3.02734 6.69284C3.02734 8.73278 4.68122 10.3867 6.72116 10.3867Z" stroke="currentColor"></path>
<path d="M7.39062 17.3057H7.91346" stroke="currentColor"></path>
<path d="M7.39062 6.69336H7.91346" stroke="currentColor"></path>
<path d="M13.1035 17.3057H16.6644" stroke="currentColor"></path>
<path d="M13.1035 6.69336H16.6644" stroke="currentColor"></path>
    </svg>
  ),
)

ServerRack6.displayName = 'ServerRack6'

export default ServerRack6
