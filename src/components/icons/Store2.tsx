// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12 10.3921C12 11.5645 11.0494 12.5151 9.87697 12.5151H9.62303C8.45059 12.5151 7.5 11.5645 7.5 10.3921" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.5 10.3921C16.5 11.5645 15.5494 12.5151 14.377 12.5151H14.123C12.9506 12.5151 12 11.5645 12 10.3921" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M7.5 10.3921C7.5 11.5645 6.54941 12.5145 5.37697 12.5145H5.12303C3.95059 12.5145 3 11.5639 3 10.3915V8.86877C3 7.59709 4.03135 6.56671 5.30303 6.56671H18.697C19.9686 6.56671 21 7.59709 21 8.86877V10.3915C21 11.5639 20.0494 12.5145 18.877 12.5145H18.623C17.4506 12.5145 16.5 11.5645 16.5 10.3921" stroke="currentColor"></path>
<path d="M4.68945 12.4719V18.5579C4.68945 19.5221 5.47172 20.3043 6.43594 20.3043H17.5638C18.529 20.3043 19.3113 19.5221 19.3113 18.5579V12.47" stroke="currentColor"></path>
<path d="M14.1235 20.3045V17.7466C14.1235 16.5741 13.1729 15.6235 12.0005 15.6235C10.828 15.6235 9.87744 16.5741 9.87744 17.7466V20.3045" stroke="currentColor"></path>
<path d="M4.68945 6.56656V5.4418C4.68945 4.47758 5.47172 3.69531 6.43594 3.69531H17.5638C18.529 3.69531 19.3113 4.47758 19.3113 5.4418V6.56656" stroke="currentColor"></path>
    </svg>
  ),
)

Store2.displayName = 'Store2'

export default Store2
