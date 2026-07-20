// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DonutBarChart4 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M3 12.0005C3 16.1546 6.23655 19.5528 10.3255 19.8108C10.6013 19.8282 10.826 19.6025 10.826 19.3262V17.0762C10.826 16.7998 10.6012 16.5786 10.3264 16.5488C8.03462 16.2999 6.25081 14.3585 6.25081 12.0005C6.25081 9.64255 8.03462 7.70119 10.3264 7.45229C10.6012 7.42245 10.826 7.20129 10.826 6.92492V4.67492C10.826 4.39855 10.6013 4.17285 10.3255 4.19026C6.23655 4.44834 3 7.84647 3 12.0005Z" stroke="currentColor"></path>
<path d="M13.6892 3.00888C13.4134 2.99148 13.189 3.21719 13.189 3.49356V5.74355C13.189 6.01992 13.4137 6.24108 13.6885 6.27092C14.7446 6.38559 15.6929 6.8597 16.4084 7.56837C17.1345 8.28745 17.6209 9.24803 17.7372 10.3197C17.7671 10.5944 17.9882 10.8192 18.2646 10.8192H20.5146C20.791 10.8192 21.0167 10.5948 20.9993 10.319C20.8719 8.2997 19.9788 6.48831 18.607 5.17188C17.3132 3.9303 15.5936 3.12901 13.6892 3.00888Z" stroke="currentColor"></path>
<path d="M13.189 20.5074C13.189 20.7838 13.4137 21.0095 13.6895 20.9921C17.613 20.7444 20.7516 17.6058 20.9993 13.6823C21.0167 13.4065 20.791 13.1818 20.5146 13.1818H18.2646C17.9882 13.1818 17.7671 13.4066 17.7372 13.6814C17.5061 15.8091 15.8163 17.499 13.6886 17.73C13.4138 17.7599 13.189 17.981 13.189 18.2574V20.5074Z" stroke="currentColor"></path>
    </svg>
  ),
)

DonutBarChart4.displayName = 'DonutBarChart4'

export default DonutBarChart4
