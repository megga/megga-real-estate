// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DoNotTouch = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.1683 18.5C19.3899 16.6802 19.9527 13.8731 19.1374 11.6721C18.1864 9.10538 14.7811 9.22671 12.4294 9.00213L12.3626 4.65463C12.3485 3.73672 11.6004 3 10.6824 3C9.75431 3 9.00195 3.75236 9.00195 4.68044V8.5" stroke="currentColor"></path>
<path d="M4.5 4.08984L20.1706 20.6128" stroke="currentColor"></path>
<path d="M9.00137 14.3202L7.79917 12.576C7.31774 11.8775 6.42066 11.5995 5.6286 11.9033C4.73383 12.2465 4.25481 13.2182 4.58125 14.1192C5.18991 15.7992 6.15551 17.6742 7.39785 19.2191C9.00456 21.2171 13.3203 21.4658 15.9991 20.3079" stroke="currentColor"></path>
    </svg>
  ),
)

DoNotTouch.displayName = 'DoNotTouch'

export default DoNotTouch
