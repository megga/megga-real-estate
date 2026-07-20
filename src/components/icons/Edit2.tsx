// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Edit2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.3506 3.604L21.25 8.50339L8.14939 21.604L3.25461 21.5994L3.25 16.7046L16.3506 3.604Z" stroke="currentColor"></path>
<path d="M20.5722 21.5987L3.25488 21.5981" stroke="currentColor"></path>
    </svg>
  ),
)

Edit2.displayName = 'Edit2'

export default Edit2
