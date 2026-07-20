// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CallMissed3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21.3284 2.74988L15.3284 8.74988" stroke="currentColor"></path>
<path d="M15.3284 2.74988L21.3284 8.74988" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M7.70098 16.299C0.802193 9.40023 1.78303 6.24116 2.51123 5.22211C2.60358 5.05863 4.90601 1.61189 7.3751 3.63408C13.5011 8.67946 5.74461 7.96612 10.8898 13.1113C16.0339 18.2554 15.3205 10.5 20.3659 16.6249C22.3881 19.094 18.9414 21.3954 18.7779 21.4888C17.7588 22.217 14.5998 23.1978 7.70098 16.299Z" stroke="currentColor"></path>
    </svg>
  ),
)

CallMissed3.displayName = 'CallMissed3'

export default CallMissed3
