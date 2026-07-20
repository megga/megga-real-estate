// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Heart3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M2.9219 12.4463C1.8489 9.09631 3.1039 4.93131 6.6209 3.79931C8.4709 3.20231 10.7539 3.70031 12.0509 5.48931C13.2739 3.63431 15.6229 3.20631 17.4709 3.79931C20.9869 4.93131 22.2489 9.09631 21.1769 12.4463C19.5069 17.7563 13.6799 20.5223 12.0509 20.5223C10.4229 20.5223 4.6479 17.8183 2.9219 12.4463Z" stroke="currentColor"></path>
<path d="M15.7886 7.56396C16.9956 7.68796 17.7506 8.64496 17.7056 9.98596" stroke="currentColor"></path>
    </svg>
  ),
)

Heart3.displayName = 'Heart3'

export default Heart3
