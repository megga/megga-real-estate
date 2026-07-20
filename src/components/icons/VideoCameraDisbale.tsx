// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const VideoCameraDisbale = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.7412 10.0382L19.9898 7.37983C20.5152 6.94956 21.2914 7.02632 21.7217 7.55172C21.9022 7.77226 22.0017 8.04901 22.0006 8.33333L21.9887 15.5819C21.9876 16.2619 21.4352 16.8122 20.7552 16.8111C20.4709 16.81 20.1963 16.7116 19.9768 16.5311L17.3639 14.3895C16.9747 14.0706 16.7487 13.5938 16.7487 13.0911V8.90414C16.7487 6.77443 15.0223 5.04688 12.8915 5.04688H8.66016" stroke="currentColor"></path>
<path d="M4.15043 5.90234C3.36124 6.58342 2.92773 7.63855 2.92773 8.90124V15.0071C2.92773 17.2666 4.33745 18.8644 6.59689 18.8644H13.0779C14.0941 18.8644 14.9417 18.539 15.5633 17.9757" stroke="currentColor"></path>
<path d="M17.8226 20.3682L2 3.62891" stroke="currentColor"></path>
    </svg>
  ),
)

VideoCameraDisbale.displayName = 'VideoCameraDisbale'

export default VideoCameraDisbale
