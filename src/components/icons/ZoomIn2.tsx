// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ZoomIn2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.00977 10.7311L8.36038 5.37891" stroke="currentColor"></path>
<path d="M8.36035 7.35938L8.36035 5.37856L6.41843 5.37856" stroke="currentColor"></path>
<path d="M3 8.78516L3 10.7311H4.94192" stroke="currentColor"></path>
<path d="M20.5552 11.6022C21.4602 14.0432 20.5702 17.2732 18.9852 18.8582C17.1692 20.6752 13.3122 20.9772 10.9092 19.8292C9.37417 19.0962 7.76517 17.9482 6.80217 17.2152C6.25217 16.7952 6.01417 16.0933 6.16417 15.4173C6.43617 14.1953 7.81617 13.5882 8.90017 14.2142L10.0642 14.8872C10.4702 15.1212 10.9772 14.8282 10.9772 14.3602V4.99425C10.9772 4.11725 11.6882 3.40625 12.5652 3.40625C13.4332 3.40625 14.1402 4.10225 14.1532 4.97025L14.2162 9.07825C16.4392 9.29125 19.6572 9.17625 20.5552 11.6022Z" stroke="currentColor"></path>
    </svg>
  ),
)

ZoomIn2.displayName = 'ZoomIn2'

export default ZoomIn2
