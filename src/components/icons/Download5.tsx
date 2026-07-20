// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Download5 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.5075 8.34741H17.4156C19.395 8.34741 21 9.95237 21 11.9318V16.6846C21 18.659 19.399 20.26 17.4236 20.26H6.58538C4.60496 20.26 3 18.655 3 16.6746V11.9218C3 9.94737 4.60096 8.34741 6.57537 8.34741H7.49149" stroke="currentColor"></path>
<path d="M12.0015 15.4575V3.74219M12.0015 15.4575L14.838 12.609M12.0015 15.4575L9.16406 12.609" stroke="currentColor"></path>
    </svg>
  ),
)

Download5.displayName = 'Download5'

export default Download5
