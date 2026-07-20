// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserSearch = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.0048 18.7149C17.0802 19.6395 15.5805 19.6395 14.656 18.7149C13.7306 17.7904 13.7306 16.2907 14.656 15.3653C15.5805 14.4407 17.0802 14.4407 18.0048 15.3653C18.9293 16.2907 18.9293 17.7904 18.0048 18.7149ZM18.0048 18.7149L19.2876 19.9982" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.9239 7.981C14.9239 10.1795 13.1414 11.962 10.9429 11.962C8.74441 11.962 6.96191 10.1795 6.96191 7.981C6.96191 5.7825 8.74441 4 10.9429 4C13.1414 4 14.9239 5.7825 14.9239 7.981Z" stroke="currentColor"></path>
<path d="M10.9442 14.8359C7.57983 14.8359 4.71191 15.3445 4.71191 17.3795C4.71191 19.4154 7.56426 19.9413 10.9442 19.9413" stroke="currentColor"></path>
    </svg>
  ),
)

UserSearch.displayName = 'UserSearch'

export default UserSearch
