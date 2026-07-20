// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Dashboard4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.9484 17.7303C18.9396 17.7303 18.9484 17.7215 18.9484 17.7215M5.05236 17.7215C5.05236 17.7215 5.06112 17.7303 5.05236 17.7303M12 3C16.9709 3 21 7.02908 21 12C21 16.9699 16.9709 21 12 21C7.02908 21 3 16.9699 3 12C3 7.02908 7.02908 3 12 3Z" stroke="currentColor"></path>
<path d="M12 3V5.25049M18.3642 5.63672L16.7734 7.22753M5.63672 5.63672L7.22753 7.22753M3 12H5.47524M21.0009 12H18.75" stroke="currentColor"></path>
<path d="M18.9487 17.7219C17.284 15.7234 14.7899 14.4551 12.0004 14.4551C9.20988 14.4551 6.71749 15.7234 5.05273 17.7219" stroke="currentColor"></path>
<path d="M12 9.81445V14.4546" stroke="currentColor"></path>
    </svg>
  ),
)

Dashboard4.displayName = 'Dashboard4'

export default Dashboard4
