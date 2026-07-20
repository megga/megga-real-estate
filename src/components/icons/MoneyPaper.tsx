// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaper = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.68348 4.64288H15.4687C17.1238 4.64288 18.1532 5.81046 18.1532 7.46355V13.6916C18.1532 15.3447 17.1238 16.5132 15.4678 16.5132H5.68348C4.02941 16.5132 3 15.3447 3 13.6916V7.46355C3 5.81046 4.03428 4.64288 5.68348 4.64288Z" stroke="currentColor"></path>
<path d="M18.15 7.48535H18.3203C19.9714 7.48535 20.9999 8.65585 20.9999 10.307V16.535C20.9999 18.1872 19.9714 19.3567 18.3106 19.3567H8.53404C6.87316 19.3567 5.84375 18.1872 5.84375 16.535" stroke="currentColor"></path>
<path d="M5.70703 13.5655H6.88823" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.5044 10.5777C12.5044 9.51422 11.6423 8.65216 10.5788 8.65216C9.5144 8.65216 8.65234 9.51422 8.65234 10.5777C8.65234 11.6412 9.5144 12.5032 10.5788 12.5032C11.6423 12.5032 12.5044 11.6412 12.5044 10.5777Z" stroke="currentColor"></path>
<path d="M15.4488 7.58984H14.2676" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaper.displayName = 'MoneyPaper'

export default MoneyPaper
