// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GitPull = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M7.2917 3.99864C5.92604 3.99864 4.81836 5.10632 4.81836 6.47198C4.81836 7.83763 5.92604 8.94531 7.2917 8.94531C8.65735 8.94531 9.76503 7.83763 9.76503 6.47198C9.76503 5.10632 8.65735 3.99864 7.2917 3.99864Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M7.2917 15.0533C5.92604 15.0533 4.81836 16.161 4.81836 17.5267C4.81836 18.8923 5.92604 20 7.2917 20C8.65735 20 9.76503 18.8923 9.76503 17.5267C9.76503 16.161 8.65735 15.0533 7.2917 15.0533Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.7097 15.0533C15.344 15.0533 14.2363 16.161 14.2363 17.5267C14.2363 18.8923 15.344 20 16.7097 20C18.0753 20 19.183 18.8923 19.183 17.5267C19.183 16.161 18.0753 15.0533 16.7097 15.0533Z" stroke="currentColor"></path>
<path d="M7.29102 15.0547V8.94804" stroke="currentColor"></path>
<path d="M16.7276 15.0547V13.8849C16.7276 12.7772 15.8294 11.8789 14.7209 11.8789H7.28809" stroke="currentColor"></path>
    </svg>
  ),
)

GitPull.displayName = 'GitPull'

export default GitPull
