// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const TrendUpGraphBox = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M16.2178 3.00049H7.78314C4.84378 3.00049 3 5.08168 3 8.02687V15.9741C3 18.9193 4.83503 21.0005 7.78314 21.0005H16.2169C19.1659 21.0005 21 18.9193 21 15.9741V8.02687C21 5.08168 19.1659 3.00049 16.2178 3.00049Z" stroke="currentColor"></path>
<path d="M7.84196 16.8799V15.8924" stroke="currentColor"></path>
<path d="M12.0002 16.8795V14.2087" stroke="currentColor"></path>
<path d="M16.1579 16.879V12.525" stroke="currentColor"></path>
<path d="M16.1602 7.12042L15.7837 7.55923C13.7093 9.97902 10.9344 11.6953 7.84229 12.4679" stroke="currentColor"></path>
<path d="M13.9668 7.12042H16.1589V9.31156" stroke="currentColor"></path>
    </svg>
  ),
)

TrendUpGraphBox.displayName = 'TrendUpGraphBox'

export default TrendUpGraphBox
