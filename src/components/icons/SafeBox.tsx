// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SafeBox = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.63696 6.25711L6.93298 7.55411M12 3.62109V5.4541V3.62109ZM21 12.6211H19.167H21ZM12 21.6211V19.7871V21.6211ZM3 12.6211H4.83398H3ZM18.365 6.25711L17.068 7.55411L18.365 6.25711ZM5.63696 18.9851L6.93298 17.6881L5.63696 18.9851ZM18.365 18.9851L17.068 17.6881L18.365 18.9851Z" stroke="currentColor"></path>
<path d="M21 12.6211C21 7.65009 16.971 3.62109 12 3.62109C7.029 3.62109 3 7.65009 3 12.6211C3 17.5921 7.029 21.6211 12 21.6211C16.971 21.6211 21 17.5921 21 12.6211Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.0023 9.02344C13.9883 9.02344 15.5983 10.6334 15.5983 12.6194C15.5983 14.6054 13.9883 16.2155 12.0023 16.2155C10.0163 16.2155 8.40625 14.6054 8.40625 12.6194C8.40625 10.6334 10.0163 9.02344 12.0023 9.02344Z" stroke="currentColor"></path>
<path d="M12.1914 12.3171L14.4734 10.0352" stroke="currentColor"></path>
    </svg>
  ),
)

SafeBox.displayName = 'SafeBox'

export default SafeBox
