// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperUpload = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.4631 9.47723H6.53773C4.69008 9.47723 3.54004 10.781 3.54004 12.6267V17.8505C3.54004 19.6953 4.69008 21 6.53871 21H17.4631C19.3108 21 20.4598 19.6953 20.4598 17.8505V12.6267C20.4598 10.781 19.3049 9.47723 17.4631 9.47723Z" stroke="currentColor"></path>
<path d="M6.5625 12.0703H7.88086" stroke="currentColor"></path>
<path d="M17.4395 18.4072H16.1211" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.85156 15.2391C9.85156 14.0511 10.8148 13.0889 12.0018 13.0889C13.1898 13.0889 14.153 14.0511 14.153 15.2391C14.153 16.4271 13.1898 17.3894 12.0018 17.3894C10.8148 17.3894 9.85156 16.4271 9.85156 15.2391Z" stroke="currentColor"></path>
<path d="M13.8679 5.00819L11.8598 3L9.85156 5.00819" stroke="currentColor"></path>
<path d="M11.8599 3L11.8594 7.15454" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperUpload.displayName = 'MoneyPaperUpload'

export default MoneyPaperUpload
