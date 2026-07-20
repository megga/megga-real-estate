// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Key3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M15.7844 9.48354C15.8154 10.4785 15.6194 11.4136 15.2494 12.2566L19.9324 16.9395C20.6114 17.6275 20.9994 18.5546 20.9994 19.5246V19.9785C20.9994 20.6915 20.4214 21.2705 19.7074 21.2705H17.3524C16.6384 21.2705 16.0604 20.6915 16.0604 19.9785C16.0604 19.2785 15.5034 18.7065 14.8034 18.6875L14.7234 18.6855C14.0134 18.6655 13.4534 18.0786 13.4674 17.3686L13.4854 16.4285L12.3914 15.3346C11.1584 15.9956 9.66936 16.2655 8.11536 15.9585C5.57136 15.4575 3.53537 13.3755 3.09737 10.8205C2.38937 6.70352 5.64036 3.13551 9.66436 3.30251C12.9564 3.43851 15.6804 6.19154 15.7844 9.48354Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.9285 9.69226C10.9285 8.84426 10.2415 8.15625 9.39247 8.15625C8.54347 8.15625 7.85547 8.84426 7.85547 9.69226C7.85547 10.5413 8.54347 11.2293 9.39247 11.2293C10.2415 11.2293 10.9285 10.5413 10.9285 9.69226Z" stroke="currentColor"></path>
    </svg>
  ),
)

Key3.displayName = 'Key3'

export default Key3
