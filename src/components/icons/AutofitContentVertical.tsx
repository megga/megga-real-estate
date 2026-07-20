// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AutofitContentVertical = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.51166 3C4.12452 3 3.00003 4.11879 3.00003 5.49889L3 18.5011C3 19.8812 4.1245 21 5.51163 21H6.48834C7.87548 21 8.99997 19.8812 8.99997 18.5011L9 5.49889C9 4.11879 7.8755 3 6.48837 3L5.51166 3Z" stroke="currentColor"></path>
<path d="M15 6L18 3M18 3L21 6M18 3L18 10" stroke="currentColor"></path>
<path d="M15 18L18 21M18 21L21 18M18 21L18 14" stroke="currentColor"></path>
    </svg>
  ),
)

AutofitContentVertical.displayName = 'AutofitContentVertical'

export default AutofitContentVertical
