/**
 * La pastille de fournisseur de l'assistant « Ajouter une boîte » (README §6).
 *
 * Google, Microsoft et WhatsApp sont des SVG du dépôt (`settings/brandLogos`).
 * Infomaniak et Swisscom sont des PNG que Julien dépose dans `public/mail/`
 * (plan maître §6.4) et qui N'Y SONT PAS ENCORE.
 *
 * ⛔ Un `<img>` vers un fichier absent ne « casse » pas ici : le repli SPA de
 * Cloudflare Pages rend `index.html` avec un **200**, donc `onError` ne part
 * jamais et l'écran affiche un cadre vide sans rien dire. Le seul signal fiable
 * est `naturalWidth === 0` au chargement — c'est lui qu'on lit, et c'est
 * pourquoi le monogramme est un repli et non une absence.
 */
import { useState } from 'react'
import { GoogleG, MsLogo, WhatsAppLogo } from '@/components/crm/settings/brandLogos'
import type { MailSurfaces } from './mailTokens'

export type MailProviderKey = 'wa' | 'gmail' | 'outlook' | 'infomaniak' | 'bluewin' | 'imap'

/** Les deux fournisseurs dont le logo est un fichier, avec leur monogramme de repli. */
const PNG: Partial<Record<MailProviderKey, { src: string; mono: string }>> = {
  infomaniak: { src: '/mail/infomaniak.png', mono: 'ik' },
  bluewin: { src: '/mail/swisscom.png', mono: 'bw' },
}

/** Diamètre par défaut (README §6 : 36 px en ligne, 40 px en tête d'étape). */
const TAILLE = 36
/** L'anneau vaut 7 px de chaque côté : le logo respire sans toucher la bordure. */
const RESPIRATION = 14

interface Props {
  ms: MailSurfaces
  provider: MailProviderKey
  size?: number
}

/** Le logo d'un fournisseur, dans sa pastille ronde. */
export function MailProviderLogo({ ms, provider, size = TAILLE }: Props) {
  const [casse, setCasse] = useState(false)
  const interieur = size - RESPIRATION
  const pastille = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  } as const
  const encadree = { ...pastille, background: ms.elev, border: `1px solid ${ms.bord}` }

  // WhatsApp porte son propre fond vert : l'encadrer le doublerait.
  if (provider === 'wa') return <div style={{ ...pastille, background: 'transparent' }}><WhatsAppLogo size={size} /></div>
  if (provider === 'gmail') return <div style={encadree}><GoogleG size={interieur} /></div>
  if (provider === 'outlook') return <div style={encadree}><MsLogo size={interieur} /></div>
  if (provider === 'imap') return <div style={{ ...encadree, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{'@'}</div>

  const png = PNG[provider]
  if (!png) return <div style={encadree} />
  return (
    <div style={{ ...encadree, fontSize: 'var(--crm-text-xs)', fontWeight: 600 }}>
      {casse ? png.mono : (
        <img
          src={png.src}
          alt=""
          width={interieur}
          height={interieur}
          style={{ objectFit: 'contain' }}
          onLoad={(e) => { if (e.currentTarget.naturalWidth === 0) setCasse(true) }}
          onError={() => setCasse(true)}
        />
      )}
    </div>
  )
}
