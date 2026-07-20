// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AlignRight2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M21 18.802V16.198C21 14.984 20.016 14 18.802 14H5.198C3.984 14 3 14.984 3 16.198V18.802C3 20.016 3.984 21 5.198 21H18.802C20.016 21 21 20.016 21 18.802Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21 7.802V5.198C21 3.984 20.016 3 18.802 3H12.198C10.984 3 10 3.984 10 5.198V7.802C10 9.016 10.984 10 12.198 10H18.802C20.016 10 21 9.016 21 7.802Z" stroke="currentColor"></path>
    </svg>
  ),
)

AlignRight2.displayName = 'AlignRight2'

export default AlignRight2
