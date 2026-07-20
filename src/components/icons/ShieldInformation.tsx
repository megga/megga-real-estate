// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldInformation = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3237 13.6089C19.3237 19.7221 11.9997 21.9395 11.9997 21.9395C11.9997 21.9395 4.6767 19.7231 4.6767 13.6089C4.6767 7.49469 4.40968 7.01696 4.99768 6.42929C5.58668 5.84064 11.0397 3.93945 11.9997 3.93945C12.9607 3.93945 18.4127 5.83577 19.0017 6.42929C19.5897 7.02183 19.3237 7.49567 19.3237 13.6089Z" stroke="currentColor"></path>
<path d="M11.9971 9.11914V9.14611M12.0031 15.9682V12.1746V15.9682Z" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldInformation.displayName = 'ShieldInformation'

export default ShieldInformation
