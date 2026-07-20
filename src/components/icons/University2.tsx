// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const University2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.6312 3.42609L3.31038 8.79787C3.11676 8.92338 3 9.13841 3 9.369V10.0345C3 10.4101 3.30454 10.7146 3.67914 10.7146H20.3199C20.6955 10.7146 21 10.4101 21 10.0345V9.369C21 9.13841 20.8823 8.92338 20.6887 8.79787L12.3688 3.42609C12.144 3.28111 11.856 3.28111 11.6312 3.42609Z" stroke="currentColor"></path>
<path d="M3 20.6826H21" stroke="currentColor"></path>
<path d="M10.4683 7.71387H13.5302" stroke="currentColor"></path>
<path d="M14.932 10.7144V20.6825M18.8258 10.7144V20.6825M5.17188 10.7144V20.6825M9.06567 10.7144V20.6825" stroke="currentColor"></path>
    </svg>
  ),
)

University2.displayName = 'University2'

export default University2
