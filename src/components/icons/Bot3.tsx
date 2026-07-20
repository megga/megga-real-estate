// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Bot3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.06985 7.59375H14.9302C16.9784 7.59375 18.253 9.03962 18.253 11.0858V14.3454C18.253 16.3916 16.9784 17.8375 14.9292 17.8375H9.06985C7.0217 17.8375 5.74707 16.3916 5.74707 14.3454V11.0858C5.74707 9.03962 7.02753 7.59375 9.06985 7.59375Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.2574 4.25711C13.2574 3.56239 12.694 3 12.0003 3C11.3056 3 10.7422 3.56239 10.7422 4.25711C10.7422 4.95183 11.3055 5.51421 12.0002 5.51421C12.694 5.51421 13.2574 4.95183 13.2574 4.25711Z" stroke="currentColor"></path>
<path d="M12 7.59394V5.51562" stroke="currentColor"></path>
<path d="M9.75195 11.1545V11.1445" stroke="currentColor"></path>
<path d="M14.2471 11.1545V11.1445" stroke="currentColor"></path>
<path d="M10.6221 14.4023H13.3776" stroke="currentColor"></path>
<path d="M8.04492 21.0016C8.98484 20.4567 10.4122 20.1055 12.0021 20.1055C13.592 20.1055 15.0106 20.4567 15.9505 21.0016" stroke="currentColor"></path>
<path d="M20.5471 11.25V14.026M3.45312 11.25V14.026" stroke="currentColor"></path>
    </svg>
  ),
)

Bot3.displayName = 'Bot3'

export default Bot3
