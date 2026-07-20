// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LoadingPlay2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.32473 9.54688C3.06203 10.5101 2.94819 11.5288 3.02603 12.5806" stroke="currentColor"></path>
<path d="M4.77734 6.63001C5.19767 6.05693 5.68512 5.53737 6.22902 5.07812" stroke="currentColor"></path>
<path d="M6.84981 19.3601C5.49349 18.4231 4.40863 17.1164 3.73047 15.5781" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.6119 13.1414C13.8101 13.873 12.8099 14.5327 11.7076 14.9803C10.7706 15.3529 9.98442 14.8879 9.86961 13.9557C9.72951 12.5809 9.73243 11.2645 9.86961 10.0366C9.99513 9.06755 10.8601 8.65598 11.7076 9.01501C12.7924 9.46355 13.7654 10.0726 14.6119 10.8549C15.3348 11.5155 15.3523 12.4545 14.6119 13.1414Z" stroke="currentColor"></path>
<path d="M17.5601 19.0859C16.2038 20.1484 14.5293 20.8363 12.6816 20.9745C11.7719 21.0426 10.8836 20.9706 10.0371 20.7799" stroke="currentColor"></path>
<path d="M19.6443 16.7238C20.554 15.2555 21.0609 13.5188 20.9899 11.6633C20.7982 6.69048 16.6135 2.81514 11.6406 3.00681" stroke="currentColor"></path>
    </svg>
  ),
)

LoadingPlay2.displayName = 'LoadingPlay2'

export default LoadingPlay2
