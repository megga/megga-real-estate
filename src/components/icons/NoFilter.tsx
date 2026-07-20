// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const NoFilter = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.06728 4.16211C4.02725 4.51845 3.29492 5.49863 3.29492 6.66773V8.69729C3.29492 9.68776 3.69055 10.638 4.38359 11.3413L8.72143 15.1938C9.00856 15.4809 9.16662 15.8672 9.16662 16.2731V19.4717C9.16662 20.5511 10.2562 21.2937 11.256 20.8878L13.1182 20.1451C13.7027 19.9169 14.089 19.353 14.089 18.7291V16.7585C14.089 16.3226 14.2667 15.9167 14.5838 15.6296L15.564 14.6588" stroke="currentColor"></path>
<path d="M3.91016 3L17.2108 16.3006" stroke="currentColor"></path>
<path d="M10.5625 4.00195H18.0485C19.5141 4.00195 20.7028 5.1907 20.7028 6.66564V8.01244C20.7028 9.07212 20.2567 10.0822 19.4748 10.7949L18.4058 11.8443" stroke="currentColor"></path>
    </svg>
  ),
)

NoFilter.displayName = 'NoFilter'

export default NoFilter
