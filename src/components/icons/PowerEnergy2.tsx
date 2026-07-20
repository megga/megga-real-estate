// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PowerEnergy2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7.4502 10.4024C7.4502 13.0626 9.73285 15.1894 12.4465 14.9301C14.8115 14.705 16.5493 12.5835 16.5493 10.2071V6.99041C16.5493 6.43245 16.0973 5.98047 15.5394 5.98047H8.45926C7.90217 5.98047 7.4502 6.43245 7.4502 6.99041V10.4024Z" stroke="currentColor"></path>
<path d="M12 21.0009V15.0977" stroke="currentColor"></path>
<path d="M9.71191 3V5.97902M14.2883 3V5.97902" stroke="currentColor"></path>
<path d="M11.9905 11.156L13.503 8.56898H10.4961L12.007 5.98047" stroke="currentColor"></path>
<path d="M19.7119 9.32031H21.1283" stroke="currentColor"></path>
<path d="M4.54395 9.32031H3.12758" stroke="currentColor"></path>
<path d="M19.0977 4.58594L20.3243 3.87776" stroke="currentColor"></path>
<path d="M5.1582 4.58594L3.9316 3.87776" stroke="currentColor"></path>
<path d="M19.0977 14.0586L20.3243 14.7668" stroke="currentColor"></path>
<path d="M5.1582 14.0586L3.9316 14.7668" stroke="currentColor"></path>
    </svg>
  ),
)

PowerEnergy2.displayName = 'PowerEnergy2'

export default PowerEnergy2
