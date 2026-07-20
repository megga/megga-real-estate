// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const WebsiteLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.6916 12.9952V8.13916C20.6916 5.29416 18.9206 3.28516 16.0736 3.28516H7.92664C5.08864 3.28516 3.30859 5.29416 3.30859 8.13916V15.8141C3.30859 18.6591 5.08064 20.6691 7.92664 20.6691H9.61761" stroke="currentColor"></path>
<path d="M9.21667 6.64062H9.20673M6.73071 6.64062H6.7207H6.73071ZM11.7027 6.64062H11.6927H11.7027Z" stroke="currentColor"></path>
<path d="M20.6916 9.55469H3.30859" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.8123 21.2825H14.5613C13.6693 21.2825 12.9473 20.5595 12.9473 19.6685V17.8434C12.9473 16.9514 13.6693 16.2305 14.5613 16.2305H17.8123C18.7033 16.2305 19.4263 16.9514 19.4263 17.8434V19.6685C19.4263 20.5595 18.7033 21.2825 17.8123 21.2825Z" stroke="currentColor"></path>
<path d="M18.1271 16.2627V15.0607C18.1141 13.9897 17.234 13.1317 16.162 13.1447C15.112 13.1577 14.2641 14.0037 14.2461 15.0537V16.2627" stroke="currentColor"></path>
    </svg>
  ),
)

WebsiteLock.displayName = 'WebsiteLock'

export default WebsiteLock
