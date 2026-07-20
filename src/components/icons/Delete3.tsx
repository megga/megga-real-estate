// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Delete3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.8892 9.55408C18.8892 17.5731 20.0435 21.1979 12.2797 21.1979C4.5149 21.1979 5.693 17.5731 5.693 9.55408" stroke="currentColor"></path>
<path d="M20.3652 6.47985H4.21472" stroke="currentColor"></path>
<path d="M15.7149 6.47983C15.7149 6.47983 16.2435 2.71411 12.2892 2.71411C8.3359 2.71411 8.86447 6.47983 8.86447 6.47983" stroke="currentColor"></path>
    </svg>
  ),
)

Delete3.displayName = 'Delete3'

export default Delete3
