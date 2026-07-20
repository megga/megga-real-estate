// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LockOpen3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.0008 14.5575V16.5565V14.5575ZM18.4108 15.5565C18.4108 19.0975 15.5408 21.9675 11.9998 21.9675C8.45985 21.9675 5.58984 19.0975 5.58984 15.5565C5.58984 12.0165 8.45985 9.14648 11.9998 9.14648C15.5408 9.14648 18.4108 12.0165 18.4108 15.5565Z" stroke="currentColor"></path>
<path d="M7.89844 10.6416V8.04963C7.90744 6.31163 9.01444 4.76364 10.6524 4.19664C12.7954 3.44964 15.1354 4.58363 15.8824 6.72663" stroke="currentColor"></path>
    </svg>
  ),
)

LockOpen3.displayName = 'LockOpen3'

export default LockOpen3
