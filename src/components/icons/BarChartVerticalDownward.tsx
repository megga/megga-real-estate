// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartVerticalDownward = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M13.373 17.644V12.7626C13.373 12.0887 13.9194 11.5423 14.5934 11.5423C15.2674 11.5423 15.8137 12.0887 15.8137 12.7626V17.644C15.8137 18.3179 15.2674 18.8643 14.5934 18.8643C13.9194 18.8643 13.373 18.318 13.373 17.644Z" stroke="currentColor"></path>
<path d="M18.5596 17.6441V15.661C18.5596 14.9871 19.1059 14.4407 19.7799 14.4407C20.4539 14.4407 21.0002 14.9871 21.0002 15.661V17.6441C21.0002 18.3181 20.4539 18.8644 19.7799 18.8644C19.1059 18.8644 18.5596 18.3181 18.5596 17.6441Z" stroke="currentColor"></path>
<path d="M8.18652 17.644V9.25424C8.18652 8.58027 8.73289 8.03391 9.40686 8.03391C10.0808 8.03391 10.6272 8.58027 10.6272 9.25424V17.644C10.6272 18.318 10.0808 18.8644 9.40686 18.8644C8.73289 18.8644 8.18652 18.318 8.18652 17.644Z" stroke="currentColor"></path>
<path d="M3 17.6442V6.35608C3 5.68211 3.54636 5.13574 4.22034 5.13574C4.89431 5.13574 5.44067 5.6821 5.44067 6.35608V17.6442C5.44067 18.3182 4.89431 18.8645 4.22034 18.8645C3.54636 18.8645 3 18.3182 3 17.6442Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartVerticalDownward.displayName = 'BarChartVerticalDownward'

export default BarChartVerticalDownward
