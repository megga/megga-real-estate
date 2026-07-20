// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GraphLineBox2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.2169 21.0005H7.78216C4.83405 21.0005 3 18.9203 3 15.9741V8.02784C3 5.08168 4.83405 3.00049 7.78313 3.00049H16.2169C19.165 3.00049 21 5.08168 21 8.02784V15.9741C21 18.9203 19.1562 21.0005 16.2169 21.0005Z" stroke="currentColor"></path>
<path d="M16.654 9.52002L13.7419 13.3039L10.4202 10.6963L7.57031 14.3742" stroke="currentColor"></path>
    </svg>
  ),
)

GraphLineBox2.displayName = 'GraphLineBox2'

export default GraphLineBox2
