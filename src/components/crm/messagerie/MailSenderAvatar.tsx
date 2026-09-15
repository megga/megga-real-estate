/**
 * La pastille d'un expéditeur : son logo quand on en a un (`useMailSenderLogos`), ses
 * initiales sinon. Même pastille dans la liste (petite) et en tête du lecteur (38 px).
 *
 * ⚠ LE LOGO GARDE UN FOND CLAIR, MÊME EN SOMBRE, et ce n'est pas une surface oubliée : un
 * logo est une IMAGE dessinée pour le blanc — un favicon noir détouré disparaîtrait sur
 * notre canvas quasi-noir. C'est ce que font les clients de messagerie qui montrent des
 * logos. Les initiales, elles, suivent le thème.
 *
 * ⚠ Une icône d'application (`plein`) est un carré plein, fond compris : elle remplit la
 * pastille. Un logo détouré y respire, à un peu plus des deux tiers du diamètre.
 */
import { useState } from 'react'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import type { MailSenderLogo } from '@/hooks/useMailSenderLogos'
import { initialsOf } from '@/lib/mail/format'
import type { MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  nom: string | null
  adresse: string | null
  logo?: MailSenderLogo
  /** Diamètre, en px. */
  taille: number
}

/** La pastille d'un expéditeur — décorative : son nom est toujours écrit à côté. */
export function MailSenderAvatar({ ms, nom, adresse, logo, taille }: Props) {
  // L'image qui a échoué, et non un booléen : un autre logo, arrivé ensuite, a sa chance.
  const [echec, setEchec] = useState<string | null>(null)
  const rond = {
    width: taille, height: taille, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
    display: 'grid', placeItems: 'center', boxSizing: 'border-box',
  } as const

  if (logo && echec !== logo.src) {
    const interieur = logo.plein ? taille : Math.round(taille * 0.7)
    return (
      <span aria-hidden data-logo-expediteur="" style={{ ...rond, background: MXC_COLOR.n1000, boxShadow: `inset 0 0 0 1px ${ms.bord}` }}>
        <img
          src={logo.src}
          alt=""
          width={interieur}
          height={interieur}
          style={{ display: 'block', objectFit: logo.plein ? 'cover' : 'contain' }}
          onError={() => setEchec(logo.src)}
          onLoad={(e) => { if (e.currentTarget.naturalWidth === 0) setEchec(logo.src) }}
        />
      </span>
    )
  }

  // La pastille du lecteur (38 px) porte des initiales plus grandes que celle d'une ligne.
  const texte = taille >= 32 ? 'var(--crm-text-sm)' : 'var(--crm-text-xs)'
  return (
    <span
      aria-hidden
      style={{ ...rond, background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, fontWeight: 600, fontSize: texte }}
    >
      {initialsOf(nom, adresse ?? '')}
    </span>
  )
}
