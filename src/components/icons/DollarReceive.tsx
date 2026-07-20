// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarReceive = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 16.968 16.968 21 12 21C7.032 21 3 16.968 3 12C3 7.032 7.032 3 12 3" stroke="currentColor"></path>
<path d="M13.8133 9.13794H11.2018C10.4244 9.13794 9.79492 9.76745 9.79492 10.5439C9.79492 11.3213 10.4244 11.9508 11.2018 11.9508H12.8092C13.5856 11.9508 14.2151 12.5803 14.2151 13.3568C14.2151 14.1342 13.5856 14.7637 12.8092 14.7637H10.1968" stroke="currentColor"></path>
<path d="M12.0059 14.7629V15.9441M12.0059 7.9502V9.14111" stroke="currentColor"></path>
<path d="M16.6523 4.45337V7.34699H19.546" stroke="currentColor"></path>
<path d="M16.6523 7.34696L20.5579 3.44141" stroke="currentColor"></path>
    </svg>
  ),
)

DollarReceive.displayName = 'DollarReceive'

export default DollarReceive
