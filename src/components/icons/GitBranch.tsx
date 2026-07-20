// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GitBranch = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.0619 14.6249V11.687C17.0619 10.5913 16.1737 9.70312 15.0781 9.70312H12.333" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.0628 19.9967C15.5971 19.9967 14.4082 18.8078 14.4082 17.3421C14.4082 15.8764 15.5971 14.6875 17.0628 14.6875C18.5285 14.6875 19.7174 15.8764 19.7174 17.3421C19.7174 18.8078 18.5285 19.9967 17.0628 19.9967Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M6.9378 12.3287C5.47206 12.3287 4.2832 11.1399 4.2832 9.67413C4.2832 8.20839 5.47206 7.01953 6.9378 7.01953C8.40354 7.01953 9.59239 8.20839 9.59239 9.67413C9.59239 11.1399 8.40354 12.3287 6.9378 12.3287Z" stroke="currentColor"></path>
<path d="M6.9377 7.02072L6.9375 4M6.9375 20V12.3286" stroke="currentColor"></path>
    </svg>
  ),
)

GitBranch.displayName = 'GitBranch'

export default GitBranch
