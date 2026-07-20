// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RadarChart3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.7898 3.7338C11.5114 3.2095 12.4886 3.2095 13.2102 3.7338L20.1511 8.77667C20.8728 9.30097 21.1747 10.2303 20.8991 11.0786L18.2479 19.2382C17.9723 20.0865 17.1817 20.6609 16.2897 20.6609H7.71028C6.81829 20.6609 6.02774 20.0865 5.7521 19.2382L3.10091 11.0786C2.82527 10.2303 3.12723 9.30097 3.84887 8.77667L10.7898 3.7338Z" stroke="currentColor"></path>
<path d="M12.0001 3.67575V12.8797M20.7536 10.0356L12.0001 12.8797M17.4101 20.3259L12.0001 12.8797M6.59013 20.3259L12.0001 12.8797M3.24658 10.0356L12.0001 12.8797" stroke="currentColor"></path>
    </svg>
  ),
)

RadarChart3.displayName = 'RadarChart3'

export default RadarChart3
