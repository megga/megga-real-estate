// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Flash = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.60113 12.4133L11.3044 3.3772C11.3875 3.15062 11.6032 3 11.8446 3H16.8091C17.2062 3 17.4839 3.39271 17.3516 3.76709L15.1561 8.91982C15.0238 9.2942 15.3015 9.68691 15.6986 9.68691H20.3863C20.8808 9.68691 21.1449 10.2695 20.8191 10.6414L11.9183 20.8009C11.5172 21.2586 10.7728 20.8615 10.9296 20.2735L12.6264 13.9104C12.7238 13.5452 12.4485 13.1868 12.0704 13.1868H8.14129C7.74132 13.1868 7.46339 12.7888 7.60113 12.4133Z" stroke="currentColor"></path>
<path d="M5.12258 20.9833L6.38721 17.8249H3.03711L4.38626 14.6836" stroke="currentColor"></path>
    </svg>
  ),
)

Flash.displayName = 'Flash'

export default Flash
