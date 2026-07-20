// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperRemove = forwardRef<SVGSVGElement, Props>(
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
      <path d="M12.4116 19.0502H6.18941C4.22303 19.0502 3 17.6627 3 15.6992V8.30075C3 6.33729 4.22303 4.94983 6.18843 4.94983H17.8116C19.7711 4.94983 21 6.33729 21 8.30075V10.2992" stroke="currentColor"></path>
<path d="M6.21484 8.45117H7.61787" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.71289 12.0013C9.71289 10.7374 10.7374 9.71387 12.0003 9.71387C13.2642 9.71387 14.2888 10.7374 14.2888 12.0013C14.2888 13.2652 13.2642 14.2888 12.0003 14.2888C10.7374 14.2888 9.71289 13.2652 9.71289 12.0013Z" stroke="currentColor"></path>
<path d="M20.5796 14.6113L18.6716 16.5213M18.6716 16.5213L16.7637 18.4301M18.6716 16.5213L16.7637 14.6113M18.6716 16.5213L20.5796 18.4301" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperRemove.displayName = 'MoneyPaperRemove'

export default MoneyPaperRemove
