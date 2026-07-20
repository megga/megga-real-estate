// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AutoFlash = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.03355 12.3889L6.51361 3.89743C6.59172 3.68451 6.79441 3.54297 7.02121 3.54297H11.6865C12.0597 3.54297 12.3206 3.91201 12.1963 4.26382L10.1331 9.10597C10.0088 9.45779 10.2698 9.82682 10.6429 9.82682H15.0481C15.5128 9.82682 15.761 10.3743 15.4548 10.7238L7.0905 20.2709C6.7136 20.7011 6.01404 20.3279 6.1614 19.7753L7.75588 13.7958C7.84741 13.4525 7.5887 13.1158 7.23346 13.1158H3.54115C3.16529 13.1158 2.90411 12.7418 3.03355 12.3889Z" stroke="currentColor"></path>
<path d="M14.0176 20.9986L17.4603 13.6016L20.9031 20.9986M15.2724 18.4096H19.6483" stroke="currentColor"></path>
    </svg>
  ),
)

AutoFlash.displayName = 'AutoFlash'

export default AutoFlash
