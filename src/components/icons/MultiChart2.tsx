// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MultiChart2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.7312 7.02476C20.7312 4.80249 18.9296 3.00049 16.7069 3.00049C14.4842 3.00049 12.6826 4.80249 12.6826 7.02476C12.6826 9.24747 14.4842 11.049 16.7069 11.049C18.9296 11.049 20.7312 9.24747 20.7312 7.02476Z" stroke="currentColor"></path>
<path d="M16.5679 3.00196V6.71526C16.5679 6.96221 16.7681 7.16241 17.015 7.16241H20.7283" stroke="currentColor"></path>
<path d="M14.5127 21.0004L14.5127 16.4687" stroke="currentColor"></path>
<path d="M10.7646 21.0003L10.7646 12.9196" stroke="currentColor"></path>
<path d="M7.0166 21.0005L7.0166 16.8606" stroke="currentColor"></path>
<path d="M3.26904 21.0004L3.26904 11.937" stroke="currentColor"></path>
    </svg>
  ),
)

MultiChart2.displayName = 'MultiChart2'

export default MultiChart2
