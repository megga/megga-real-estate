/**
 * Carte d'affaire du Pipeline à cinq phases (proposition du 27.09.2026).
 *
 * ⛔ L'IDENTITÉ D'ABORD. La carte d'avant titrait la PROCHAINE ACTION (« Qualifier sa demande
 * WhatsApp »), mettait le client en gris et n'affichait pas le bien : on ne reconnaissait pas
 * l'affaire en balayant la colonne. Trois lignes, toujours les mêmes :
 *   1. le client ;
 *   2. UNE information (Julien, 28.09.2026 : « pas besoin de l'intérêt ET de la ville ») : le
 *      stade précis, réglable ici sans glisser — la colonne dit la phase, pas le stade. Dans une
 *      phase à stade unique, où il répéterait le titre de la colonne, le lieu du bien, le silence
 *      d'un dossier qui dort ou le budget recherché ;
 *   3. la prochaine action (icône + échéance colorée), et le montant.
 *
 * ⚠ UN SEUL GABARIT. Sans action, la ligne 3 dit « À planifier » au lieu de changer la hauteur
 * de la carte (l'ancienne passait de 76 à 50 px).
 *
 * ⚠ LA CARTE NEUVE ATTERRIT, LES AUTRES NON. Toutes naissent sans entrée (`initial={false}`) :
 * au chargement, cinquante cartes qui tombent feraient trembler le board. Seule celle que
 * « Nouveau deal » annonce (`arrivee`) naît cachée, et se pose quand la modale se retire.
 */
import { memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, type Transition } from 'motion/react'
import MEIcon from '@/components/propertyx/MEIcon'
import { encreSur } from '@/components/megga-x-crm/tokens'
import type { TransactionStage } from '@/lib/constants'
import { useEcranActif } from '@/hooks/useEcranActif'
import { CRM_STAGE_HUE, type CrmPalette } from '../tokens'
import type { CrmBien, CrmContact, CrmDeal } from '../mockData'
import { CardQuickActions, type DealCardActions } from './CardQuickActions'
import { amenerALaVue, contexteAffaire, iconeAction, jourCourt, montantDeCarte, type Arrivee } from './affaire'
import { echeanceDe, phase, phaseDe, stadeDuDeal } from './phases'
import { ton } from './tons'

/** La carte avant de se poser : un cran plus haut, un peu plus petite, invisible. */
const CACHEE = { opacity: 0, scale: 0.94, y: -12 }
const RESSORT_LAYOUT: Transition = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 }
/** Un ressort à peine sous-amorti : la carte se pose, sans rebond qui se remarque. */
const RESSORT_POSE: Transition = { type: 'spring', stiffness: 360, damping: 22, mass: 0.8 }
const ATTERRISSAGE: Transition = {
  layout: RESSORT_LAYOUT, opacity: { duration: 0.2, ease: 'easeOut' }, scale: RESSORT_POSE, y: RESSORT_POSE,
}
const ORDINAIRE: Transition = {
  layout: RESSORT_LAYOUT, opacity: { duration: 0.15 }, scale: { duration: 0.15 }, y: { duration: 0.15 },
}

interface Props extends DealCardActions {
  deal: CrmDeal
  contact: CrmContact
  bien: CrmBien | null
  sp: CrmPalette
  dark: boolean
  isDragging: boolean
  signing: boolean
  signExit: boolean
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onChangeStade: (stade: TransactionStage) => void
  /** Elle vient d'être créée : un anneau d'accent la désigne dans sa colonne, le temps d'un regard. */
  nouvelle?: boolean
  /** Née de « Nouveau deal » : cachée sous la modale, puis elle se pose. */
  arrivee?: Arrivee
  /** Le clic droit : le menu de l'affaire (`MenuContextuel`). */
  onMenu?: (e: React.MouseEvent) => void
}

function AffaireCardImpl({
  deal, contact, bien, sp, dark, isDragging, signing, signExit,
  onClick, onDragStart, onDragEnd, onChangeStade, nouvelle, arrivee, onMenu,
  onReassign, onArchive, onMarkLost, onScheduleVisit, onAskAiVisit,
}: Props) {
  const { t, i18n } = useTranslation('pipeline')
  const [hover, setHover] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [elevated, setElevated] = useState(false)
  const [stadesOuverts, setStadesOuverts] = useState(false)
  const stadesRef = useRef<HTMLDivElement>(null)
  const carteRef = useRef<HTMLDivElement>(null)
  // Lu au MONTAGE seulement : une carte déjà peinte ne s'efface pas pour réapparaître.
  const [neeCachee] = useState(() => arrivee !== undefined)
  // Une carte née hors de la vue (bas d'une colonne longue) y est amenée : le toast dit « créé »,
  // la carte dit OÙ. Dès l'attente, sous le voile — elle se pose alors là où l'œil arrive.
  useEffect(() => {
    if (nouvelle || arrivee === 'attente') amenerALaVue(carteRef.current)
  }, [nouvelle, arrivee])
  // ⛔ Écran caché muet (keepalive des onglets) : un Échap tapé ailleurs ne ferme rien ici.
  const ecranActif = useEcranActif()

  useEffect(() => {
    if (!stadesOuverts || !ecranActif) return
    const dehors = (e: MouseEvent) => {
      if (stadesRef.current && !stadesRef.current.contains(e.target as Node)) setStadesOuverts(false)
    }
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setStadesOuverts(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', echap)
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap) }
  }, [stadesOuverts, ecranActif])

  const stade = stadeDuDeal(deal)
  const idPhase = phaseDe(stade)
  const laPhase = idPhase ? phase(idPhase) : null
  // Un stade n'est nommé que si la phase en compte plusieurs : « Recherche · Recherche » ne dit rien.
  const stadeVisible = !!laPhase && laPhase.stades.length > 1

  // Une seule information sur la ligne 2 : le contexte ne parle que là où le stade se tait.
  const contexte = stadeVisible ? null
    : contexteAffaire(deal, contact, bien, i18n.language, (n) => t('phases.silence', { count: n }))

  const na = deal.nextAction
  const echeance = na ? echeanceDe(na.dueAt) : null
  const tonAction = !na ? ton('aPlanifier', sp)
    : echeance === 'retard' ? ton('retard', sp)
      : echeance === 'aujourdhui' ? ton('aujourdhui', sp)
        : null
  const libelleAction = !na ? t('phases.aPlanifier')
    : echeance === 'retard' ? t('board.card.overdue')
      : echeance === 'aujourdhui' ? t('board.card.today')
        : echeance === 'demain' ? t('board.card.tomorrow')
          : jourCourt(na.dueAt, i18n.language)
  const montant = montantDeCarte(deal, bien, i18n.language, t('phases.parMois'))

  return (
    <motion.div
      layout={!signing && !signExit}
      layoutId={`phdeal-${deal.id}`}
      initial={neeCachee ? CACHEE : false}
      animate={arrivee === 'attente' ? CACHEE : { opacity: isDragging ? 0.38 : 1, scale: isDragging ? 0.97 : 1, y: 0 }}
      transition={arrivee === 'atterrit' ? ATTERRISSAGE : ORDINAIRE}
      style={{ position: 'relative', zIndex: elevated || signing || stadesOuverts ? 60 : 'auto', flexShrink: 0 }}
    >
      <div
        ref={carteRef}
        draggable={!signing}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setStadesOuverts(false); onDragStart() }}
        onDragEnd={onDragEnd}
        onClick={!isDragging && !signing ? onClick : undefined}
        onContextMenu={!isDragging && !signing ? onMenu : undefined}
        onMouseEnter={() => { if (!isDragging && !signing) setHover(true) }}
        onMouseLeave={() => { if (!signing) { setHover(false); setMenuOpen(false) } }}
        style={{
          position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
          background: hover ? sp.focusSurface : sp.cardBg,
          borderRadius: 'var(--crm-radius-lg)',
          padding: 'var(--crm-space-lg) var(--crm-space-xl)',
          // Le filet du sombre (une seule surface depuis le 20.09.2026), l'ombre de carte en clair.
          boxShadow: isDragging ? 'none'
            : nouvelle ? (sp.isDark ? `0 0 0 2px ${sp.accent}` : `0 0 0 2px ${sp.accent}, ${sp.shadowSm}`)
              : sp.isDark ? `inset 0 0 0 1px ${sp.cardBorder}` : sp.shadowSm,
          cursor: signing ? 'default' : isDragging ? 'grabbing' : 'grab',
          overflow: signing ? 'hidden' : 'visible',
          // L'anneau de la carte neuve s'éteint lentement ; le glisser, lui, reste vif.
          userSelect: 'none', transition: isDragging ? 'box-shadow .15s, background .15s' : 'box-shadow .8s ease, background .15s',
          ...(signExit ? { animation: 'sgSignExit .6s cubic-bezier(.5,0,.75,0) forwards' } : null),
        }}
      >
        {signing && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'var(--crm-radius-lg)', zIndex: 30,
            background: CRM_STAGE_HUE.signed,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)',
          }}>
            <MEIcon name="check-circle" size={20} color={encreSur(CRM_STAGE_HUE.signed)} />
            <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: encreSur(CRM_STAGE_HUE.signed) }}>
              {t('board.sign.sealed')}
            </span>
          </div>
        )}
        {(hover || menuOpen) && !signing && (
          <CardQuickActions
            sp={sp} dark={dark} deal={deal}
            menuOpen={menuOpen} setMenuOpen={setMenuOpen}
            onActiveChange={setElevated}
            onReassign={onReassign} onArchive={onArchive} onMarkLost={onMarkLost}
            onScheduleVisit={onScheduleVisit} onAskAiVisit={onAskAiVisit}
          />
        )}

        <span style={{
          fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{`${contact.firstName} ${contact.lastName}`.trim()}</span>

        {(stadeVisible || contexte) && (
          <div ref={stadesRef} style={{
            position: 'relative', display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-2xs)',
            minWidth: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub,
          }}>
            {stadeVisible && (
              <button
                type="button"
                title={t('phases.preciser')}
                onClick={(e) => { e.stopPropagation(); setStadesOuverts((o) => !o) }}
                style={{
                  border: 0, padding: 0, background: 'transparent', cursor: 'pointer', flexShrink: 0,
                  fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, color: sp.ink,
                  textDecoration: stadesOuverts ? 'underline' : 'none', textUnderlineOffset: 2,
                }}
              >{t(`phases.stades.${stade}`, { defaultValue: t(`phases.noms.${idPhase}`) })}</button>
            )}
            {contexte && (
              <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contexte}</span>
            )}
            {stadesOuverts && laPhase && (
              <div
                role="menu"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 70, minWidth: 180,
                  display: 'flex', flexDirection: 'column', padding: 'var(--crm-space-2xs)',
                  background: sp.solidBg, border: `1px solid ${sp.solidBorder}`,
                  borderRadius: 'var(--crm-radius-lg)', boxShadow: sp.solidShadow,
                }}
              >
                {laPhase.stades.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="menuitemradio"
                    aria-checked={s === stade}
                    onClick={() => { setStadesOuverts(false); if (s !== stade) onChangeStade(s) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', textAlign: 'left',
                      border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)',
                      padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)',
                      background: s === stade ? sp.focusSurface : 'transparent',
                      color: s === stade ? sp.ink : sp.sub, fontWeight: s === stade ? 600 : 500,
                    }}
                  >
                    <span style={{ flex: 1 }}>{t(`phases.stades.${s}`)}</span>
                    {s === stade && <MEIcon name="check" size={12} color={sp.ink} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', minWidth: 0,
          fontSize: 'var(--crm-text-sm)', marginTop: 'var(--crm-space-2xs)',
        }}>
          <span
            title={na ? `${na.note || t(`timeline.kind.${na.kind}`, { defaultValue: t('timeline.kind.fallback') })}` : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', minWidth: 0,
              fontWeight: 600, color: tonAction ? tonAction.encre : sp.sub,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            <MEIcon name={na ? iconeAction(na.kind) : 'calendar'} size={13} color={tonAction ? tonAction.encre : sp.sub} />
            {libelleAction}
          </span>
          {montant && (
            <span style={{
              marginLeft: 'auto', flexShrink: 0, fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums',
            }}>{montant}</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/** Memo : une carte ne re-rend que si son deal, son contact, son bien ou son état de glisser change. */
export const AffaireCard = memo(AffaireCardImpl)
