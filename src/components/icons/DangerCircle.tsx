// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DangerCircle = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.25 3.28467C17.358 3.28467 21.5 7.42567 21.5 12.5347C21.5 17.6427 17.358 21.7847 12.25 21.7847C7.141 21.7847 3 17.6427 3 12.5347C3 7.42567 7.141 3.28467 12.25 3.28467Z" stroke="currentColor" strokeLinecap="round"></path>
<path d="M12.2451 8.73877V13.1578" stroke="currentColor" strokeLinecap="square"></path>
<path d="M12.245 16.3306H12.255" stroke="currentColor" strokeLinecap="square"></path>
    </svg>
  ),
)

DangerCircle.displayName = 'DangerCircle'

export default DangerCircle
