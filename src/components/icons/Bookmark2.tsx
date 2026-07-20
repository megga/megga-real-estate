// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Bookmark2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M19.7276 2.75C13.8873 2.75 10.6128 2.75 4.77246 2.75V21.25L12.2751 17.8045L19.7276 21.25V2.75Z" stroke="currentColor"></path>
<path d="M8.72852 9.22534H15.7719" stroke="currentColor"></path>
    </svg>
  ),
)

Bookmark2.displayName = 'Bookmark2'

export default Bookmark2
