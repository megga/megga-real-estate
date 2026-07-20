// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Flashlight2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M18.539 13.1647L17.1875 14.5161C16.7516 14.952 16.1863 15.2342 15.5763 15.3218L14.1898 15.5193C13.5126 15.6166 12.885 15.9299 12.4005 16.4135L8.81211 20.0018C7.48301 21.3319 5.32689 21.3319 3.99682 20.0018C2.66773 18.6727 2.66773 16.5166 3.99682 15.1875L7.58615 11.5982C8.06972 11.1146 8.38302 10.487 8.48032 9.80982L8.67784 8.42332C8.7654 7.81326 9.04757 7.24699 9.48347 6.81109L10.8349 5.46059C11.5793 4.71626 12.7867 4.71626 13.5311 5.46059L18.539 10.4685C19.2833 11.2129 19.2833 12.4203 18.539 13.1647Z" stroke="currentColor"></path>
<path d="M15.4238 3.79201V3" stroke="currentColor"></path>
<path d="M20.207 8.57422H20.999" stroke="currentColor"></path>
<path d="M18.3691 5.60452L19.4229 4.55078" stroke="currentColor"></path>
<path d="M10.2574 13.7422L8.8125 15.1871" stroke="currentColor"></path>
<path d="M9.77539 6.51953L17.4795 14.2236" stroke="currentColor"></path>
    </svg>
  ),
)

Flashlight2.displayName = 'Flashlight2'

export default Flashlight2
