// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const InternetServer = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.2328 9.23261C18.2328 5.79037 15.4424 3 12.0002 3C8.55795 3 5.76758 5.79037 5.76758 9.23261C5.76758 12.6749 8.55819 15.4652 12.0004 15.4652C15.4427 15.4652 18.2328 12.6749 18.2328 9.23261Z" stroke="currentColor"></path>
<path d="M14.3206 9.23261C14.3206 5.79037 13.281 3 11.9997 3C10.7183 3 9.67969 5.79037 9.67969 9.23261C9.67969 12.6749 10.7186 15.4652 11.9999 15.4652C13.2813 15.4652 14.3206 12.6749 14.3206 9.23261Z" stroke="currentColor"></path>
<path d="M18.2328 9.23242H5.76758" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.5955 19.4032C13.5955 20.2847 12.8804 20.9998 11.9989 20.9998C11.1174 20.9998 10.4023 20.2847 10.4023 19.4032C10.4023 18.5217 11.1174 17.8066 11.9989 17.8066C12.8804 17.8066 13.5955 18.5217 13.5955 19.4032Z" stroke="currentColor"></path>
<path d="M18.202 19.4033H13.5738M10.4193 19.4033H5.80078" stroke="currentColor"></path>
<path d="M12 17.8018V15.4648" stroke="currentColor"></path>
    </svg>
  ),
)

InternetServer.displayName = 'InternetServer'

export default InternetServer
