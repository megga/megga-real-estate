// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Code7 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path d="M9.23686 7.71875C9.23686 7.71875 7.2627 8.90286 7.2627 12.0611C7.2627 15.2184 9.23686 16.4035 9.23686 16.4035" stroke="currentColor"></path>
<path d="M14.7637 7.71875C14.7637 7.71875 16.7378 8.90286 16.7378 12.0611C16.7378 15.2184 14.7637 16.4035 14.7637 16.4035" stroke="currentColor"></path>
    </svg>
  ),
)

Code7.displayName = 'Code7'

export default Code7
