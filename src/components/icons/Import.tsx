// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Import = forwardRef<SVGSVGElement, Props>(
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
      <path d="M2.99986 12C2.99986 16.9706 7.02933 21.0001 11.9999 21.0001C16.9705 21.0001 21 16.9706 21 12" stroke="currentColor"></path>
<path d="M12 2.99992L12 14.25M12 14.25L15.375 10.875M12 14.25L8.62495 10.875" stroke="currentColor"></path>
    </svg>
  ),
)

Import.displayName = 'Import'

export default Import
