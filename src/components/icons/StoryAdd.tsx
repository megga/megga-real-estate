// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const StoryAdd = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.77539 6.63392C5.19571 6.06084 5.68317 5.54127 6.22706 5.08203" stroke="currentColor"></path>
<path d="M3.32473 9.54688C3.06203 10.5101 2.94819 11.5288 3.02603 12.5806" stroke="currentColor"></path>
<path d="M6.84981 19.3601C5.49349 18.4231 4.40863 17.1164 3.73047 15.5781" stroke="currentColor"></path>
<path d="M17.5601 19.0859C16.2038 20.1484 14.5293 20.8363 12.6816 20.9745C11.7719 21.0426 10.8836 20.9706 10.0371 20.7799" stroke="currentColor"></path>
<path d="M11.9986 9.13672V14.8646M14.8626 12.0005H9.13477" stroke="currentColor"></path>
<path d="M19.6443 16.7238C20.554 15.2555 21.0609 13.5188 20.9899 11.6633C20.7982 6.69048 16.6135 2.81514 11.6406 3.00681" stroke="currentColor"></path>
    </svg>
  ),
)

StoryAdd.displayName = 'StoryAdd'

export default StoryAdd
