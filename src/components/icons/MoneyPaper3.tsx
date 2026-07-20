// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaper3 = forwardRef<SVGSVGElement, Props>(
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
<path d="M6.67871 15.302V15.292" stroke="currentColor"></path>
<path d="M17.3213 8.70824V8.69824" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.2888 12.0003C14.2888 10.7365 13.2642 9.71289 12.0013 9.71289C10.7374 9.71289 9.71289 10.7365 9.71289 12.0003C9.71289 13.2642 10.7374 14.2878 12.0013 14.2878C13.2642 14.2878 14.2888 13.2642 14.2888 12.0003Z" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaper3.displayName = 'MoneyPaper3'

export default MoneyPaper3
