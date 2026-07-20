// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarCircle = forwardRef<SVGSVGElement, Props>(
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
<path d="M14.5079 10.3846V10.3107C14.5079 9.60237 13.9338 9.02832 13.2255 9.02832H11.0431C10.1879 9.02832 9.49414 9.72108 9.49414 10.5773C9.49414 11.4325 10.1879 12.1263 11.0431 12.1263H13.0192C13.8414 12.1263 14.5088 12.7928 14.5088 13.6149C14.5088 14.4381 13.8414 15.1045 13.0192 15.1045H10.7765C10.0682 15.1045 9.49414 14.5295 9.49414 13.8212" stroke="currentColor"></path>
<path d="M12 7.9502V16.0502" stroke="currentColor"></path>
    </svg>
  ),
)

DollarCircle.displayName = 'DollarCircle'

export default DollarCircle
