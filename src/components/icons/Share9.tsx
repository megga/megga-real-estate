// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Share9 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M8.41438 4.54297H7.37569C4.68641 4.54297 3 6.4456 3 9.13817V16.4049C3 19.0975 4.67817 21.0001 7.37569 21.0001H15.0931C17.7915 21.0001 19.4706 19.0975 19.4706 16.4049V13.8131" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.041 8.30627C13.6639 8.30627 11.8235 9.12869 10.8057 11.3763C10.8057 11.3763 9.92578 5.20755 16.041 5.20755C16.041 5.20755 16.0415 4.29838 16.0421 3.51595C16.0427 3.07714 16.557 2.83943 16.8921 3.12333L20.8161 6.44738C21.0538 6.64904 21.0623 7.01237 20.8302 7.22192C19.9683 8.00153 18.03 9.75339 16.9011 10.7735C16.5694 11.0732 16.041 10.8361 16.041 10.3888L16.041 8.30627Z" stroke="currentColor"></path>
    </svg>
  ),
)

Share9.displayName = 'Share9'

export default Share9
