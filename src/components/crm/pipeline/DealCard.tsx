/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : carte deal du kanban.
 * Port 1:1 du handoff crm-screen-pipeline-sugar.jsx §DealCard.
 * Deux gabarits : avec prochaine action (icône + note + échéance, puis nom +
 * valeur indentés) ou sans (une ligne + « Planifier une action » — le clic
 * ouvre le deal). Overlay orange statique pendant la célébration de signature.
 * FLIP : wrapper motion.div (`layout` + layoutId) — les handlers HTML5 DnD
 * restent sur le div interne (les props drag d'un motion.div sont captées par
 * le gesture system de framer et n'atteindraient jamais le DOM).
 */

import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { encreSur } from '@/components/megga-x-crm/tokens'
import { motion } from 'motion/react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { CRM_STAGE_HUE, crmFmtCHF, type CrmPalette } from '../tokens'
import { crmContactById, type CrmDeal } from '../mockData'
import { CardQuickActions, type VisitSlot } from './CardQuickActions'

/** Callbacks des actions rapides de carte — partagés colonne → carte → popover. */
export interface DealCardActions {
  onReassign: (dealId: string, member: { id: string; name: string }) => void
  onArchive: (dealId: string) => void
  onMarkLost: (dealId: string) => void
  onScheduleVisit: (dealId: string, slot: VisitSlot) => void
  /** « Envoyer à MEGGA AI » du popover visite (brouillon copilote, human-in-the-loop). */
  onAskAiVisit: (dealId: string) => void
}

interface DealCardProps extends DealCardActions {
  deal: CrmDeal
  sp: CrmPalette
  dark: boolean
  isDragging: boolean
  signing: boolean
  signExit: boolean
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
}

function nextActionIcon(kind: string): MEIconName {
  if (kind === 'call') return 'phone'
  if (kind === 'visit') return 'home'
  if (kind === 'kyc') return 'shield'
  if (kind === 'match') return 'sparkle'
  return 'flag'
}

function DealCardImpl({
  deal, sp, dark, isDragging, signing, signExit,
  onClick, onDragStart, onDragEnd,
  onReassign, onArchive, onMarkLost, onScheduleVisit, onAskAiVisit,
}: DealCardProps) {
  const { t } = useTranslation('pipeline')
  const c = crmContactById(deal.contactId)
  const na = deal.nextAction

  // Retard / « Aujourd'hui » / « Demain » / jj/mm — comparé au jour réel (les
  // données prod sont vivantes ; l'ancre « deal le plus récent » du proto ne
  // servait qu'à ses dates figées).
  const overdue = useMemo(() => {
    if (!na?.dueAt) return false
    const p = (n: number) => String(n).padStart(2, '0')
    const now = new Date()
    return na.dueAt.slice(0, 10) < `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  }, [na])
  const naDay = useMemo(() => {
    if (!na?.dueAt) return ''
    const p = (n: number) => String(n).padStart(2, '0')
    const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    const d = na.dueAt.slice(0, 10)
    if (d === iso(new Date())) return t('board.card.today')
    if (d === iso(new Date(Date.now() + 864e5))) return t('board.card.tomorrow')
    return d.slice(5).split('-').reverse().join('/')
  }, [na, t])

  const danger = dark ? '#E0738C' : '#8E1F3D'
  const ink = sp.ink
  const sub = sp.sub
  const [hover, setHover] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [elevated, setElevated] = useState(false)

  if (!c) return null
  // La note d'un reminder peut être vide (message_template absent) — repli sur
  // le libellé localisé du kind pour que la ligne 1 reste parlante.
  const naNote = na ? (na.note || t(`timeline.kind.${na.kind}`, { defaultValue: t('timeline.kind.fallback') })) : ''

  return (
    <motion.div
      layout={!signing && !signExit}
      layoutId={`sgdeal-${deal.id}`}
      initial={false}
      animate={{ opacity: isDragging ? 0.38 : 1, scale: isDragging ? 0.97 : 1 }}
      transition={{
        layout: { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 },
        opacity: { duration: 0.15 }, scale: { duration: 0.15 },
      }}
      style={{ position: 'relative', zIndex: elevated || signing ? 60 : 'auto', flexShrink: 0 }}
    >
      <div
        draggable={!signing}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
        onDragEnd={onDragEnd}
        onClick={!isDragging && !signing ? onClick : undefined}
        style={{
          // Carte de deal : trois paliers selon l'état — au repos S2, au survol
          // S3, et S1 (creusée) quand elle n'a pas d'action suivante.
          background: na
            ? (hover ? sp.focusSurface : sp.cardBg)
            : sp.cardSubBg,
          borderRadius: 'var(--crm-radius-3xl)',
          padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
          boxShadow: isDragging ? 'none' : sp.shadowSm,
          cursor: signing ? 'default' : isDragging ? 'grabbing' : 'grab',
          position: 'relative',
          overflow: signing ? 'hidden' : 'visible',
          zIndex: elevated || signing ? 60 : 'auto',
          transition: 'box-shadow .15s, background .15s',
          userSelect: 'none',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          ...(signExit ? { animation: 'sgSignExit .6s cubic-bezier(.5,0,.75,0) forwards' } : null),
        }}
        onMouseEnter={() => { if (!isDragging && !signing) setHover(true) }}
        onMouseLeave={() => { if (!signing) { setHover(false); setMenuOpen(false) } }}
      >
        {signing && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'var(--crm-radius-3xl)', zIndex: 30,
            background: CRM_STAGE_HUE.signed,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 'var(--crm-space-md)',
          }}>
            <span style={{
              width: 44, height: 44, borderRadius: 'var(--crm-radius-pill)', background: '#FFFFFF',
              display: 'grid', placeItems: 'center',
            }}>
              <MEIcon name="check" size={22} color={CRM_STAGE_HUE.signed} />
            </span>
            {/* ⛔ Blanc sur l'orange de « Signé » (#E8892A) rend 2,61:1 — sous
                l'AA même au seuil de GRAND texte. L'aplat est figé, mais rien
                n'oblige à parier sur son encre : elle se dérive comme partout. */}
            <div style={{
              fontSize: 'var(--crm-text-xl)', fontWeight: 600,
              color: encreSur(CRM_STAGE_HUE.signed), letterSpacing: -0.2,
            }}>
              {t('board.sign.sealed')}
            </div>
          </div>
        )}
        {(hover || menuOpen) && (
          <CardQuickActions
            sp={sp} dark={dark} deal={deal}
            menuOpen={menuOpen} setMenuOpen={setMenuOpen}
            onActiveChange={setElevated}
            onReassign={onReassign} onArchive={onArchive} onMarkLost={onMarkLost}
            onScheduleVisit={onScheduleVisit} onAskAiVisit={onAskAiVisit}
          />
        )}
        {na ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', minWidth: 0 }}>
              <span style={{
                width: 'var(--crm-icon-slot)', height: 'var(--crm-icon-slot)',
                flexShrink: 0, display: 'grid', placeItems: 'center',
              }}>
                <MEIcon name={nextActionIcon(na.kind)} size={18} color={overdue ? danger : ink} />
              </span>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{naNote}</span>
              <span style={{
                fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: overdue ? danger : sub,
                fontVariantNumeric: 'tabular-nums', flexShrink: 0,
              }}>{overdue ? t('board.card.overdue') : naDay}</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)',
              // Aligne la 2e ligne sous le texte de la 1re : gouttière + écart.
              paddingLeft: 'calc(var(--crm-icon-slot) + var(--crm-space-md))',
              minWidth: 0,
            }}>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sub,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{c.firstName} {c.lastName}</span>
              {deal.value ? (
                <span style={{
                  fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ink, letterSpacing: -0.2,
                  fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                }}>{crmFmtCHF(deal.value)}</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
            minWidth: 0, padding: 'var(--crm-space-2xs) 0',
          }}>
            <span style={{
              flex: 1, minWidth: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sub,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{c.firstName} {c.lastName}, {deal.value ? crmFmtCHF(deal.value) : '—'}</span>
            <span style={{
              fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ink, textDecoration: 'underline',
              textUnderlineOffset: 2, whiteSpace: 'nowrap', flexShrink: 0,
            }}>{t('board.card.planAction')}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/** Memo : une carte ne re-rend que si son deal / son état de drag change. */
export const DealCard = memo(DealCardImpl)
