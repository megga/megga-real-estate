// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperAdd = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.4116 19.0502H6.18941C4.22303 19.0502 3 17.6627 3 15.6992V8.30075C3 6.33729 4.22303 4.94983 6.18843 4.94983H17.8116C19.7711 4.94983 21 6.33729 21 8.30075V10.2992" stroke="currentColor"></path>
<path d="M6.21289 8.45117H7.61592" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.71094 12.0003C9.71094 10.7365 10.7355 9.71289 11.9984 9.71289C13.2623 9.71289 14.2868 10.7365 14.2868 12.0003C14.2868 13.2642 13.2623 14.2878 11.9984 14.2878C10.7355 14.2878 9.71094 13.2642 9.71094 12.0003Z" stroke="currentColor"></path>
<path d="M18.4004 16.5211L20.7531 16.522M18.4004 16.5211L16.0469 16.5201M18.4004 16.5211L18.4019 18.8742M18.4004 16.5211L18.4 14.168" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperAdd.displayName = 'MoneyPaperAdd'

export default MoneyPaperAdd
