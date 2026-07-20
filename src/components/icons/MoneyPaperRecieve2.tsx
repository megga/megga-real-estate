// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperRecieve2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.3116 19.0498H6.18941C4.22303 19.0498 3 17.6623 3 15.6989V8.30038C3 6.33692 4.22303 4.94946 6.18843 4.94946H17.8116C19.7711 4.94946 21 6.33692 21 8.30038V10.2989" stroke="currentColor"></path>
<path d="M6.21289 8.4502H7.61592" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.71289 12.0003C9.71289 10.7365 10.7374 9.71289 12.0003 9.71289C13.2642 9.71289 14.2888 10.7365 14.2888 12.0003C14.2888 13.2642 13.2642 14.2878 12.0003 14.2878C10.7374 14.2878 9.71289 13.2642 9.71289 12.0003Z" stroke="currentColor"></path>
<path d="M16.7266 16.9141L18.8632 19.0507L20.9989 16.9141" stroke="currentColor"></path>
<path d="M18.8633 14V19.0497" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperRecieve2.displayName = 'MoneyPaperRecieve2'

export default MoneyPaperRecieve2
