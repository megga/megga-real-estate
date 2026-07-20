// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseQuestion = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.1246 18.5554C17.1148 17.7599 17.8386 17.4216 18.3765 17.1148C19.0334 16.7529 19.4779 16.1766 19.4779 15.3771C19.4779 14.1921 18.52 13.2422 17.3429 13.2422C16.1589 13.2422 15.209 14.1921 15.209 15.3771" stroke="currentColor"></path>
<path d="M17.1245 20.7084V20.7418" stroke="currentColor"></path>
<path d="M4.42773 11.5059V17.3196C4.42773 17.3196 4.42773 20.2275 11.7717 20.2275" stroke="currentColor"></path>
<path d="M19.0815 10.1894V5.69043" stroke="currentColor"></path>
<path d="M4.42773 5.69043V11.5042C4.42773 11.5042 4.42773 14.4111 11.7717 14.4111" stroke="currentColor"></path>
<path d="M11.755 8.69485C15.8017 8.69485 19.0823 7.37149 19.0823 5.73903C19.0823 4.10657 15.8017 2.7832 11.755 2.7832C7.70827 2.7832 4.42773 4.10657 4.42773 5.73903C4.42773 7.37149 7.70827 8.69485 11.755 8.69485Z" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseQuestion.displayName = 'DatabaseQuestion'

export default DatabaseQuestion
