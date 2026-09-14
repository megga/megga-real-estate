/**
 * La notification de la Messagerie : la confirmation qui suit un geste, EN BAS du cadre,
 * centrée — une capsule, une coche, un texte court (Julien, 14.09.2026 : « améliorer le
 * design, la mettre en bas », puis « fais court : juste “Boîte déconnectée” »).
 *
 * Elle vit DANS le cadre, comme le voile des modales : elle en suit la largeur, se masque
 * avec l'écran quand l'onglet passe derrière, et passe SOUS le voile d'une modale ouverte
 * après elle. ⚠ Le toast partagé du CRM (`useToast`) s'empile en haut à droite de la
 * FENÊTRE : il reste celui des autres surfaces.
 *
 * La région `role="status"` est posée en permanence, vide au repos : une région vivante
 * qui naît avec son texte n'est pas annoncée par tous les lecteurs d'écran.
 *
 * Elle s'efface seule ; le compte à rebours s'arrête tant que la souris est dessus.
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import MEIcon from '@/components/propertyx/MEIcon'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { PILL, type MailSurfaces } from './mailTokens'

/** Une notification ; un `id` neuf relance le compte à rebours. */
export interface MailNotificationData { id: number; texte: string }

interface Props {
  ms: MailSurfaces
  notification: MailNotificationData | null
  /** Appelé à la fin du compte à rebours. */
  onFin: () => void
}

const DUREE = 4000
/** Le ressort du toast partagé, un peu plus amorti : la capsule monte, elle ne rebondit pas. */
const RESSORT = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 }
const PASTILLE = 26

/** La notification en bas du cadre. Rend une région vide quand il n'y a rien à dire. */
export function MailNotification({ ms, notification, onFin }: Props) {
  const reduit = useReducedMotion()
  // La notification SURVOLÉE, et non un booléen : une notification suivante, arrivée
  // sous une souris qui n'a jamais « quitté » la précédente, doit repartir.
  const [survolee, setSurvolee] = useState<number | null>(null)
  // ⚠ Lu par une ref : le parent passe une flèche en ligne, dont l'identité change à
  // chaque rendu — en dépendance, elle relançait le compte à rebours à chaque rendu de
  // l'écran (une synchro, une frappe), et la notification ne partait plus.
  const fin = useRef(onFin)
  useEffect(() => { fin.current = onFin })
  const id = notification?.id ?? null
  useEffect(() => {
    if (id === null || survolee === id) return
    const minuteur = setTimeout(() => fin.current(), DUREE)
    return () => clearTimeout(minuteur)
  }, [id, survolee])

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 'var(--crm-space-6xl)', zIndex: 200,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}
    >
      <AnimatePresence initial={false}>
        {notification && (
          <motion.div
            key={notification.id}
            data-mail-notification=""
            initial={reduit ? { opacity: 0 } : { y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduit ? { opacity: 0 } : { y: 10, opacity: 0, scale: 0.98 }}
            transition={reduit ? { duration: 0 } : RESSORT}
            onMouseEnter={() => setSurvolee(notification.id)}
            onMouseLeave={() => setSurvolee(null)}
            style={{
              pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
              // Une capsule : la pastille est concentrique au bout arrondi de gauche.
              padding: 'var(--crm-space-sm) var(--crm-space-4xl) var(--crm-space-sm) var(--crm-space-sm)',
              borderRadius: PILL, background: ms.solid, border: `1px solid ${ms.solidBorder}`, boxShadow: ms.solidShadow,
              color: ms.ink, fontFamily: 'var(--crm-font)', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden style={{ width: PASTILLE, height: PASTILLE, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: ms.success, color: ms.successInk }}>
              <MEIcon name="check" size={14} />
            </span>
            {notification.texte}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
