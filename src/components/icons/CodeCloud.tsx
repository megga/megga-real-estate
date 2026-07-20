// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CodeCloud = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.97186 5.16406C3 5.16406 7.97186 12.0001 3 12.0001C7.97186 12.0001 3 18.8362 7.97186 18.8362" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.99477 11.3148C9.06558 11.3226 8.31445 11.9473 8.31445 13.0107C8.31445 13.6986 8.72407 14.2912 9.31174 14.5568C9.55985 14.657 9.80601 14.6959 9.99379 14.6959H14.0053C14.1931 14.6959 14.4402 14.6589 14.6913 14.5587C15.2789 14.2931 15.6876 13.6986 15.6876 13.0107C15.6876 11.9473 14.9365 11.3226 14.0073 11.3148C14.0073 10.6464 13.4819 9.30859 12.001 9.30859C10.5192 9.30859 9.99477 10.6464 9.99477 11.3148Z" stroke="currentColor"></path>
<path d="M16.0283 5.16406C21.0002 5.16406 16.0283 12.0001 21.0002 12.0001C16.0283 12.0001 21.0002 18.8362 16.0283 18.8362" stroke="currentColor"></path>
    </svg>
  ),
)

CodeCloud.displayName = 'CodeCloud'

export default CodeCloud
