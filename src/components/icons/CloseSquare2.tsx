// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CloseSquare2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.6455 10.1294L9.85352 14.9214" stroke="currentColor" strokeLinecap="square"></path>
<path d="M14.6456 14.9244L9.84961 10.1274" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.25 21.7847C17.3586 21.7847 21.5 17.6433 21.5 12.5347C21.5 7.42603 17.3586 3.28467 12.25 3.28467C7.14137 3.28467 3 7.42603 3 12.5347C3 17.6433 7.14137 21.7847 12.25 21.7847Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

CloseSquare2.displayName = 'CloseSquare2'

export default CloseSquare2
