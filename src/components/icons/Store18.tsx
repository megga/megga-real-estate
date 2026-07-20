// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store18 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M18.6907 5.94829H5.32336C4.66857 5.94829 4.10523 6.41336 3.98264 7.05745L3.34536 10.3878C3.20817 10.9726 3.65184 11.533 4.25312 11.533H19.7473C20.3486 11.533 20.7922 10.9726 20.655 10.3878L20.0324 7.06232C19.9117 6.41628 19.3484 5.94829 18.6907 5.94829Z" stroke="currentColor"></path>
<path d="M12.0275 20.9992H16.0205M4.25537 11.5332V19.1485C4.25537 20.171 5.08432 21 6.10591 21H17.8951C18.9167 21 19.7456 20.171 19.7456 19.1485V11.5332" stroke="currentColor"></path>
<path d="M7.46289 15.9846H8.574" stroke="currentColor"></path>
<path d="M12.0273 20.9991V15.0496H16.0203V20.9991" stroke="currentColor"></path>
<path d="M7.25098 3H16.7499" stroke="currentColor"></path>
    </svg>
  ),
)

Store18.displayName = 'Store18'

export default Store18
