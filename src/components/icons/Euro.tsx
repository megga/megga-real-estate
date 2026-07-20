// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Euro = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.7481 17.9953C13.4142 18.0858 11.2232 16.87 10.0661 14.8402C9.07106 13.0772 9.07106 10.9228 10.0661 9.1598C11.2232 7.1308 13.4142 5.91419 15.7481 6.00472" stroke="currentColor"></path>
<path d="M8.25195 13.7611H15.2482" stroke="currentColor"></path>
<path d="M8.25195 10.2402H15.2482" stroke="currentColor"></path>
    </svg>
  ),
)

Euro.displayName = 'Euro'

export default Euro
