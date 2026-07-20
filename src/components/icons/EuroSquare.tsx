// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const EuroSquare = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M14.0708 15.8205C12.5832 15.8779 11.1879 15.1034 10.4504 13.8094C9.81601 12.6865 9.81601 11.3137 10.4504 10.1899C11.1879 8.89682 12.5832 8.12136 14.0708 8.17876" stroke="currentColor"></path>
<path d="M9.29297 10.8779H13.7511M9.29297 13.1222H13.7511" stroke="currentColor"></path>
    </svg>
  ),
)

EuroSquare.displayName = 'EuroSquare'

export default EuroSquare
