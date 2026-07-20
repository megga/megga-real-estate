// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Download3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.8792 14.791V2.75" stroke="currentColor"></path>
<path d="M14.7951 11.8643L11.8791 14.7923L8.96313 11.8643" stroke="currentColor"></path>
<path d="M16.3702 7.25867C19.9492 7.58867 21.2502 8.92867 21.2502 14.2587C21.2502 21.3587 18.9392 21.3587 12.0002 21.3587C5.05924 21.3587 2.75024 21.3587 2.75024 14.2587C2.75024 8.92867 4.05024 7.58867 7.63024 7.25867" stroke="currentColor"></path>
    </svg>
  ),
)

Download3.displayName = 'Download3'

export default Download3
