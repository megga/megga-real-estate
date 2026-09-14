/**
 * La pastille de fournisseur de l'assistant « Ajouter une boîte » (README §6) et du « De »
 * du composeur.
 *
 * Google et Microsoft sont les SVG de `settings/brandLogos`, WhatsApp le logo fourni par
 * Julien (`LogoWhatsApp`) ; toute autre boîte est une boîte IMAP, marquée d'une arobase.
 *
 * ⛔ PAS le `WhatsAppLogo` de `brandLogos` : c'est un combiné BLANC sans fond, que les
 * Réglages posent sur leur propre carré vert. Posé ici sur une pastille transparente, il
 * rendait la première tuile de l'assistant SANS logo (constaté au banc le 14.09.2026).
 *
 * ⚠ Les PNG Infomaniak et Swisscom attendus en `public/mail/` ne sont plus lus : leurs
 * tuiles ont été retirées le 14.09.2026 (« juste mettre IMAP »), le fournisseur étant
 * désormais reconnu à l'adresse.
 */
import { GoogleG, MsLogo } from '@/components/crm/settings/brandLogos'
import LogoWhatsApp from '@/components/propertyx/LogoWhatsApp'
import type { MailSurfaces } from './mailTokens'

export type MailProviderKey = 'wa' | 'gmail' | 'outlook' | 'imap'

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

  // WhatsApp porte son propre vert : l'encadrer le doublerait. La pastille découpe son
  // carré en rond.
  if (provider === 'wa') return <div style={pastille}><LogoWhatsApp taille={size} /></div>
  if (provider === 'gmail') return <div style={encadree}><GoogleG size={interieur} /></div>
  if (provider === 'outlook') return <div style={encadree}><MsLogo size={interieur} /></div>
  return <div style={{ ...encadree, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{'@'}</div>
}
