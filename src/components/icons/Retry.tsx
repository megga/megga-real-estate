// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Retry = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.002 15.6999V15.6602" stroke="currentColor"></path>
<path d="M11.9961 8.3418V12.6019" stroke="currentColor"></path>
<path d="M3 17.8512L5.5334 18.4368L6.11609 15.918" stroke="currentColor"></path>
<path d="M20.9989 6.1481L18.4655 5.5625L17.8828 8.08136" stroke="currentColor"></path>
<path d="M5.53851 18.1692C2.17034 14.6837 2.19264 9.12827 5.62383 5.67187C7.77232 3.50689 10.7537 2.67212 13.5449 3.17143" stroke="currentColor"></path>
<path d="M18.4596 5.83008C21.8277 9.31459 21.8045 14.871 18.3742 18.3274C16.2257 20.4924 13.2444 21.3272 10.4531 20.8278" stroke="currentColor"></path>
    </svg>
  ),
)

Retry.displayName = 'Retry'

export default Retry
