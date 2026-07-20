// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chat22 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M18.7981 18.6612C16.943 20.5165 14.5012 21.4148 12.0747 21.3624C8.7795 21.2911 3 21.3429 3 21.3429C3 21.3429 3.05068 15.4956 3.04819 12.1431C3.04644 9.78062 3.94595 7.4186 5.75162 5.61333C9.35096 2.01267 15.1987 2.01267 18.7981 5.61241C22.4039 9.21863 22.3974 15.0615 18.7981 18.6612Z" stroke="currentColor" strokeLinecap="round"></path>
<path d="M8.56455 12.5195H8.46581" stroke="currentColor" strokeLinecap="square"></path>
<path d="M12.2989 12.5196H12.2002" stroke="currentColor" strokeLinecap="square"></path>
<path d="M16.0333 12.5195H15.9346" stroke="currentColor" strokeLinecap="square"></path>
    </svg>
  ),
)

Chat22.displayName = 'Chat22'

export default Chat22
