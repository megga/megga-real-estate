// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ZoomOut2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.44238 5.37891V7.35973H8.38431" stroke="currentColor"></path>
<path d="M4.96387 10.7656L4.96387 8.78481L3.02194 8.78481" stroke="currentColor"></path>
<path d="M6.44238 7.35973L8.38431 5.37891" stroke="currentColor"></path>
<path d="M4.96387 8.78481L3.02194 10.7656" stroke="currentColor"></path>
<path d="M20.5542 11.6022C21.4592 14.0432 20.5692 17.2732 18.9842 18.8582C17.1682 20.6752 13.3112 20.9772 10.9082 19.8292C9.37319 19.0962 7.7642 17.9482 6.8012 17.2152C6.2512 16.7952 6.0132 16.0933 6.1632 15.4173C6.4352 14.1953 7.81519 13.5882 8.89919 14.2142L10.0632 14.8872C10.4692 15.1212 10.9762 14.8282 10.9762 14.3602V4.99425C10.9762 4.11725 11.6872 3.40625 12.5642 3.40625C13.4322 3.40625 14.1392 4.10225 14.1522 4.97025L14.2152 9.07825C16.4382 9.29125 19.6562 9.17625 20.5542 11.6022Z" stroke="currentColor"></path>
    </svg>
  ),
)

ZoomOut2.displayName = 'ZoomOut2'

export default ZoomOut2
