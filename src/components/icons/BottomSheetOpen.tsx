// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BottomSheetOpen = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 18.4883C21 19.8755 19.8812 21 18.5011 21L5.49889 21C4.11879 21 3 19.8755 3 18.4884L3 17.5117C3 16.1245 4.11879 15 5.49889 15L18.5011 15C19.8812 15 21 16.1245 21 17.5116L21 18.4883Z" stroke="currentColor"></path>
<path d="M11.9997 3L8.5 6.48891M11.9997 3L15.5 6.48891M11.9997 3L11.9999 11" stroke="currentColor"></path>
    </svg>
  ),
)

BottomSheetOpen.displayName = 'BottomSheetOpen'

export default BottomSheetOpen
