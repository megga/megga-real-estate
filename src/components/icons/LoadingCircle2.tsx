// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LoadingCircle2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.48886 15.2626C3.26843 14.6876 3.09601 14.0733 3 13.4404" stroke="currentColor"></path>
<path d="M3.56229 8.55176C3.30365 9.17484 3.12143 9.8371 3.01562 10.518" stroke="currentColor"></path>
<path d="M6.24115 4.93359C5.80029 5.29804 5.38785 5.70069 5.0332 6.13273" stroke="currentColor"></path>
<path d="M10.5566 3.00586C9.92371 3.10187 9.30945 3.2645 8.73438 3.49472" stroke="currentColor"></path>
<path d="M13.4333 3.00684C13.9731 3.09207 14.5002 3.22531 15.0145 3.40655C19.7209 5.10728 22.1583 10.3016 20.4586 15.008C18.7579 19.7153 13.5636 22.1528 8.85719 20.453C7.7815 20.0641 6.82533 19.4939 6.00925 18.7886C5.61052 18.4555 5.25588 18.092 4.94336 17.7011" stroke="currentColor"></path>
    </svg>
  ),
)

LoadingCircle2.displayName = 'LoadingCircle2'

export default LoadingCircle2
