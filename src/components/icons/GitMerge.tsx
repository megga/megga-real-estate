// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GitMerge = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M6.60701 9.18473C5.17564 9.18473 4.01465 8.02374 4.01465 6.59237C4.01465 5.16099 5.17564 4 6.60701 4C8.03839 4 9.19938 5.16099 9.19938 6.59237C9.19938 8.02374 8.03839 9.18473 6.60701 9.18473Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.3931 19.8996C15.9618 19.8996 14.8008 18.7386 14.8008 17.3072C14.8008 15.8758 15.9618 14.7148 17.3931 14.7148C18.8245 14.7148 19.9855 15.8758 19.9855 17.3072C19.9855 18.7386 18.8245 19.8996 17.3931 19.8996Z" stroke="currentColor"></path>
<path d="M6.42578 9.18359V19.9992" stroke="currentColor"></path>
<path d="M6.42578 9.17188C6.63995 13.6249 10.2987 17.1765 14.8052 17.2033" stroke="currentColor"></path>
    </svg>
  ),
)

GitMerge.displayName = 'GitMerge'

export default GitMerge
