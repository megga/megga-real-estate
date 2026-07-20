// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BuildingOffice3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.9728 9.00032H18.6962C19.4308 9.00032 20.0272 9.59676 20.0272 10.3314V19.669C20.0272 20.4045 19.4308 21 18.6962 21H5.30417C4.5686 21 3.97314 20.4045 3.97314 19.669V7.22757C3.97314 6.49297 4.5686 5.89654 5.30417 5.89654H9.9725V4.33103C9.9725 3.59643 10.5689 3 11.3045 3H14.6418C15.3764 3 15.9728 3.59643 15.9728 4.33103V9.00032ZM15.9728 9.00032V21" stroke="currentColor"></path>
<path d="M7.97021 17.0093L7.97216 17.0193" stroke="currentColor"></path>
<path d="M7.97021 13.4233L7.97216 13.4333" stroke="currentColor"></path>
<path d="M7.97021 9.75586L7.97216 9.76586" stroke="currentColor"></path>
<path d="M11.9727 17.0093L11.9746 17.0193" stroke="currentColor"></path>
<path d="M11.9727 13.4233L11.9746 13.4333" stroke="currentColor"></path>
<path d="M11.9727 9.75586L11.9746 9.76586" stroke="currentColor"></path>
    </svg>
  ),
)

BuildingOffice3.displayName = 'BuildingOffice3'

export default BuildingOffice3
