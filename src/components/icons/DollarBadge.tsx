// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarBadge = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.06417 19.9021L6.30425 20.266C5.50541 20.6484 4.58106 20.0655 4.58203 19.1801L4.59176 6.92413C4.59176 4.50135 5.94035 3 8.35827 3H15.6578C18.0825 3 19.4009 4.50135 19.4009 6.92413L19.4184 19.1772C19.4194 20.0636 18.495 20.6474 17.6952 20.264L16.9412 19.9031C16.4877 19.6851 15.9633 19.6695 15.4972 19.8602L13.3508 20.736C12.4858 21.0882 11.5157 21.0882 10.6507 20.735L8.50811 19.8602C8.04204 19.6695 7.51759 19.6851 7.06417 19.9021Z" stroke="currentColor"></path>
<path d="M13.6323 9.05908H11.2747C10.5741 9.05908 10.0059 9.62732 10.0059 10.3289C10.0059 11.0294 10.5741 11.5977 11.2747 11.5977H12.7254C13.4269 11.5977 13.9952 12.1659 13.9952 12.8674C13.9952 13.568 13.4269 14.1362 12.7254 14.1362H10.3678" stroke="currentColor"></path>
<path d="M12 14.1361V15.2016" stroke="currentColor"></path>
<path d="M12 7.9873V9.06248" stroke="currentColor"></path>
    </svg>
  ),
)

DollarBadge.displayName = 'DollarBadge'

export default DollarBadge
