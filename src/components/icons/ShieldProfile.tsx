// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldProfile = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3237 13.6284C19.3237 19.7416 11.9997 21.959 11.9997 21.959C11.9997 21.959 4.67668 19.7426 4.67668 13.6284C4.67668 7.51422 4.4097 7.03649 4.9977 6.44882C5.5867 5.86017 11.0397 3.95898 11.9997 3.95898C12.9607 3.95898 18.4127 5.8553 19.0017 6.44882C19.5897 7.04136 19.3237 7.5152 19.3237 13.6284Z" stroke="currentColor"></path>
<path d="M7.55566 19.4424C7.73266 18.0715 8.95164 16.5488 11.9796 16.5488C15.0406 16.5488 16.2517 18.0802 16.4207 19.4677" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.8318 11.4601C14.8318 13.0334 13.5558 14.309 11.9828 14.309C10.4098 14.309 9.13379 13.0334 9.13379 11.4601C9.13379 9.88689 10.4098 8.61133 11.9828 8.61133C13.5558 8.61133 14.8318 9.88689 14.8318 11.4601Z" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldProfile.displayName = 'ShieldProfile'

export default ShieldProfile
