// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HoldRecord = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 15.531V17.1082C3 19.2574 4.74256 21 6.89278 21H8.14984" stroke="currentColor"></path>
<path d="M20.9984 15.5312V17.1084C20.9984 19.2577 19.2558 21.0002 17.1056 21.0002H15.8164" stroke="currentColor"></path>
<path d="M3 8.46994V6.89278C3 4.74256 4.74256 3 6.89278 3H8.18194" stroke="currentColor"></path>
<path d="M20.9994 8.46994V6.89278C20.9994 4.74256 19.2569 3 17.1067 3H15.8496" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.1983 11.9991C16.1983 14.3176 14.3186 16.1983 11.9991 16.1983C9.68053 16.1983 7.80078 14.3176 7.80078 11.9991C7.80078 9.68053 9.68053 7.80078 11.9991 7.80078C14.3186 7.80078 16.1983 9.68053 16.1983 11.9991Z" stroke="currentColor"></path>
<path d="M12.0002 12.0513V12.0031M12.0002 11.75C11.862 11.75 11.75 11.862 11.75 11.9998C11.75 12.138 11.862 12.25 12.0002 12.25C12.1385 12.25 12.2505 12.138 12.2505 11.9998C12.2505 11.862 12.1385 11.75 12.0002 11.75Z" stroke="currentColor"></path>
    </svg>
  ),
)

HoldRecord.displayName = 'HoldRecord'

export default HoldRecord
