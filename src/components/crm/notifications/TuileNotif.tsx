/**
 * TuileNotif — la tuile de 40 px d'une notification, au bureau comme sur mobile, et de
 * chaque ligne du journal d'audit, qui est l'historique complet de la cloche.
 *
 * Trois visages, du plus parlant au plus générique :
 *  1. la PHOTO de ce que l'événement désigne (un match qui arrive, une diffusion) —
 *     retour de Julien, 14.09.2026 : « pour les annonces qu'on publie, ou s'il y a un
 *     match qui arrive, synchroniser l'image » ; le type reste lisible par sa pastille ;
 *  2. le LOGO WHATSAPP, blanc sur le vert de la marque, pour une notification WhatsApp
 *     (même jour : « quand c'est une notification WhatsApp, mets alors le logo ») — le
 *     canal se reconnaît à son logo mieux qu'à un glyphe de bulle ; avec une photo, c'est
 *     la pastille du coin qui prend le logo ;
 *  3. sinon le glyphe du type sur sa teinte.
 *
 * ⚠ `referrerPolicy="no-referrer"` : les photos de marché viennent des portails, et
 * Flatfox refuse le hotlink quand un référent est envoyé (même règle que `MrhPhoto`).
 * ⚠ Les couleurs sont données par l'appelant : le bureau et le mobile n'ont pas les
 * mêmes jetons. Le vert WhatsApp, lui, est une couleur de MARQUE : il ne suit pas le thème.
 */
import { useState, type ReactNode } from 'react'
import MEIcon from '@/components/propertyx/MEIcon'
import PxSocialIcon from '@/components/propertyx/PxSocialIcon'
import { WHATSAPP_VERT } from '@/components/propertyx/whatsapp'
import { KIND_META, type CrmNotif } from './data'

interface Props {
  /** Ce que la tuile lit d'une notification — le journal d'audit n'en construit pas d'autre. */
  n: Pick<CrmNotif, 'kind' | 'image' | 'canal'>
  /** Fond de la tuile SANS photo (la teinte du type). */
  fondTuile: string
  /** Encre du glyphe sans photo. */
  encreGlyphe: string
  /** La surface derrière la tuile : l'anneau qui détache la pastille du type de la photo. */
  anneau: string
  /** Encre posée sur une teinte PLEINE (pastille du type, logo WhatsApp) — le blanc. */
  encrePastille: string
  /** Ce que la surface pose en plus sur la tuile (la pastille « non lu » du mobile). */
  children?: ReactNode
}

/** La photo de ce que la notification désigne, le logo de son canal, ou le glyphe de son type. */
export default function TuileNotif({ n, fondTuile, encreGlyphe, anneau, encrePastille, children }: Props) {
  const meta = KIND_META[n.kind] ?? KIND_META.system
  // L'URL qui a échoué, pas un booléen : une autre photo, plus tard, retente.
  const [cassee, setCassee] = useState<string | null>(null)
  const photo = n.image && cassee !== n.image ? n.image : null
  const whatsapp = n.canal === 'whatsapp'

  return (
    <span aria-hidden data-canal={n.canal ?? undefined} style={{
      position: 'relative', width: 40, height: 40, flexShrink: 0,
      display: 'grid', placeItems: 'center', borderRadius: 'var(--crm-radius-lg)',
      background: photo ? 'transparent' : whatsapp ? WHATSAPP_VERT : fondTuile,
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
            background: whatsapp ? WHATSAPP_VERT : meta.dot, boxShadow: `0 0 0 2px ${anneau}`, color: encrePastille,
          }}>
            {whatsapp
              ? <PxSocialIcon name="whatsapp" size={12} />
              : <MEIcon name={meta.icon} size={11} color={encrePastille} strokeWidth={2} />}
          </span>
        </>
      ) : whatsapp ? (
        // `PxSocialIcon` en `mono` peint en `currentColor` : le blanc vient d'ici.
        <span style={{ display: 'grid', color: encrePastille }}><PxSocialIcon name="whatsapp" size={22} /></span>
      ) : (
        <MEIcon name={meta.icon} size={20} color={encreGlyphe} strokeWidth={1.7} />
      )}
      {children}
    </span>
  )
}
