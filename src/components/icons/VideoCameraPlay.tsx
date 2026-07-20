// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoCameraPlay = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.84974 4.75391H12.64C15.013 4.75391 16.4908 6.42959 16.4908 8.8004V15.1983C16.4908 17.5691 15.013 19.2448 12.6389 19.2448H5.84974C3.47568 19.2448 2 17.5691 2 15.1983V8.8004C2 6.42959 3.48325 4.75391 5.84974 4.75391Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.4338 13.058C10.6922 13.7358 9.76465 14.3455 8.7441 14.7618C7.87599 15.1066 7.14842 14.6764 7.0414 13.8126C6.91167 12.5391 6.91491 11.3196 7.0414 10.1823C7.15815 9.28391 7.95924 8.90337 8.7441 9.23634C9.74843 9.65256 10.6501 10.2158 11.4338 10.9401C12.103 11.552 12.1192 12.4223 11.4338 13.058Z" stroke="currentColor"></path>
<path d="M16.4844 9.9906L19.8909 7.20248C20.4422 6.75059 21.2563 6.83167 21.7082 7.38302C21.8974 7.61437 22.0011 7.9041 22.0001 8.20248L21.9882 15.8036C21.986 16.5171 21.4076 17.0944 20.6941 17.0922C20.3968 17.0922 20.1082 16.9884 19.8779 16.7993L16.4844 14.0122" stroke="currentColor"></path>
    </svg>
  ),
)

VideoCameraPlay.displayName = 'VideoCameraPlay'

export default VideoCameraPlay
