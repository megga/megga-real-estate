// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Location = forwardRef<SVGSVGElement, Props>(
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
      <g id="Iconly/Light/Location" stroke="none" fill="none" fillRule="evenodd"> <g id="Location" transform="translate(4.500000, 3.000000)" stroke="currentColor"> <path d="M10,7.50050782 C10,6.11923624 8.88076376,5 7.50050782,5 C6.11923624,5 5,6.11923624 5,7.50050782 C5,8.88076376 6.11923624,10 7.50050782,10 C8.88076376,10 10,8.88076376 10,7.50050782 Z" id="Stroke-1"></path> <path d="M7.49951162,18 C6.30103536,18 0,12.8983747 0,7.5632901 C0,3.38663602 3.357101,0 7.49951162,0 C11.6419223,0 15,3.38663602 15,7.5632901 C15,12.8983747 8.69798789,18 7.49951162,18 Z" id="Stroke-3"></path> </g> </g>
    </svg>
  ),
)

Location.displayName = 'Location'

export default Location
