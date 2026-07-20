// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarAdd = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 16.968 16.968 21 12 21C7.032 21 3 16.968 3 12C3 7.032 7.032 3 12 3" stroke="currentColor"></path>
<path d="M18.6062 5.39373L20.9715 5.3947M18.6062 5.39373L16.2402 5.39278M18.6062 5.39373V7.75856M18.6062 5.39373L18.6057 3.02734" stroke="currentColor"></path>
<path d="M13.8133 9.1377H11.2018C10.4244 9.1377 9.79492 9.76721 9.79492 10.5436C9.79492 11.321 10.4244 11.9506 11.2018 11.9506H12.8092C13.5856 11.9506 14.2151 12.5801 14.2151 13.3565C14.2151 14.1339 13.5856 14.7634 12.8092 14.7634H10.1968" stroke="currentColor"></path>
<path d="M12.0039 14.7629V15.9441M12.0039 7.9502V9.14111" stroke="currentColor"></path>
    </svg>
  ),
)

DollarAdd.displayName = 'DollarAdd'

export default DollarAdd
