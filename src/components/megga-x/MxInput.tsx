// MEGGA X — Input. Transcription fidèle de la classe la vitrine MEGGA `.input`
// (états :hover / :focus dans la feuille). Aucun style nouveau.

import { cn } from '@/lib/utils'

type Props = React.InputHTMLAttributes<HTMLInputElement>

export default function MxInput({ className, ...rest }: Props) {
  return <input className={cn('input', className)} {...rest} />
}
