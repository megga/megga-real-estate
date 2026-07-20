// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Target = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.2168 13.0682V10.0412M21.0008 5.51318H18.7708H21.0008ZM18.7708 5.51318V3.2832V5.51318ZM18.7708 5.51318L11.2168 13.0682L18.7708 5.51318ZM14.2438 13.0682H11.2168H14.2438Z" stroke="currentColor"></path>
<path d="M19.115 10.4369C19.382 11.2489 19.526 12.1169 19.526 13.0189C19.526 17.5829 15.827 21.2819 11.264 21.2819C6.69998 21.2819 3 17.5829 3 13.0189C3 8.45586 6.69998 4.75586 11.264 4.75586C13.484 4.75586 15.499 5.63188 16.985 7.05688" stroke="currentColor"></path>
    </svg>
  ),
)

Target.displayName = 'Target'

export default Target
