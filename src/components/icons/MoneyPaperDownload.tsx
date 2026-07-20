// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperDownload = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.4641 9.47754H6.53871C4.69106 9.47754 3.54102 10.7813 3.54102 12.627V17.8508C3.54102 19.6956 4.69106 21.0003 6.53968 21.0003H17.4641C19.3117 21.0003 20.4608 19.6956 20.4608 17.8508V12.627C20.4608 10.7813 19.3059 9.47754 17.4641 9.47754Z" stroke="currentColor"></path>
<path d="M9.85156 5.14642L11.8598 7.15461L13.8679 5.14642" stroke="currentColor"></path>
<path d="M11.8599 7.1546L11.8594 3" stroke="currentColor"></path>
<path d="M6.5625 12.0703H7.88086" stroke="currentColor"></path>
<path d="M17.4395 18.4072H16.1211" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.85156 15.2391C9.85156 14.0511 10.8148 13.0889 12.0018 13.0889C13.1898 13.0889 14.153 14.0511 14.153 15.2391C14.153 16.4271 13.1898 17.3894 12.0018 17.3894C10.8148 17.3894 9.85156 16.4271 9.85156 15.2391Z" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperDownload.displayName = 'MoneyPaperDownload'

export default MoneyPaperDownload
