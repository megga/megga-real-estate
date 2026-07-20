// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Film3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.48304 3.11719H16.5159C19.2799 3.11719 21 5.06814 21 7.82904V16.1674C21 18.9283 19.2799 20.8793 16.5149 20.8793H7.48304C4.71911 20.8793 3 18.9283 3 16.1674V7.82904C3 5.06814 4.72721 3.11719 7.48304 3.11719Z" stroke="currentColor"></path>
<path d="M16.4741 20.8802V17.0938M7.56836 20.8802V17.0938" stroke="currentColor"></path>
<path d="M3.11719 17.0898H20.8843" stroke="currentColor"></path>
<path d="M20.8824 6.91016H3.11523" stroke="currentColor"></path>
<path d="M16.4741 3.14453V6.90672M7.56836 3.14453V6.90672" stroke="currentColor"></path>
<path d="M12.0215 3.14453V20.8823" stroke="currentColor"></path>
    </svg>
  ),
)

Film3.displayName = 'Film3'

export default Film3
