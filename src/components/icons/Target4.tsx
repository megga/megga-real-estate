// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Target4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.6373 7.18872C17.0666 5.03872 14.5148 3.63672 11.6451 3.63672C6.8695 3.63672 2.99902 7.50671 2.99902 12.2827C2.99902 17.0497 6.8695 20.9287 11.6451 20.9287C16.4217 20.9287 20.2922 17.0497 20.2922 12.2827C20.2922 11.7687 20.2449 11.2637 20.1513 10.7687" stroke="currentColor"></path>
<path d="M16.0945 13.7236C15.4959 15.6026 13.7298 16.9666 11.6449 16.9666C9.06532 16.9666 6.96191 14.8635 6.96191 12.2845C6.96191 9.69455 9.06532 7.60156 11.6449 7.60156C13.2063 7.60156 14.5897 8.35852 15.4218 9.53552" stroke="currentColor"></path>
<path d="M11.6494 12.2798L21.0001 5.46484" stroke="currentColor"></path>
    </svg>
  ),
)

Target4.displayName = 'Target4'

export default Target4
