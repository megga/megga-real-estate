// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DollarUp = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.8403 14.5296L19.977 13.9147L20.5919 16.0513" stroke="currentColor"></path>
<path d="M9.98047 21.0003L12.2339 17.3652L17.164 18.8413L19.9789 13.915" stroke="currentColor"></path>
<path d="M12.8943 8.22119H10.6097C9.92962 8.22119 9.37891 8.7719 9.37891 9.45104C9.37891 10.1312 9.92962 10.6819 10.6097 10.6819H12.0157C12.6948 10.6819 13.2455 11.2326 13.2455 11.9117C13.2455 12.5918 12.6948 13.1425 12.0157 13.1425H9.73113" stroke="currentColor"></path>
<path d="M11.3125 13.1412V14.1745M11.3125 7.18164V8.22371" stroke="currentColor"></path>
<path d="M19.2153 10.9036C19.2153 6.53875 15.6766 3 11.3118 3C6.94598 3 3.4082 6.53875 3.4082 10.9036C3.4082 13.6318 4.78984 16.037 6.89246 17.4576" stroke="currentColor"></path>
    </svg>
  ),
)

DollarUp.displayName = 'DollarUp'

export default DollarUp
