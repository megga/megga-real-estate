// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RupeeSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M9.5293 8.30762H10.512C11.7759 8.30762 12.8014 9.33118 12.8014 10.596C12.8014 11.8609 11.7769 12.8864 10.513 12.8874H9.53027L12.8034 16.1605" stroke="currentColor"></path>
<path d="M9.5293 8.30957H14.7668" stroke="currentColor"></path>
<path d="M9.5293 10.5088H14.7668" stroke="currentColor"></path>
    </svg>
  ),
)

RupeeSquare.displayName = 'RupeeSquare'

export default RupeeSquare
