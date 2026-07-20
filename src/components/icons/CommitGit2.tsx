// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CommitGit2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.9996 14.7765C10.4674 14.7765 9.22461 13.5337 9.22461 12.0015C9.22461 10.4693 10.4674 9.22656 11.9996 9.22656C13.5318 9.22656 14.7745 10.4693 14.7745 12.0015C14.7745 13.5337 13.5318 14.7765 11.9996 14.7765Z" stroke="currentColor"></path>
<path d="M9.22514 12.0039H4M20 12.0039H14.7749" stroke="currentColor"></path>
    </svg>
  ),
)

CommitGit2.displayName = 'CommitGit2'

export default CommitGit2
