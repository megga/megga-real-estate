// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperTotal = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.18843 8.57446H17.8116C19.777 8.57446 21 9.96192 21 11.9254V17.482C21 19.4455 19.777 20.8329 17.8106 20.8329H6.18843C4.22303 20.8329 3 19.4455 3 17.482V11.9254C3 9.96192 4.22886 8.57446 6.18843 8.57446Z" stroke="currentColor"></path>
<path d="M5.95508 17.5906H7.35811" stroke="currentColor"></path>
<path d="M18.0437 11.8174H16.6406" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.2868 14.7035C14.2868 13.4396 13.2623 12.416 11.9994 12.416C10.7355 12.416 9.71094 13.4396 9.71094 14.7035C9.71094 15.9674 10.7355 16.9909 11.9994 16.9909C13.2623 16.9909 14.2868 15.9674 14.2868 14.7035Z" stroke="currentColor"></path>
<path d="M6.75391 5.82935H17.2474" stroke="currentColor"></path>
<path d="M8.69141 3.16699H15.3086" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperTotal.displayName = 'MoneyPaperTotal'

export default MoneyPaperTotal
