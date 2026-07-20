// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ServerTree = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3 18.6744C3 19.769 3.88736 20.6564 4.98197 20.6564C6.07658 20.6564 6.96394 19.769 6.96394 18.6744C6.96394 17.5798 6.07668 16.6924 4.98208 16.6924C3.88747 16.6924 3 17.5798 3 18.6744Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.0352 18.6744C17.0352 19.769 17.9225 20.6564 19.0171 20.6564C20.1117 20.6564 20.9991 19.769 20.9991 18.6744C20.9991 17.5798 20.1121 16.6924 19.0174 16.6924C17.9228 16.6924 17.0352 17.5798 17.0352 18.6744Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.0176 18.6746C10.0176 19.7692 10.9049 20.6565 11.9995 20.6565C13.0942 20.6565 13.9815 19.7692 13.9815 18.6746C13.9815 17.58 13.0943 16.6934 11.9997 16.6934C10.905 16.6934 10.0176 17.58 10.0176 18.6746Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.7643 8.38965H7.50537C6.11206 8.38965 4.98242 7.26001 4.98242 5.8667C4.98242 4.47338 6.11206 3.34375 7.50537 3.34375H16.7643C18.1576 3.34375 19.2872 4.47338 19.2872 5.8667C19.2872 7.26001 18.1576 8.38965 16.7643 8.38965Z" stroke="currentColor"></path>
<path d="M4.98242 16.6923V14.687C4.98242 13.5797 5.88049 12.6816 6.98774 12.6816H17.0134C18.1206 12.6816 19.0187 13.5797 19.0187 14.687V16.6923" stroke="currentColor"></path>
<path d="M12 8.39062V16.6931" stroke="currentColor"></path>
    </svg>
  ),
)

ServerTree.displayName = 'ServerTree'

export default ServerTree
