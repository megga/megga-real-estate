/**
 * La pastille de fournisseur de l'assistant « Ajouter une boîte » (README §6) et du « De »
 * du composeur.
 *
 * Google et Microsoft sont les SVG de `settings/brandLogos` ; toute autre boîte est une
 * boîte IMAP, marquée d'une arobase. WhatsApp n'y figure plus : sa ligne a quitté
 * l'assistant le 14.09.2026, il s'appaire dans Réglages › Intégrations.
 *
 * ⚠ Les PNG Infomaniak et Swisscom attendus en `public/mail/` ne sont plus lus : leurs
 * tuiles ont été retirées le 14.09.2026 (« juste mettre IMAP »), le fournisseur étant
 * désormais reconnu à l'adresse.
 */
import { GoogleG, MsLogo } from '@/components/crm/settings/brandLogos'
import type { MailSurfaces } from './mailTokens'

export type MailProviderKey = 'gmail' | 'outlook' | 'imap'

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

  if (provider === 'gmail') return <div style={encadree}><GoogleG size={interieur} /></div>
  if (provider === 'outlook') return <div style={encadree}><MsLogo size={interieur} /></div>
  return <div style={{ ...encadree, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{'@'}</div>
}
