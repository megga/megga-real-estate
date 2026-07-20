// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Light2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M20.1136 14.5173C20.1136 10.0359 16.4801 6.40234 11.9987 6.40234C7.5173 6.40234 3.88477 10.0359 3.88477 14.5173H20.1136Z" stroke="currentColor"></path>
<path d="M12 6.40145L12.0005 3" stroke="currentColor"></path>
<path d="M12.001 20.4301V20.999M16.3026 19.0977L16.7051 19.5002M7.72282 19.0977L7.32031 19.5002" stroke="currentColor"></path>
<path d="M15.4451 14.5898C15.4451 16.4928 13.9029 18.0351 11.9999 18.0351C10.097 18.0351 8.55469 16.4928 8.55469 14.5898" stroke="currentColor"></path>
    </svg>
  ),
)

Light2.displayName = 'Light2'

export default Light2
