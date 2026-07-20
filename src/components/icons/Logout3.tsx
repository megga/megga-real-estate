// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Logout3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21.791 12.1207H9.75" stroke="currentColor"></path>
<path d="M18.8643 9.20471L21.7923 12.1207L18.8643 15.0367" stroke="currentColor"></path>
<path d="M16.3599 7.62988C16.0299 4.04988 14.6899 2.74988 9.35986 2.74988C2.25886 2.74988 2.25886 5.05988 2.25886 11.9999C2.25886 18.9399 2.25886 21.2499 9.35986 21.2499C14.6899 21.2499 16.0299 19.9499 16.3599 16.3699" stroke="currentColor"></path>
    </svg>
  ),
)

Logout3.displayName = 'Logout3'

export default Logout3
