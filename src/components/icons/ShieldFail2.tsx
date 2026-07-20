// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldFail2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M14.1619 13.6239L10.308 9.77002" stroke="currentColor" strokeLinecap="square"></path>
<path d="M10.308 13.6239L14.1619 9.77002" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.25 21.604C12.25 21.604 20.1178 19.2217 20.1178 12.6543V3.604H4.38217V12.6543C4.38217 19.2217 12.25 21.604 12.25 21.604Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

ShieldFail2.displayName = 'ShieldFail2'

export default ShieldFail2
