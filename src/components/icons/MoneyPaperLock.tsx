// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.4116 19.0499H6.18941C4.22303 19.0499 3 17.6625 3 15.699V8.3005C3 6.33704 4.22303 4.94958 6.18843 4.94958H17.8116C19.7711 4.94958 21 6.33704 21 8.3005V10.299" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.1633 19.0495H19.7271C20.4295 19.0495 20.9987 18.4803 20.9987 17.7769V16.3378C20.9987 15.6354 20.4295 15.0662 19.7271 15.0662H17.1633C16.4608 15.0662 15.8906 15.6354 15.8906 16.3378V17.7769C15.8906 18.4803 16.4608 19.0495 17.1633 19.0495Z" stroke="currentColor"></path>
<path d="M16.9141 15.0907V14.144C16.9248 13.2985 17.6185 12.6222 18.463 12.6329C19.291 12.6427 19.9604 13.3092 19.9741 14.1372V15.0907" stroke="currentColor"></path>
<path d="M6.21289 8.4502H7.61592" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.71289 12.0003C9.71289 10.7365 10.7374 9.71289 12.0003 9.71289C13.2642 9.71289 14.2888 10.7365 14.2888 12.0003C14.2888 13.2642 13.2642 14.2878 12.0003 14.2878C10.7374 14.2878 9.71289 13.2642 9.71289 12.0003Z" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperLock.displayName = 'MoneyPaperLock'

export default MoneyPaperLock
