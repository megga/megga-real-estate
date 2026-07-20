// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerRack4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.93739 20.9999H18.0626C19.6697 20.9999 20.9726 19.6971 20.9726 18.0899V16.5223C20.9726 14.9152 19.6697 13.6123 18.0626 13.6123H5.93739C4.33021 13.6123 3.02734 14.9152 3.02734 16.5223V18.0899C3.02734 19.6971 4.33021 20.9999 5.93739 20.9999Z" stroke="currentColor"></path>
<path d="M7.39062 17.3057H7.91346M13.1027 17.3057H16.6636" stroke="currentColor"></path>
<path d="M5.93739 10.3867H18.0626C19.6697 10.3867 20.9726 9.08379 20.9726 7.47662V5.91004C20.9726 4.30287 19.6697 3 18.0626 3H5.93739C4.33021 3 3.02734 4.30287 3.02734 5.91004V7.47661C3.02734 9.08379 4.33021 10.3867 5.93739 10.3867Z" stroke="currentColor"></path>
<path d="M7.39062 6.69336H7.91346M13.1027 6.69336H16.6636" stroke="currentColor"></path>
    </svg>
  ),
)

ServerRack4.displayName = 'ServerRack4'

export default ServerRack4
