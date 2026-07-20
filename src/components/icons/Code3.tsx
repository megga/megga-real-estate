// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Code3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.85694 8.78516L3 11.9989L6.85694 15.2137" stroke="currentColor"></path>
<path d="M17.1426 8.78516L20.9995 11.9989L17.1426 15.2137" stroke="currentColor"></path>
<path d="M14.571 4.92969L9.42773 19.0731" stroke="currentColor"></path>
    </svg>
  ),
)

Code3.displayName = 'Code3'

export default Code3
