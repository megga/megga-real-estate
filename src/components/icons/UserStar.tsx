// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserStar = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M16.7008 14.787L17.3883 16.1708C17.4229 16.2408 17.4895 16.2893 17.5665 16.3005L19.1068 16.5228C19.1691 16.5314 19.2253 16.5643 19.2634 16.6136C19.3352 16.707 19.3239 16.8402 19.2383 16.9198L18.1217 17.9991C18.0655 18.0527 18.0404 18.1315 18.0551 18.2076L18.3224 19.7297C18.3405 19.856 18.2549 19.9745 18.1287 19.9944C18.0759 20.003 18.0231 19.9944 17.9756 19.971L16.6039 19.2523C16.5356 19.2151 16.4525 19.2151 16.3833 19.2523L15.0021 19.9754C14.8862 20.0342 14.7453 19.9909 14.6821 19.8776C14.6588 19.8318 14.6501 19.7799 14.6579 19.7289L14.9252 18.2058C14.939 18.1297 14.9139 18.0519 14.8586 17.9983L13.7368 16.9189C13.6452 16.8281 13.6452 16.6802 13.736 16.5894L13.7368 16.5885C13.774 16.5548 13.8207 16.5323 13.8709 16.5228L15.4104 16.2997C15.4873 16.2875 15.5539 16.2391 15.5885 16.1699L16.2761 14.787C16.3038 14.7308 16.3531 14.6884 16.4119 14.6685C16.4716 14.6486 16.5373 14.6529 16.5935 14.6815C16.6393 14.704 16.6774 14.7412 16.7008 14.787Z" stroke="currentColor"></path>
<path d="M10.9407 14.8711C7.56688 14.8711 4.68945 15.3814 4.68945 17.4233C4.68945 19.4653 7.55045 19.9929 10.9407 19.9929" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.9344 7.99311C14.9344 10.1985 13.1467 11.9862 10.9412 11.9862C8.73582 11.9862 6.94727 10.1985 6.94727 7.99311C6.94727 5.78769 8.73582 4 10.9412 4C13.1467 4 14.9344 5.78769 14.9344 7.99311Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserStar.displayName = 'UserStar'

export default UserStar
