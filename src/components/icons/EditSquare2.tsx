// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const EditSquare2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M13.1827 7.89014L16.9836 11.6909L6.82046 21.854L3.02323 21.8505L3.01965 18.0532L13.1827 7.89014Z" stroke="currentColor"></path>
<path d="M13.1827 7.89014L16.9836 11.6909L6.82046 21.854L3.02323 21.8505L3.01965 18.0532L13.1827 7.89014Z" stroke="currentColor"></path>
<path d="M13.7435 14.0972L10.7573 11.111" stroke="currentColor"></path>
<path d="M3.01942 12.0504V3.354H21.4806V21.854H12.9439" stroke="currentColor"></path>
    </svg>
  ),
)

EditSquare2.displayName = 'EditSquare2'

export default EditSquare2
