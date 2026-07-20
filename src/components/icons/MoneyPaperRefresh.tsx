// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperRefresh = forwardRef<SVGSVGElement, Props>(
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
<path d="M6.21289 8.45117C6.76081 8.45117 7.068 8.45117 7.61592 8.45117" stroke="currentColor"></path>
<path d="M20.1178 18.2584C19.6586 18.6641 19.0543 18.9103 18.3927 18.9103C16.9527 18.9103 15.7852 17.7427 15.7852 16.3027" stroke="currentColor"></path>
<path d="M16.668 14.3472C17.1272 13.9415 17.7314 13.6953 18.3931 13.6953C19.8331 13.6953 21.0006 14.8629 21.0006 16.3029" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.71094 12.0013C9.71094 10.7374 10.7355 9.71387 11.9984 9.71387C13.2623 9.71387 14.2868 10.7374 14.2868 12.0013C14.2868 13.2652 13.2623 14.2888 11.9984 14.2888C10.7355 14.2888 9.71094 13.2652 9.71094 12.0013Z" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperRefresh.displayName = 'MoneyPaperRefresh'

export default MoneyPaperRefresh
