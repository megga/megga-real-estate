// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store6 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M17.3042 11.1073C18.3122 11.4031 19.4447 11.226 20.2075 10.5041C20.7563 9.98451 21.089 9.27424 20.9791 8.51143C20.8623 7.70387 20.4809 6.43317 20.1472 5.41642C19.8319 4.45513 18.9349 3.80713 17.9239 3.80713H6.08875C5.08173 3.80713 4.18854 4.44929 3.86941 5.40474C3.52887 6.42344 3.13774 7.69998 3.02098 8.51143C2.91103 9.27424 3.24282 9.98451 3.79157 10.5041C4.55438 11.226 5.68789 11.4031 6.69588 11.1073L6.96929 11.0266C7.41199 10.8972 7.88582 10.9322 8.3042 11.1258L10.4895 12.1387C11.4469 12.5823 12.5522 12.5823 13.5106 12.1387L15.6949 11.1258C16.1132 10.9322 16.5881 10.8972 17.0308 11.0266L17.3042 11.1073Z" stroke="currentColor"></path>
<path d="M4.53809 14.167V16.0263C4.53809 18.4685 6.05884 20.1936 8.50293 20.1936H15.4947C17.9398 20.1936 19.4605 18.4685 19.4605 16.0263V14.167" stroke="currentColor"></path>
    </svg>
  ),
)

Store6.displayName = 'Store6'

export default Store6
