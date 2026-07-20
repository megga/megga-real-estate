// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ConnectedCableCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.364 5.80401C21.8787 9.31873 21.8787 15.0172 18.364 18.5319C14.8492 22.0466 9.15076 22.0466 5.63604 18.5319C2.12132 15.0172 2.12132 9.31873 5.63604 5.80401C9.15076 2.28929 14.8492 2.28929 18.364 5.80401Z" stroke="currentColor"></path>
<path d="M10.1553 10.2872L11.242 9.20051C12.2228 8.21962 13.8132 8.21962 14.7941 9.20051C15.7749 10.1814 15.7749 11.7717 14.7941 12.7526L13.7074 13.8393" stroke="currentColor"></path>
<path d="M14.7969 9.19729L18.2246 5.76953" stroke="currentColor"></path>
<path d="M13.6977 13.8607L12.611 14.9474C11.6301 15.9283 10.0398 15.9283 9.05891 14.9474C8.07802 13.9665 8.07802 12.3761 9.05891 11.3953L10.1456 10.3086" stroke="currentColor"></path>
<path d="M14.124 14.2704L9.72852 9.87493" stroke="currentColor"></path>
<path d="M9.05785 14.9492L5.58984 18.4172" stroke="currentColor"></path>
<path d="M17.085 14.0586L18.0704 14.3227" stroke="currentColor"></path>
<path d="M13.8477 17.2031L14.2089 18.1573" stroke="currentColor"></path>
<path d="M5.77441 9.82031L6.75989 10.0844" stroke="currentColor"></path>
<path d="M9.63574 5.98438L9.99695 6.93853" stroke="currentColor"></path>
    </svg>
  ),
)

ConnectedCableCircle.displayName = 'ConnectedCableCircle'

export default ConnectedCableCircle
