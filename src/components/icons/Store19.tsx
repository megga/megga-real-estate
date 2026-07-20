// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store19 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.32336 5.94829H18.6907C19.3484 5.94829 19.9117 6.41628 20.0324 7.06232L20.655 10.3878C20.7922 10.9726 20.3486 11.533 19.7473 11.533H4.25312C3.65184 11.533 3.20817 10.9726 3.34536 10.3878L3.98264 7.05745C4.10523 6.41336 4.66857 5.94829 5.32336 5.94829Z" stroke="currentColor"></path>
<path d="M7.25098 3H16.7499" stroke="currentColor"></path>
<path d="M15.0914 5.94824V11.533M8.96582 5.94824V11.3306" stroke="currentColor"></path>
<path d="M16.0205 20.9992H12.0275M4.25537 11.5332V19.1485C4.25537 20.171 5.08432 21 6.10591 21H17.8951C18.9167 21 19.7456 20.171 19.7456 19.1485V11.5332" stroke="currentColor"></path>
<path d="M7.46289 15.9846H8.574" stroke="currentColor"></path>
<path d="M16.0203 20.9994V17.0463C16.0203 15.9439 15.1262 15.0498 14.0238 15.0498C12.9215 15.0498 12.0273 15.9439 12.0273 17.0463V20.9994" stroke="currentColor"></path>
    </svg>
  ),
)

Store19.displayName = 'Store19'

export default Store19
