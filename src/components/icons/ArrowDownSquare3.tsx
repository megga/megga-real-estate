// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ArrowDownSquare3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12 16.0861V7.91406" stroke="currentColor"></path>
<path d="M15.752 12.3218C15.752 12.3218 13.224 16.0858 12 16.0858C10.776 16.0858 8.25195 12.3218 8.25195 12.3218" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M2.75 12.0001C2.75 18.9371 5.063 21.2501 12 21.2501C18.937 21.2501 21.25 18.9371 21.25 12.0001C21.25 5.06312 18.937 2.75012 12 2.75012C5.063 2.75012 2.75 5.06312 2.75 12.0001Z" stroke="currentColor"></path>
    </svg>
  ),
)

ArrowDownSquare3.displayName = 'ArrowDownSquare3'

export default ArrowDownSquare3
