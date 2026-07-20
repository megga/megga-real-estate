// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TickSquare2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M8.62087 11.793C10.7099 13.1137 12.2708 15.4737 12.2708 15.4737H12.3021C12.3021 15.4737 15.6182 9.60586 21.7787 5.99707" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.9713 21.7847C17.0799 21.7847 21.2213 17.6433 21.2213 12.5347C21.2213 7.42603 17.0799 3.28467 11.9713 3.28467C6.86268 3.28467 2.72131 7.42603 2.72131 12.5347C2.72131 17.6433 6.86268 21.7847 11.9713 21.7847Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

TickSquare2.displayName = 'TickSquare2'

export default TickSquare2
