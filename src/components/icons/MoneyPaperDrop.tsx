// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperDrop = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.6037 9.18134H6.3971C4.5016 9.18134 3.32227 10.5193 3.32227 12.4119V17.7695C3.32227 19.663 4.5016 21 6.39808 21H17.6037C19.4982 21 20.6776 19.663 20.6776 17.7695V12.4119C20.6776 10.5193 19.4934 9.18134 17.6037 9.18134Z" stroke="currentColor"></path>
<path d="M6.42188 11.8418H7.77441" stroke="currentColor"></path>
<path d="M17.5771 18.3418H16.2246" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.79297 15.0916C9.79297 13.8734 10.7806 12.8857 11.9989 12.8857C13.2171 12.8857 14.2048 13.8734 14.2048 15.0916C14.2048 16.3099 13.2171 17.2976 11.9989 17.2976C10.7806 17.2976 9.79297 16.3099 9.79297 15.0916Z" stroke="currentColor"></path>
<path d="M8.11719 6.33708V4.8454" stroke="currentColor"></path>
<path d="M15.8799 6.33708V4.8454" stroke="currentColor"></path>
<path d="M11.998 6.33756V3" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperDrop.displayName = 'MoneyPaperDrop'

export default MoneyPaperDrop
