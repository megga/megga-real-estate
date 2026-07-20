// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3237 13.6284C19.3237 19.7416 11.9997 21.959 11.9997 21.959C11.9997 21.959 4.67669 19.7426 4.67669 13.6284C4.67669 7.51422 4.40969 7.03649 4.99769 6.44882C5.58669 5.86017 11.0397 3.95898 11.9997 3.95898C12.9607 3.95898 18.4127 5.8553 19.0017 6.44882C19.5897 7.04136 19.3237 7.5152 19.3237 13.6284Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.2101 12.5021C13.7151 12.1294 14.0461 11.5359 14.0461 10.8606C14.0461 9.73002 13.1301 8.81445 12.0001 8.81445C10.8701 8.81445 9.9541 9.73002 9.9541 10.8606C9.9541 11.5359 10.2851 12.1294 10.7901 12.5021L10.1571 14.4081C9.9701 14.9695 10.3871 15.5484 10.9791 15.5484H13.0201C13.6121 15.5484 14.0301 14.9695 13.8431 14.4081L13.2101 12.5021Z" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldLock.displayName = 'ShieldLock'

export default ShieldLock
