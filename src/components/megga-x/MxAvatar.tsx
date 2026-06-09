// MEGGA X — Avatar. Transcription fidèle : <img class="avatar-image _40px">.
// Tailles présentes dans la source : 24 / 32 / 40 / 64 / 100 px.
import { cn } from '@/lib/utils'

type MxAvatarSize = 24 | 32 | 40 | 64 | 100

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: MxAvatarSize
}

export default function MxAvatar({ size = 40, className, alt = '', ...rest }: Props) {
  return <img className={cn('avatar-image', `_${size}px`, className)} alt={alt} {...rest} />
}
