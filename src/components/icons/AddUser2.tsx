// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AddUser2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M19.2929 8.66882V12.6788M21.338 10.6737H17.248" stroke="currentColor"></path>
<path d="M10.2049 14.8188C13.4613 14.8104 16.2301 16.3056 17.2478 19.5241C15.1964 20.7746 12.7818 21.2563 10.2049 21.25C7.62803 21.2563 5.21338 20.7746 3.16202 19.5241C4.18092 16.3021 6.94505 14.8104 10.2049 14.8188Z" stroke="currentColor"></path>
<path d="M14.5894 7.16961C14.5894 9.61056 12.6106 11.5893 10.1696 11.5893C7.72869 11.5893 5.74991 9.61056 5.74991 7.16961C5.74991 4.72866 7.72869 2.74988 10.1696 2.74988C12.6106 2.74988 14.5894 4.72866 14.5894 7.16961Z" stroke="currentColor"></path>
    </svg>
  ),
)

AddUser2.displayName = 'AddUser2'

export default AddUser2
