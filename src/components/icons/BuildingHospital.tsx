// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BuildingHospital = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.69922 21V9.68445C4.69922 9.38185 4.94441 9.13667 5.247 9.13667H6.88936C7.19195 9.13667 7.43714 8.89148 7.43714 8.58889V5.12125C7.43714 4.81866 7.68232 4.57347 7.98491 4.57347H16.0148C16.3174 4.57347 16.5626 4.81866 16.5626 5.12125V8.58889C16.5626 8.89148 16.8077 9.13667 17.1103 9.13667H18.7527C19.0553 9.13667 19.3005 9.38185 19.3005 9.68445V21" stroke="currentColor"></path>
<path d="M11.998 4.57328V3" stroke="currentColor"></path>
<path d="M20.5287 20.9998H3.47168" stroke="currentColor"></path>
<path d="M9.76074 17.4861L9.76269 17.5396M9.76074 14.2869L9.76269 14.3404M14.3938 17.4861L14.3918 17.5396M14.3938 14.2869L14.3918 14.3404" stroke="currentColor"></path>
<path d="M11.9981 9.42968V11.0993M11.9981 9.42968V7.76025M11.9981 9.42968H13.6677M10.3296 9.42968H11.9992" stroke="currentColor"></path>
    </svg>
  ),
)

BuildingHospital.displayName = 'BuildingHospital'

export default BuildingHospital
