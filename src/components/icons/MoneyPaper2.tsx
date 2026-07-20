// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaper2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.18843 4.94983H17.8116C19.777 4.94983 21 6.33729 21 8.30075V15.6992C21 17.6627 19.777 19.0502 17.8106 19.0502H6.18843C4.22303 19.0502 3 17.6627 3 15.6992V8.30075C3 6.33729 4.22886 4.94983 6.18843 4.94983Z" stroke="currentColor"></path>
<path d="M6.21484 15.548H7.61787" stroke="currentColor"></path>
<path d="M17.7858 8.4502H16.3828" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.2888 11.9994C14.2888 10.7355 13.2642 9.71191 12.0013 9.71191C10.7374 9.71191 9.71289 10.7355 9.71289 11.9994C9.71289 13.2633 10.7374 14.2868 12.0013 14.2868C13.2642 14.2868 14.2888 13.2633 14.2888 11.9994Z" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaper2.displayName = 'MoneyPaper2'

export default MoneyPaper2
