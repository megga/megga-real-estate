// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Swap3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.979 4.60132V17.2193" stroke="currentColor"></path>
<path d="M2.8999 8.69998C2.8999 8.69998 5.0689 4.59998 6.9779 4.59998C8.8859 4.59998 11.0559 8.69998 11.0559 8.69998" stroke="currentColor"></path>
<path d="M16.9058 19.4274V6.80945" stroke="currentColor"></path>
<path d="M20.9849 15.3284C20.9849 15.3284 18.8149 19.4284 16.9069 19.4284C14.9989 19.4284 12.8289 15.3284 12.8289 15.3284" stroke="currentColor"></path>
    </svg>
  ),
)

Swap3.displayName = 'Swap3'

export default Swap3
