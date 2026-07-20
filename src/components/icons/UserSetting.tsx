// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserSetting = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M15.1554 7.95073C15.1554 10.1319 13.3867 11.9015 11.2046 11.9015C9.02257 11.9015 7.25391 10.1319 7.25391 7.95073C7.25391 5.76866 9.02257 4 11.2046 4C13.3867 4 15.1554 5.76866 15.1554 7.95073Z" stroke="currentColor"></path>
<path d="M16.6002 14.5156V15.4298M16.6002 19.0866V20.0008M14.2227 15.8868L15.0114 16.3443M18.1889 18.1722L18.9777 18.6298M14.2227 18.6295L15.0114 18.172M18.1889 16.3443L18.9777 15.8868M17.8933 15.9644C18.6077 16.6788 18.6077 17.8368 17.8933 18.5512C17.1798 19.2647 16.0218 19.2647 15.3082 18.5512C14.5938 17.8368 14.5938 16.6788 15.3082 15.9644C16.0218 15.2517 17.1798 15.2517 17.8933 15.9644Z" stroke="currentColor"></path>
<path d="M11.2062 14.7539C7.86777 14.7539 5.02148 15.2581 5.02148 17.2785C5.02148 19.2988 7.85221 19.8203 11.2062 19.8203" stroke="currentColor"></path>
    </svg>
  ),
)

UserSetting.displayName = 'UserSetting'

export default UserSetting
