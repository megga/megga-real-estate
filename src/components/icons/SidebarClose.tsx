// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SidebarClose = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.4883 3C19.8755 3 21 4.11879 21 5.49889L21 18.5011C21 19.8812 19.8755 21 18.4884 21H17.5117C16.1245 21 15 19.8812 15 18.5011L15 5.49889C15 4.11879 16.1245 3 17.5116 3L18.4883 3Z" stroke="currentColor"></path>
<path d="M3 12.0003L6.48891 15.5M3 12.0003L6.48891 8.5M3 12.0003L11 12.0001" stroke="currentColor"></path>
    </svg>
  ),
)

SidebarClose.displayName = 'SidebarClose'

export default SidebarClose
