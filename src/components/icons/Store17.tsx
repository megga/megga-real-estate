// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store17 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.93592 11.9738V18.7457C3.93592 19.8081 4.79797 20.6702 5.86046 20.6702H18.1199C19.1834 20.6702 20.0445 19.8081 20.0445 18.7457V11.9738M14.0756 20.6703H9.92293M4.78541 4.10456V6.88046L3.20238 9.03851C3.07103 9.21754 3 9.43451 3 9.65732V10.9261C3 11.505 3.46897 11.974 4.04692 11.974H19.9521C20.531 11.974 21 11.505 21 10.9261V9.65246C21 9.43256 20.9309 9.21851 20.8025 9.04046L19.1951 6.80651L19.2525 4.12111C19.2613 3.68716 18.912 3.33008 18.4781 3.33008H5.55989C5.13178 3.33008 4.78541 3.67743 4.78541 4.10456Z" stroke="currentColor"></path>
<path d="M4.78516 6.88037L19.1948 6.88077" stroke="currentColor"></path>
<path d="M14.0755 20.6704V17.2475C14.0755 16.1003 13.1463 15.1711 11.9992 15.1711C10.853 15.1711 9.92285 16.1003 9.92285 17.2475V20.6704" stroke="currentColor"></path>
    </svg>
  ),
)

Store17.displayName = 'Store17'

export default Store17
