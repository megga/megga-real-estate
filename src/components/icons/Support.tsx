// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Support = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12 21.6211C16.971 21.6211 21 17.5911 21 12.6211C21 7.65009 16.971 3.62109 12 3.62109C7.029 3.62109 3 7.65009 3 12.6211C3 17.5911 7.029 21.6211 12 21.6211Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.13 12.6202C16.13 14.9002 14.282 16.7482 12.002 16.7482C9.72201 16.7482 7.87305 14.9002 7.87305 12.6202C7.87305 10.3402 9.72201 8.49219 12.002 8.49219C14.282 8.49219 16.13 10.3402 16.13 12.6202Z" stroke="currentColor"></path>
<path d="M9.08472 15.5352L5.63672 18.9832" stroke="currentColor"></path>
<path d="M14.9199 15.5391L18.3659 18.9851" stroke="currentColor"></path>
<path d="M5.63672 6.25781L9.08374 9.7048" stroke="currentColor"></path>
<path d="M14.9199 9.70282L18.3649 6.25781" stroke="currentColor"></path>
    </svg>
  ),
)

Support.displayName = 'Support'

export default Support
