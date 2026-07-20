// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BottomSheetClose2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 5.51166C3 4.12452 4.11879 3.00003 5.49889 3.00003L18.5011 3C19.8812 3 21 4.1245 21 5.51163L21 6.48834C21 7.87548 19.8812 8.99997 18.5011 8.99997L5.49889 9C4.11879 9 3 7.8755 3 6.48837L3 5.51166Z" stroke="currentColor"></path>
<path d="M15.5 17.4995L12.0003 21L8.5 17.4995" stroke="currentColor"></path>
    </svg>
  ),
)

BottomSheetClose2.displayName = 'BottomSheetClose2'

export default BottomSheetClose2
