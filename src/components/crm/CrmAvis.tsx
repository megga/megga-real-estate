/**
 * L'avis du CRM : une capsule EN BAS du contenu, centrée — une pastille, un texte court.
 * La même forme que la notification de la Messagerie (`MailNotification`), pour les
 * surfaces qui n'ont pas la leur (Julien, 16.09.2026 : « comme les autres notifications,
 * juste “Brouillon enregistré”, en bas »).
 *
 * ⚠ L'avis part souvent d'un écran qui DISPARAÎT (« Nouveau bien », au moment où on le
 * quitte) : `annoncerAvis` (`lib/crmAvis`) le range hors de React, et c'est la coquille
 * (`CrmWorkspace`) de l'écran d'ARRIVÉE qui l'affiche. Six écrans restant montés, seul
 * l'écran ACTIF le rend.
 *
 * Il s'efface seul ; le compte à rebours s'arrête tant que la souris est dessus.
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { MXC_SYSTEM, encreSur } from '@/components/megga-x-crm/tokens'
import { useEcranActif } from '@/hooks/useEcranActif'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { abonnerAvis, lireAvis, retirerAvis } from '@/lib/crmAvis'

const DUREE = 4000
const RESSORT = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 }
const PASTILLE = 26

/** L'hôte de l'avis — monté par `CrmWorkspace`, sous le contenu. */
export function CrmAvis({ sp }: { sp: CrmPalette }) {
  const avis = useSyncExternalStore(abonnerAvis, lireAvis)
  const actif = useEcranActif()
  const reduit = useReducedMotion()
  const [survole, setSurvole] = useState<number | null>(null)
  // L'avis se centre sur la COLONNE du contenu, pas sur la fenêtre : la barre latérale le décalerait.
  const ancre = useRef<HTMLDivElement>(null)
  const [cadre, setCadre] = useState<{ left: number; width: number } | null>(null)
  const id = avis?.id ?? null

  useLayoutEffect(() => {
    const colonne = ancre.current?.parentElement
    if (!colonne || id === null) return
    const mesurer = () => { const r = colonne.getBoundingClientRect(); setCadre({ left: r.left, width: r.width }) }
    mesurer()
    window.addEventListener('resize', mesurer)
    return () => window.removeEventListener('resize', mesurer)
  }, [id])

  useEffect(() => {
    if (id === null || !actif || survole === id) return
    const minuteur = setTimeout(() => retirerAvis(id), DUREE)
    return () => clearTimeout(minuteur)
  }, [id, actif, survole])

  return (
    <>
      <div ref={ancre} aria-hidden style={{ height: 0, flexShrink: 0 }} />
      {actif && cadre && createPortal(
        <div role="status" aria-live="polite" style={{
          position: 'fixed', left: cadre.left, width: cadre.width, bottom: 'calc(var(--crm-space-6xl) * 2)', zIndex: 100,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <AnimatePresence initial={false}>
            {avis && (
              <motion.div
                key={avis.id}
                initial={reduit ? { opacity: 0 } : { y: 20, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={reduit ? { opacity: 0 } : { y: 10, opacity: 0, scale: 0.98 }}
                transition={reduit ? { duration: 0 } : RESSORT}
                onMouseEnter={() => setSurvole(avis.id)}
                onMouseLeave={() => setSurvole(null)}
                style={{
                  pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
                  padding: 'var(--crm-space-sm) var(--crm-space-4xl) var(--crm-space-sm) var(--crm-space-sm)',
                  borderRadius: 'var(--crm-radius-pill)', background: sp.solidBg, border: `1px solid ${sp.solidBorder}`, boxShadow: sp.solidShadow,
                  color: sp.ink, fontFamily: 'var(--crm-font)', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
                }}
              >
                <span aria-hidden style={{
                  width: PASTILLE, height: PASTILLE, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: avis.alerte ? MXC_SYSTEM.yellow400 : MXC_SYSTEM.green300,
                  color: encreSur(avis.alerte ? MXC_SYSTEM.yellow400 : MXC_SYSTEM.green300),
                }}>
                  <MEIcon name={avis.alerte ? 'alert' : 'check'} size={14} />
                </span>
                {avis.texte}
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </>
  )
}
