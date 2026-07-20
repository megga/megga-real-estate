// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseDown = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.6136 9.07312C15.7855 9.07312 19.1676 7.7088 19.1676 6.02582C19.1676 4.34284 15.7855 2.97852 11.6136 2.97852C7.44159 2.97852 4.05957 4.34284 4.05957 6.02582C4.05957 7.7088 7.44159 9.07312 11.6136 9.07312Z" stroke="currentColor"></path>
<path d="M4.05957 12V18.0142C4.05957 18.0142 4.05957 21.0223 11.6567 21.0223" stroke="currentColor"></path>
<path d="M19.1678 11.5571V5.98438" stroke="currentColor"></path>
<path d="M4.05957 5.98438V11.9986C4.05957 11.9986 4.05957 15.0057 11.6567 15.0057" stroke="currentColor"></path>
<path d="M14.3076 18.2046L17.1245 21.0215L19.9414 18.2046" stroke="currentColor"></path>
<path d="M17.1249 14.3633V21.0215" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseDown.displayName = 'DatabaseDown'

export default DatabaseDown
