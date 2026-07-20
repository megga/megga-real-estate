// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Flash4 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.3066 3.4124L4.61163 12.6341C4.13391 13.2919 4.60385 14.2133 5.41627 14.2133H10.8931V20.0033C10.8931 20.9666 12.1278 21.3684 12.694 20.5871L19.389 11.3664C19.8667 10.7086 19.3968 9.78627 18.5843 9.78627H13.1066V3.99715C13.1066 3.03295 11.8728 2.63209 11.3066 3.4124Z" stroke="currentColor"></path>
    </svg>
  ),
)

Flash4.displayName = 'Flash4'

export default Flash4
