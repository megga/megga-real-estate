// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ExternalLink = forwardRef<SVGSVGElement, Props>(
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
      <path d="M10.2311 5H7.25067C4.63822 5 3 6.84978 3 9.46756V16.5324C3 19.1502 4.63022 21 7.25067 21H14.7476C17.3689 21 19 19.1502 19 16.5324V13.9849" stroke="currentColor"></path>
<path d="M21 8.13166V3M21 3H15.8684M21 3L13 11" stroke="currentColor"></path>
    </svg>
  ),
)

ExternalLink.displayName = 'ExternalLink'

export default ExternalLink
