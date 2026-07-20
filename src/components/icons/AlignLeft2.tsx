// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AlignLeft2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3 18.802V16.198C3 14.984 3.984 14 5.198 14H18.802C20.016 14 21 14.984 21 16.198V18.802C21 20.016 20.016 21 18.802 21H5.198C3.984 21 3 20.016 3 18.802Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M3 7.802V5.198C3 3.984 3.984 3 5.198 3H11.802C13.016 3 14 3.984 14 5.198V7.802C14 9.016 13.016 10 11.802 10H5.198C3.984 10 3 9.016 3 7.802Z" stroke="currentColor"></path>
    </svg>
  ),
)

AlignLeft2.displayName = 'AlignLeft2'

export default AlignLeft2
