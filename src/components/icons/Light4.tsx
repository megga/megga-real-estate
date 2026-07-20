// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Light4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.05664 21H18.7621M11.3174 4.9351L12.6125 3.64001C13.4658 2.78666 14.8621 2.78666 15.7155 3.64001C16.1456 4.07105 16.3538 4.63443 16.3616 5.191C16.3538 5.71838 16.1679 6.24576 15.7894 6.65346C15.767 6.69043 14.4204 8.03807 14.4204 8.03807M9.70374 18.9779H10.5726" stroke="currentColor"></path>
<path d="M15.9705 6.56641C19.634 10.6813 19.6505 17.9206 14.8516 21.0012" stroke="currentColor"></path>
<path d="M13.1801 6.17224C10.9869 3.97905 7.43147 3.97905 5.23828 6.17224L13.1801 14.114C15.3733 11.9209 15.3733 8.36543 13.1801 6.17224Z" stroke="currentColor"></path>
<path d="M6.05273 10.2578C6.34367 12.0851 7.26901 13.1866 9.07591 13.281" stroke="currentColor"></path>
    </svg>
  ),
)

Light4.displayName = 'Light4'

export default Light4
