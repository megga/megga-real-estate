// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SidebarClose2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.4883 3C19.8755 3 21 4.11879 21 5.49889L21 18.5011C21 19.8812 19.8755 21 18.4884 21L17.5117 21C16.1245 21 15 19.8812 15 18.5011L15 5.49889C15 4.11879 16.1245 3 17.5116 3L18.4883 3Z" stroke="currentColor"></path>
<path d="M6.50048 15.5L3 12.0003L6.50048 8.5" stroke="currentColor"></path>
    </svg>
  ),
)

SidebarClose2.displayName = 'SidebarClose2'

export default SidebarClose2
