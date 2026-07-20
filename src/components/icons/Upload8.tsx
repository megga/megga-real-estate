// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Upload8 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.62059 9.42261H6.73811C4.81455 9.42261 3.25391 10.9833 3.25391 12.9068V17.5167C3.25488 19.4403 4.81455 21 6.73811 21H17.2617C19.1863 21 20.7459 19.4403 20.7459 17.5167V12.8981C20.7459 10.9794 19.1911 9.42358 17.2724 9.42261H16.3812" stroke="currentColor"></path>
<path d="M11.9996 3V14.3847M11.9996 3L9.24414 5.7681M11.9996 3L14.758 5.7681" stroke="currentColor"></path>
    </svg>
  ),
)

Upload8.displayName = 'Upload8'

export default Upload8
