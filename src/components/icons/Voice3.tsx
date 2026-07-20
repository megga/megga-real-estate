// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Voice3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.36487 13.6783C6.36487 16.8093 8.90287 19.3473 12.0339 19.3473C15.1659 19.3473 17.7039 16.8093 17.7039 13.6783" stroke="currentColor"></path>
<path d="M17.7037 10.423V8.169C17.7037 5.038 15.1657 2.5 12.0337 2.5C8.90275 2.5 6.36475 5.038 6.36475 8.169V10.423" stroke="currentColor"></path>
<path d="M12.0338 21.4997V19.3477" stroke="currentColor"></path>
<path d="M4.90002 13.6783H19.168" stroke="currentColor"></path>
    </svg>
  ),
)

Voice3.displayName = 'Voice3'

export default Voice3
