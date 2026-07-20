// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ChartInformation = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 3.00085H16.2178C19.1659 3.00085 21 5.08204 21 8.02723V15.9745C21 18.9197 19.1659 21.0009 16.2169 21.0009H7.78313C4.83503 21.0009 3 18.9197 3 15.9745V8.02723C3 5.08204 4.84378 3.00085 7.78313 3.00085Z" stroke="currentColor"></path>
<path d="M7.57227 17.1226L10.9456 14.6211L13.5055 16.8745L17.3127 13.5946" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.8691 8.69296C13.8691 9.61241 14.6144 10.3577 15.5339 10.3577C16.4543 10.3577 17.1996 9.61241 17.1996 8.69296C17.1996 7.7735 16.4543 7.0282 15.5339 7.0282C14.6144 7.0282 13.8691 7.7735 13.8691 8.69296Z" stroke="currentColor"></path>
<path d="M6.68945 7.5907H9.17345M6.68945 10.5923H10.6349" stroke="currentColor"></path>
    </svg>
  ),
)

ChartInformation.displayName = 'ChartInformation'

export default ChartInformation
