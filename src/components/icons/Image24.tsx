// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Image24 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M2.75 12.0001C2.75 18.9371 5.063 21.2501 12 21.2501C18.937 21.2501 21.25 18.9371 21.25 12.0001C21.25 5.06312 18.937 2.75012 12 2.75012C5.063 2.75012 2.75 5.06312 2.75 12.0001Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.5987 8.78419C10.5987 9.75719 9.81066 10.5452 8.83766 10.5452C7.86566 10.5452 7.07666 9.75719 7.07666 8.78419C7.07666 7.81119 7.86566 7.02319 8.83766 7.02319C9.81066 7.02319 10.5987 7.81119 10.5987 8.78419Z" stroke="currentColor"></path>
<path d="M21.1201 14.6666C20.2391 13.7606 18.9931 11.9296 16.7041 11.9296C14.4151 11.9296 14.3651 15.9676 12.0291 15.9676C9.69206 15.9676 8.75106 14.5966 7.22806 15.3126C5.70606 16.0276 4.46606 18.8736 4.46606 18.8736" stroke="currentColor"></path>
    </svg>
  ),
)

Image24.displayName = 'Image24'

export default Image24
