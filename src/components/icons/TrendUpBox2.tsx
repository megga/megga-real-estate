// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TrendUpBox2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 7.78244L21 16.2171C21 19.1652 18.9188 21.0003 15.9736 21.0003H8.02638C5.08119 21.0003 3 19.1652 3 16.2162V7.78244C3 4.83433 5.08119 3.00027 8.02638 3.00027H15.9736C18.9188 3.00027 21 4.84308 21 7.78244Z" stroke="currentColor"></path>
<path d="M10.9277 9.20845L14.4995 8.50027L15.2074 12.0724" stroke="currentColor"></path>
<path d="M14.4993 8.50027L9.9653 15.2755L6.39931 12.8889L3.19922 17.2152" stroke="currentColor"></path>
    </svg>
  ),
)

TrendUpBox2.displayName = 'TrendUpBox2'

export default TrendUpBox2
