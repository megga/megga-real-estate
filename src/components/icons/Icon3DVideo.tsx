// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Icon3DVideo = forwardRef<SVGSVGElement, Props>(
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
<path d="M7.82305 13.9905C8.09451 14.2629 8.47008 14.4313 8.88457 14.4313C9.71354 14.4313 10.3849 13.7589 10.3849 12.9309C10.3849 12.102 9.71354 11.4306 8.88457 11.4306L10.3898 9.56641H7.77148" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.7968 14.4313H12.9863V9.56641H13.7968C15.1405 9.56641 16.2292 10.6561 16.2292 11.9988C16.2292 13.3425 15.1405 14.4313 13.7968 14.4313Z" stroke="currentColor"></path>
    </svg>
  ),
)

Icon3DVideo.displayName = 'Icon3DVideo'

export default Icon3DVideo
