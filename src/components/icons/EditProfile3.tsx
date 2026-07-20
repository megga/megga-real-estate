// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const EditProfile3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M16.2791 17.1804L15.4362 17.3222C14.8195 17.4251 14.2747 16.9114 14.3427 16.2898L14.4359 15.4197C14.4815 15.0001 14.6573 14.6058 14.939 14.2902L18.2564 10.6367C18.6905 10.1677 19.4228 10.1395 19.8909 10.5736L20.6658 11.2913C21.1349 11.7244 21.1631 12.4567 20.729 12.9258L17.4513 16.5346C17.1454 16.8774 16.7317 17.1046 16.2791 17.1804Z" stroke="currentColor"></path>
<path d="M14.7166 19.8768H5.30429C3.89695 19.8768 3.04653 18.9636 2.98633 17.6917C2.98633 15.1029 5.78845 14.2098 10.0104 14.1797C10.4799 14.1841 10.9319 14.1991 11.3645 14.2257" stroke="currentColor" strokeMiterlimit="10"></path>
<path d="M10.0165 11.2244C11.9769 11.2244 13.5662 9.63513 13.5662 7.67469C13.5662 5.71425 11.9769 4.125 10.0165 4.125C8.05605 4.125 6.4668 5.71425 6.4668 7.67469C6.4668 9.63513 8.05605 11.2244 10.0165 11.2244Z" stroke="currentColor" strokeMiterlimit="10"></path>
    </svg>
  ),
)

EditProfile3.displayName = 'EditProfile3'

export default EditProfile3
