// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerConnect = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.70508 11.8975H17.2949C19.3411 11.8975 21 10.2386 21 8.19239C21 6.14623 19.3411 4.48828 17.2949 4.48828H6.70508C4.65892 4.48828 3 6.14623 3 8.19239C3 10.2386 4.65892 11.8975 6.70508 11.8975Z" stroke="currentColor"></path>
<path d="M7.37695 8.19336H7.90138M13.1055 8.19336H16.6773" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.6073 17.9052C13.6073 18.7926 12.8883 19.5116 12.0009 19.5116C11.1136 19.5116 10.3945 18.7926 10.3945 17.9052C10.3945 17.0179 11.1136 16.2988 12.0009 16.2988C12.8883 16.2988 13.6073 17.0179 13.6073 17.9052Z" stroke="currentColor"></path>
<path d="M18.2401 17.9043H13.5825M10.4077 17.9043H5.75977" stroke="currentColor"></path>
<path d="M12 16.2938V12.0166" stroke="currentColor"></path>
    </svg>
  ),
)

ServerConnect.displayName = 'ServerConnect'

export default ServerConnect
