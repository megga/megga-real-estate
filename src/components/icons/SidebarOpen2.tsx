// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SidebarOpen2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.51166 21C4.12452 21 3.00003 19.8812 3.00003 18.5011L3 5.49889C3 4.11879 4.1245 3 5.51163 3L6.48834 3C7.87548 3 8.99997 4.11879 8.99997 5.49889L9 18.5011C9 19.8812 7.8755 21 6.48837 21L5.51166 21Z" stroke="currentColor"></path>
<path d="M17.4995 8.5L21 11.9997L17.4995 15.5" stroke="currentColor"></path>
    </svg>
  ),
)

SidebarOpen2.displayName = 'SidebarOpen2'

export default SidebarOpen2
