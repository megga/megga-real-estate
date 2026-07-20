// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter24 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.0037 21C9.99225 21 9.98372 18.9937 9.98372 15.5995C9.98372 12.2052 3 9.82718 3 6.10082C3 2.95304 5.79029 3.00004 11.9995 3.00004C18.2097 3.00004 21 2.95304 21 6.10082C21 9.82718 14.0173 12.2052 14.0173 15.5995C14.0173 18.9937 14.0141 21 12.0037 21Z" stroke="currentColor"></path>
    </svg>
  ),
)

Filter24.displayName = 'Filter24'

export default Filter24
