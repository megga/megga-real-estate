// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Work2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12.2501 17.2265V14.6895" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.495 5.87988V12.3799C19.035 13.8199 15.785 14.6899 12.245 14.6899C8.705 14.6899 5.465 13.8199 3.005 12.3799V5.87988H21.495Z" stroke="currentColor"></path>
<path d="M15.7501 5.61115L14.7502 3.2998H9.75022L8.75012 5.61115" stroke="currentColor"></path>
<path d="M3.02942 15.1932L3.21842 20.7002H21.2814L21.4704 15.1932" stroke="currentColor"></path>
    </svg>
  ),
)

Work2.displayName = 'Work2'

export default Work2
