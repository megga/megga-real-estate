// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ScreenSize = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 16.2178V7.78313C3 4.83503 5.08119 3 8.02638 3H15.9736C18.9188 3 21 4.83503 21 7.78313V16.2178C21 19.1659 18.9188 21 15.9736 21H8.02638C5.08119 21 3 19.1562 3 16.2178Z" stroke="currentColor"></path>
<path d="M9.8261 16.5722L8.82005 16.5741C8.04848 16.5761 7.42286 15.9495 7.42383 15.1779L7.42578 14.1719" stroke="currentColor"></path>
<path d="M16.5722 14.1719L16.5741 15.1779C16.5761 15.9495 15.9505 16.5761 15.1789 16.5741L14.1719 16.5722" stroke="currentColor"></path>
<path d="M7.42773 9.82805L7.42579 8.822C7.42384 8.05043 8.04946 7.42481 8.82103 7.42578L9.82806 7.4287" stroke="currentColor"></path>
<path d="M14.1738 7.42773L15.1799 7.42579C15.9514 7.42384 16.5771 8.04946 16.5761 8.82103L16.5742 9.82708" stroke="currentColor"></path>
    </svg>
  ),
)

ScreenSize.displayName = 'ScreenSize'

export default ScreenSize
