// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M7.41367 10.9624V16.9922" stroke="currentColor" strokeLinecap="square"></path>
<path d="M12.2506 8.07715V16.9923" stroke="currentColor" strokeLinecap="square"></path>
<path d="M17.0865 14.1489V16.9924" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M21.5 21.7847L21.5 3.28467L3 3.28467L3 21.7847L21.5 21.7847Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

Chart2.displayName = 'Chart2'

export default Chart2
