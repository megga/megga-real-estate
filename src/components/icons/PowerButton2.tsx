// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerButton2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.9009 6.15625C18.661 7.58764 19.7887 9.75973 19.7887 12.2105C19.7887 16.513 16.3028 19.9989 12.0003 19.9989C7.69781 19.9989 4.21191 16.513 4.21191 12.2105C4.21191 9.75973 5.34055 7.58764 7.0997 6.15625" stroke="currentColor"></path>
<path d="M12 4V10.7866" stroke="currentColor"></path>
    </svg>
  ),
)

PowerButton2.displayName = 'PowerButton2'

export default PowerButton2
