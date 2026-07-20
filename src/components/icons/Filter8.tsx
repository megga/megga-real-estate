// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter8 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.98047 18.2329C5.98047 19.3345 6.87351 20.2275 7.97513 20.2275H11.3097C12.4113 20.2275 13.3043 19.3345 13.3043 18.2329V16.7369C13.3043 15.6352 12.4113 14.7422 11.3097 14.7422H7.97513C6.87351 14.7422 5.98047 15.6352 5.98047 16.7369V18.2329Z" stroke="currentColor"></path>
<path d="M18.0214 5.76615C18.0214 4.66453 17.1283 3.77148 16.0267 3.77148H11.3267C10.2251 3.77148 9.33203 4.66453 9.33203 5.76615V7.26215C9.33203 8.36377 10.2251 9.25681 11.3267 9.25681H16.0267C17.1283 9.25681 18.0214 8.36377 18.0214 7.26215V5.76615Z" stroke="currentColor"></path>
<path d="M3 17.4766H5.89464M13.3656 17.4766H20.9998" stroke="currentColor"></path>
<path d="M20.9993 6.52347H18.1047M9.20644 6.52344H3" stroke="currentColor"></path>
    </svg>
  ),
)

Filter8.displayName = 'Filter8'

export default Filter8
