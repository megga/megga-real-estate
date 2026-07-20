// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CommitGit = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 3H16.2178C19.1659 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.1659 21 16.2169 21H7.78313C4.83503 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84378 3 7.78313 3Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.9994 14.0173C10.8844 14.0173 9.98047 13.1134 9.98047 11.9984C9.98047 10.8834 10.8844 9.98047 11.9994 9.98047C13.1144 9.98047 14.0183 10.8834 14.0183 11.9984C14.0183 13.1134 13.1144 14.0173 11.9994 14.0173Z" stroke="currentColor"></path>
<path d="M9.98109 12.0039H6.17969M17.82 12.0039H14.0186" stroke="currentColor"></path>
    </svg>
  ),
)

CommitGit.displayName = 'CommitGit'

export default CommitGit
