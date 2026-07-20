// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarCircle3 = forwardRef<SVGSVGElement, Props>(
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
<path d="M13.8181 9.17578H11.193C10.4117 9.17578 9.7793 9.80919 9.7793 10.5895C9.7793 11.3698 10.4117 12.0032 11.193 12.0032H12.8082C13.5895 12.0032 14.2219 12.6366 14.2219 13.417C14.2219 14.1983 13.5895 14.8307 12.8082 14.8307H10.1831" stroke="currentColor"></path>
<path d="M12 14.8303V16.0173M12 7.98242V9.18015" stroke="currentColor"></path>
    </svg>
  ),
)

DollarCircle3.displayName = 'DollarCircle3'

export default DollarCircle3
