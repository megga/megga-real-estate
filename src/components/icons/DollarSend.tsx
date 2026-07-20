// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarSend = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 16.968 16.968 21 12 21C7.032 21 3 16.968 3 12C3 7.032 7.032 3 12 3" stroke="currentColor"></path>
<path d="M13.8113 9.13794H11.1999C10.4225 9.13794 9.79297 9.76745 9.79297 10.5439C9.79297 11.3213 10.4225 11.9508 11.1999 11.9508H12.8072C13.5837 11.9508 14.2132 12.5803 14.2132 13.3568C14.2132 14.1342 13.5837 14.7637 12.8072 14.7637H10.1948" stroke="currentColor"></path>
<path d="M12.0039 14.7629V15.9441M12.0039 7.9502V9.14111" stroke="currentColor"></path>
<path d="M20.5577 6.33405V3.44043H17.665" stroke="currentColor"></path>
<path d="M20.5579 3.44043L16.6523 7.34689" stroke="currentColor"></path>
    </svg>
  ),
)

DollarSend.displayName = 'DollarSend'

export default DollarSend
