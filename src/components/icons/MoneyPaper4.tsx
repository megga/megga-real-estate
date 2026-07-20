// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaper4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M6.18843 4.94983H17.8116C19.777 4.94983 21 6.33729 21 8.30075V15.6992C21 17.6627 19.777 19.0502 17.8106 19.0502H6.18843C4.22303 19.0502 3 17.6627 3 15.6992V8.30075C3 6.33729 4.22886 4.94983 6.18843 4.94983Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.2883 12.0003C14.2883 10.7365 13.2638 9.71289 12.0008 9.71289C10.7369 9.71289 9.7124 10.7365 9.7124 12.0003C9.7124 13.2642 10.7369 14.2878 12.0008 14.2878C13.2638 14.2878 14.2883 13.2642 14.2883 12.0003Z" stroke="currentColor"></path>
<path d="M6.67969 12.0051V11.9951" stroke="currentColor"></path>
<path d="M17.3223 12.0051V11.9951" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaper4.displayName = 'MoneyPaper4'

export default MoneyPaper4
