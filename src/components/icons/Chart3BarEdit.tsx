// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart3BarEdit = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.33398 10.8916V17.0661M11.5337 7.9375V17.0659M15.6651 14.1545V17.0656" stroke="currentColor"></path>
<path d="M11.7178 3.5H7.28313C4.34378 3.5 2.5 5.58119 2.5 8.52735V16.4736C2.5 19.4198 4.33503 21.5 7.28313 21.5H15.7169C18.6659 21.5 20.5 19.4198 20.5 16.4736V12.5274" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.0738 9.58563L14.8395 7.97181C14.7975 7.68272 14.8841 7.38972 15.0764 7.16983L18.8615 2.8417C19.2251 2.42597 19.8569 2.38369 20.2726 2.74727L21.1584 3.52196C21.5741 3.88554 21.6164 4.51729 21.2528 4.93302L17.4861 9.24005C17.2968 9.45657 17.0234 9.58106 16.7357 9.58174L15.0738 9.58563Z" stroke="currentColor"></path>
    </svg>
  ),
)

Chart3BarEdit.displayName = 'Chart3BarEdit'

export default Chart3BarEdit
