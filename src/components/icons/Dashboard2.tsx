// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Dashboard2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9699 7.02908 21 12 21C16.9709 21 21 16.9699 21 12Z" stroke="currentColor"></path>
<path d="M13.0723 11.0992L15.5757 8.5957M12 10.6895C12.7239 10.6895 13.3106 11.2762 13.3106 12C13.3106 12.7239 12.7239 13.3106 12 13.3106C11.2762 13.3106 10.6895 12.7239 10.6895 12C10.6895 11.2762 11.2762 10.6895 12 10.6895Z" stroke="currentColor"></path>
<path d="M6.84375 12.0005C6.84375 9.1536 9.15164 6.8457 11.9986 6.8457" stroke="currentColor"></path>
<path d="M17.1548 12C17.1548 14.8469 14.8469 17.1548 12 17.1548" stroke="currentColor"></path>
<path d="M9.01061 16.2002C8.59612 15.9044 8.22639 15.5493 7.91602 15.1465" stroke="currentColor"></path>
    </svg>
  ),
)

Dashboard2.displayName = 'Dashboard2'

export default Dashboard2
