// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PictureInPicture = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.3764 11.2188H12.0722C10.9212 11.2188 10.1992 12.0341 10.1992 13.1871V15.3276C10.1992 16.4816 10.9173 17.2969 12.0722 17.2969H15.3764C16.5313 17.2969 17.2504 16.4816 17.2504 15.3276V13.1871C17.2504 12.0341 16.5313 11.2188 15.3764 11.2188Z" stroke="currentColor"></path>
    </svg>
  ),
)

PictureInPicture.displayName = 'PictureInPicture'

export default PictureInPicture
