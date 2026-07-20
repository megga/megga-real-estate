// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const HandiCamera = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.5763 7.10938H6.46486C4.33496 7.10938 3 8.61753 3 10.7513V15.8644C3 17.9982 4.32815 19.5064 6.46486 19.5064H12.5753C14.712 19.5064 16.0421 17.9982 16.0421 15.8644V10.7513C16.0421 8.61753 14.712 7.10938 12.5763 7.10938Z" stroke="currentColor"></path>
<path d="M6.99023 4.49219H9.89951C10.7908 4.49219 11.6003 5.00982 11.9749 5.81839L12.5714 7.10761" stroke="currentColor"></path>
<path d="M16.0352 11.1748L19.1011 8.66544C19.5973 8.25873 20.33 8.3317 20.7367 8.82793C20.907 9.03616 21.0004 9.29692 20.9994 9.56547L20.9887 16.4066C20.9868 17.0488 20.4662 17.5684 19.824 17.5665C19.5564 17.5665 19.2967 17.473 19.0894 17.3028L16.0352 14.7944" stroke="currentColor"></path>
<path d="M11.8674 11.2661V11.218M11.8674 10.9648C11.7292 10.9648 11.6172 11.0768 11.6172 11.2146C11.6172 11.3528 11.7292 11.4648 11.8674 11.4648C12.0057 11.4648 12.1177 11.3528 12.1177 11.2146C12.1177 11.0768 12.0057 10.9648 11.8674 10.9648Z" stroke="currentColor"></path>
    </svg>
  ),
)

HandiCamera.displayName = 'HandiCamera'

export default HandiCamera
