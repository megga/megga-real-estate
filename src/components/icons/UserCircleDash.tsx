// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserCircleDash = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.32548 9.54707C3.06288 10.51 2.94811 11.5283 3.02689 12.5806" stroke="currentColor"></path>
<path d="M4.77686 6.63236C5.19702 6.05852 5.68527 5.53915 6.22896 5.08008" stroke="currentColor"></path>
<path d="M6.85109 19.3626C5.49528 18.425 4.40984 17.1187 3.73193 15.5801" stroke="currentColor"></path>
<path d="M17.5627 19.0879C16.2069 20.151 14.532 20.8376 12.6851 20.9757C11.7747 21.0438 10.8867 20.9718 10.0405 20.7822" stroke="currentColor"></path>
<path d="M19.6457 16.7244C20.5551 15.2558 21.0618 13.5197 20.9908 11.6639C20.7992 6.69099 16.6141 2.81611 11.6421 3.00674" stroke="currentColor"></path>
<path d="M8.42969 16.1887C8.42969 15.0254 9.35172 13.5724 11.9953 13.5724C14.6456 13.5724 15.5667 15.0118 15.5667 16.1751" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.2784 9.08449C14.2784 10.3431 13.2581 11.3633 11.9995 11.3633C10.741 11.3633 9.72168 10.3431 9.72168 9.08449C9.72168 7.82691 10.741 6.80664 11.9995 6.80664C13.2581 6.80664 14.2784 7.82691 14.2784 9.08449Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserCircleDash.displayName = 'UserCircleDash'

export default UserCircleDash
