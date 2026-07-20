// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const WavingHand = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.0716 10.6052L14.4805 9.33423C13.9879 8.27501 14.4465 7.01695 15.5052 6.52325C16.2073 6.19587 17.0416 6.49499 17.3716 7.19584C17.8886 8.29388 18.5886 9.79614 18.823 10.3735C19.5584 12.1847 19.9747 14.0408 19.2327 16.0787C18.5957 17.8281 17.2899 19.2528 15.6025 20.0395C13.915 20.8261 11.9842 20.9102 10.2348 20.2732C8.48534 19.6363 7.06059 18.3304 6.27396 16.643L3.15992 9.95933C2.75624 9.09198 3.14469 8.0286 4.01142 7.62521C4.87799 7.2219 5.9394 7.60836 6.34418 8.47387L7.97695 11.9748" stroke="currentColor"></path>
<path d="M6.34414 8.47359L5.15894 5.93326C4.80223 5.07694 5.19577 4.06117 6.03631 3.6687C6.87684 3.27623 7.90828 3.62662 8.33582 4.44988L10.857 9.85755" stroke="currentColor"></path>
<path d="M14.7008 9.80886L12.1054 4.24284C11.6778 3.41959 10.6464 3.0692 9.80584 3.46167C8.97535 3.84945 8.58124 4.84571 8.916 5.69545" stroke="currentColor"></path>
<path d="M15.0715 10.6055C13.3585 11.402 12.568 13.5383 13.378 15.2657" stroke="currentColor"></path>
<path d="M5.63121 20.5333C4.05787 19.4844 3.66778 18.1469 3.45508 17.3867" stroke="currentColor"></path>
<path d="M21.0006 7.82736C21.007 5.46714 19.2227 4.59766 19.2227 4.59766" stroke="currentColor"></path>
    </svg>
  ),
)

WavingHand.displayName = 'WavingHand'

export default WavingHand
