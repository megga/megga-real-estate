// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PoliceBadge2 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.4363 9.17978L13.1607 10.6273C13.2324 10.77 13.3699 10.8682 13.528 10.8904L15.1487 11.1238C15.4114 11.1583 15.596 11.3996 15.5616 11.6623C15.5473 11.7697 15.497 11.8696 15.4189 11.9449L14.2468 13.071C14.1315 13.1808 14.0788 13.3405 14.1065 13.4974L14.3839 15.0872C14.4267 15.3526 14.246 15.6023 13.9805 15.6451C13.8759 15.6617 13.7689 15.6439 13.6754 15.5944L12.2275 14.8439C12.0848 14.7702 11.9156 14.7702 11.773 14.8439L10.3243 15.5947C10.0869 15.7207 9.7925 15.6304 9.66649 15.3931C9.61696 15.2992 9.59912 15.1922 9.61616 15.0876L9.89354 13.4974C9.92088 13.3409 9.86818 13.1812 9.75327 13.0714L8.57995 11.9453C8.38936 11.7614 8.38341 11.4579 8.56728 11.2669C8.64256 11.1888 8.74242 11.1385 8.8502 11.1242L10.4709 10.8908C10.629 10.8686 10.7665 10.7703 10.8386 10.6277L11.5641 9.17978C11.689 8.93886 11.9854 8.84495 12.2263 8.96977C12.3162 9.01613 12.3895 9.08944 12.4363 9.17978Z" stroke="currentColor"></path>
<path d="M18.909 11.9747C17.1826 8.08189 18.3627 6.98042 19.4856 6.3965L18.3009 4.48716C16.9386 5.11915 13.5578 5.18162 12.0002 3.0332C10.4426 5.18162 7.06174 5.11915 5.69942 4.48716L4.51479 6.3965C5.6377 6.98042 6.81779 8.08189 5.09137 11.9747C1.95393 19.049 12.0002 21.5332 12.0002 21.5332C12.0002 21.5332 22.0464 19.049 18.909 11.9747Z" stroke="currentColor"></path>
    </svg>
  ),
)

PoliceBadge2.displayName = 'PoliceBadge2'

export default PoliceBadge2
