// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const BarChartVerticalUpward = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M10.6272 17.644V12.7626C10.6272 12.0887 10.0808 11.5423 9.40686 11.5423C8.73289 11.5423 8.18652 12.0887 8.18652 12.7626V17.644C8.18652 18.3179 8.73289 18.8643 9.40686 18.8643C10.0808 18.8643 10.6272 18.318 10.6272 17.644Z" stroke="currentColor"></path>
<path d="M5.44067 17.6441V15.661C5.44067 14.9871 4.89431 14.4407 4.22034 14.4407C3.54636 14.4407 3 14.9871 3 15.661V17.6441C3 18.3181 3.54636 18.8644 4.22034 18.8644C4.89431 18.8644 5.44067 18.3181 5.44067 17.6441Z" stroke="currentColor"></path>
<path d="M15.8137 17.644V9.25424C15.8137 8.58027 15.2674 8.03391 14.5934 8.03391C13.9194 8.03391 13.373 8.58027 13.373 9.25424V17.644C13.373 18.318 13.9194 18.8644 14.5934 18.8644C15.2674 18.8644 15.8137 18.318 15.8137 17.644Z" stroke="currentColor"></path>
<path d="M21.0002 17.6442V6.35608C21.0002 5.68211 20.4539 5.13574 19.7799 5.13574C19.1059 5.13574 18.5596 5.6821 18.5596 6.35608V17.6442C18.5596 18.3182 19.1059 18.8645 19.7799 18.8645C20.4539 18.8645 21.0002 18.3182 21.0002 17.6442Z" stroke="currentColor"></path>
    </svg>
  ),
)

BarChartVerticalUpward.displayName = 'BarChartVerticalUpward'

export default BarChartVerticalUpward
