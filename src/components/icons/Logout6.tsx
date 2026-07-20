// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Logout6 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9 21H8.92018C6.84787 21 5.81171 21 5.02023 20.5967C4.32404 20.242 3.75801 19.676 3.40328 18.9798C3 18.1883 3 17.1522 3 15.08L3 8.92C3 6.84781 3 5.81171 3.40328 5.02023C3.75801 4.32404 4.32404 3.75801 5.02024 3.40328C5.81171 3 6.84787 3 8.92018 3L9 3" stroke="currentColor"></path>
<path d="M16.6558 16.2183L21.0001 11.9998M21.0001 11.9998L16.6558 7.78133M21.0001 11.9998L8.44922 11.9993" stroke="currentColor"></path>
    </svg>
  ),
)

Logout6.displayName = 'Logout6'

export default Logout6
