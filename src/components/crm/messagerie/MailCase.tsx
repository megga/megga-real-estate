/**
 * La case de la sélection (15.09.2026) : RONDE, parce qu'elle prend la place de la pastille
 * d'expéditeur au survol — même diamètre, même cercle, la ligne ne bouge pas d'un pixel.
 * Trois états : vide, cochée, et partielle — celle de la case « tout » quand la page n'est
 * cochée qu'à moitié.
 */
import MEIcon from '@/components/propertyx/MEIcon'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

export type EtatCase = 'vide' | 'cochee' | 'partielle'

/** Le dessin seul, `aria-hidden` : le rôle `checkbox` est porté par le bouton qui l'enrobe. */
export function MailCase({ ms, etat, taille }: { ms: MailSurfaces; etat: EtatCase; taille: number }) {
  const pleine = etat !== 'vide'
  return (
    <span
      aria-hidden
      style={{
        width: taille, height: taille, borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0,
        display: 'grid', placeItems: 'center', transition: MAIL_TRANSITION,
        border: `1.5px solid ${pleine ? ms.accent : ms.txt3}`, background: pleine ? ms.accent : 'transparent', color: ms.accentInk,
      }}
    >
      {etat === 'cochee' && <MEIcon name="check" size={Math.round(taille * 0.58)} strokeWidth={2.4} />}
      {etat === 'partielle' && <span style={{ width: Math.round(taille * 0.42), height: 2, borderRadius: PILL, background: ms.accentInk }} />}
    </span>
  )
}
