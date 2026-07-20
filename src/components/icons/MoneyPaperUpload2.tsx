// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperUpload2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.4229 9.21387H17.5885C19.4721 9.21387 20.6532 10.5478 20.6532 12.4362V17.7786C20.6532 19.6661 19.4779 21 17.5885 21H6.41337C4.52296 21 3.34668 19.6661 3.34668 17.7786V12.4362C3.34668 10.5478 4.52296 9.21387 6.4124 9.21387H8.07904" stroke="currentColor"></path>
<path d="M14.055 5.05387L12.0011 3L9.94727 5.05387" stroke="currentColor"></path>
<path d="M12.002 8.82302V3.00098" stroke="currentColor"></path>
<path d="M6.4375 11.8652H7.78599" stroke="currentColor"></path>
<path d="M17.5633 18.3467H16.2148" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.80078 15.1061C9.80078 13.8909 10.7854 12.9062 12.0006 12.9062C13.2158 12.9062 14.2004 13.8909 14.2004 15.1061C14.2004 16.3213 13.2158 17.3059 12.0006 17.3059C10.7854 17.3059 9.80078 16.3213 9.80078 15.1061Z" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperUpload2.displayName = 'MoneyPaperUpload2'

export default MoneyPaperUpload2
