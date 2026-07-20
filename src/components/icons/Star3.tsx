// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Star3 = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12.25 2.75C13.4203 7.28687 16.9631 10.8297 21.5 12C16.9631 13.1703 13.4203 16.7131 12.25 21.25C11.0797 16.7131 7.53687 13.1703 3 12C7.53687 10.8297 11.0797 7.28687 12.25 2.75Z" stroke="currentColor"></path>
<path d="M19.0013 2.75C19.0013 3.8975 20.3206 5.24836 21.4996 5.24836C20.2752 5.24836 19.0013 6.58523 19.0013 7.74671C19.0013 6.57766 17.648 5.24836 16.5029 5.24836C17.6934 5.24836 19.0013 3.8975 19.0013 2.75Z" stroke="currentColor"></path>
    </svg>
  ),
)

Star3.displayName = 'Star3'

export default Star3
