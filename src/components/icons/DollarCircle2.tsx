// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarCircle2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9709 7.02908 21 12 21C16.9709 21 21 16.9709 21 12Z" stroke="currentColor"></path>
<path d="M14.0571 10.384V10.3101C14.0571 9.60176 13.483 9.02771 12.7747 9.02771H11.4923C10.6371 9.02771 9.94336 9.72047 9.94336 10.5767C9.94336 11.4319 10.6371 12.1257 11.4923 12.1257H12.5684C13.3906 12.1257 14.0581 12.7921 14.0581 13.6143C14.0581 14.4374 13.3906 15.1039 12.5684 15.1039H11.2257C10.5174 15.1039 9.94336 14.5289 9.94336 13.8206" stroke="currentColor"></path>
<path d="M12.0039 16.0525V15.1077M12.0039 9.02339V7.95215" stroke="currentColor"></path>
    </svg>
  ),
)

DollarCircle2.displayName = 'DollarCircle2'

export default DollarCircle2
