/**
 * TuileNotif — la tuile de 40 px d'une notification, au bureau comme sur mobile.
 *
 * Quand l'événement désigne un bien ou une annonce qui a une PHOTO (un match qui arrive,
 * une diffusion sur un portail), c'est elle qui occupe la tuile — retour de Julien,
 * 14.09.2026 : « pour les annonces qu'on publie, ou s'il y a un match qui arrive,
 * synchroniser l'image ». Le type reste lisible par sa pastille, dans le coin. Sans
 * photo, ou si elle ne charge pas, la tuile porte le glyphe du type sur sa teinte.
 *
 * ⚠ `referrerPolicy="no-referrer"` : les photos de marché viennent des portails, et
 * Flatfox refuse le hotlink quand un référent est envoyé (même règle que `MrhPhoto`).
 * ⚠ Les couleurs sont données par l'appelant : le bureau et le mobile n'ont pas les
 * mêmes jetons.
 */
import { useState, type ReactNode } from 'react'
import MEIcon from '@/components/propertyx/MEIcon'
import { KIND_META, type CrmNotif } from './data'

interface Props {
  n: CrmNotif
  /** Fond de la tuile SANS photo (la teinte du type). */
  fondTuile: string
  /** Encre du glyphe sans photo. */
  encreGlyphe: string
  /** La surface derrière la tuile : l'anneau qui détache la pastille du type de la photo. */
  anneau: string
  /** Encre du glyphe dans la pastille (sur la teinte pleine du type). */
  encrePastille: string
  /** Ce que la surface pose en plus sur la tuile (la pastille « non lu » du mobile). */
  children?: ReactNode
}

/** La photo de ce que la notification désigne, ou le glyphe de son type. */
export default function TuileNotif({ n, fondTuile, encreGlyphe, anneau, encrePastille, children }: Props) {
  const meta = KIND_META[n.kind] ?? KIND_META.system
  // L'URL qui a échoué, pas un booléen : une autre photo, plus tard, retente.
  const [cassee, setCassee] = useState<string | null>(null)
  const photo = n.image && cassee !== n.image ? n.image : null

  return (
    <span aria-hidden style={{
      position: 'relative', width: 40, height: 40, flexShrink: 0,
      display: 'grid', placeItems: 'center', borderRadius: 'var(--crm-radius-lg)',
      background: photo ? 'transparent' : fondTuile,
    }}>
      {photo ? (
        <>
          <img
            src={photo} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async"
            onError={() => setCassee(photo)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--crm-radius-lg)', display: 'block' }}
          />
          <span style={{
            position: 'absolute', right: -4, bottom: -4, width: 20, height: 20,
            display: 'grid', placeItems: 'center', borderRadius: 'var(--crm-radius-pill)',
            background: meta.dot, boxShadow: `0 0 0 2px ${anneau}`,
          }}>
            <MEIcon name={meta.icon} size={11} color={encrePastille} strokeWidth={2} />
          </span>
        </>
      ) : (
        <MEIcon name={meta.icon} size={20} color={encreGlyphe} strokeWidth={1.7} />
      )}
      {children}
    </span>
  )
}
