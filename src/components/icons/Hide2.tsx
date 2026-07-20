// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Hide2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M21.5 8.0109C19.539 12.139 16.056 14.6155 12.248 14.6155H12.252C8.444 14.6155 4.961 12.139 3 8.0109" stroke="currentColor"></path>
<path d="M18.8398 11.8795L20.951 13.9906" stroke="currentColor"></path>
<path d="M5.5813 11.8795L3.47019 13.9906" stroke="currentColor"></path>
<path d="M15.4268 17.197L14.5823 14.2875" stroke="currentColor"></path>
<path d="M8.99338 17.1973L9.83789 14.2877" stroke="currentColor"></path>
    </svg>
  ),
)

Hide2.displayName = 'Hide2'

export default Hide2
