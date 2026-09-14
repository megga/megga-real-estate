/**
 * CrmNotificationsPopover — la cloche du CRM de bureau, ouverte depuis la bande d'onglets.
 *
 * ⛔ REFAITE LE 14.09.2026 (Julien : « plus simple, lisible ; agrandis les icônes, que ça
 * fasse plus premium ; enlève la pause de deux heures »). Ce qui est parti, et pourquoi :
 *  · « Pause 2 h » ne mettait RIEN en pause — son unique appelant refermait la popover ;
 *  · le menu « ⋯ » de chaque ligne (lu / masquer / désactiver ce type) n'agissait que sur
 *    une COPIE locale, rendue intacte à la réouverture : trois gestes qui mentaient ;
 *  · « Voir toutes les notifications → » refermait la popover. Il mène désormais au
 *    journal d'audit, l'historique complet de ces mêmes événements.
 * Ce qui reste : une ligne par événement — ou par rafale regroupée (`regrouper`, dans
 * `useAgentNotifications`) — rangée par jour, dont la tuile de 40 px porte le glyphe du
 * type à 20 px sur la teinte de son domaine, comme la feuille mobile (`MrNotifSheet`).
 * Lire une ligne = cliquer dessus.
 *
 * ⚠ Posée dans le coin du cadre, au rayon mesuré, comme le menu du compte — les deux
 * popovers de la bande tombent au même endroit (`useCoinDuCadre`). Portée dans `<body>`
 * par la bande.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '../tokens'
import EtatVide from '@/components/crm/EtatVide'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CoinCadre } from '@/hooks/useCoinDuCadre'
import { KIND_META, type CrmNotif, type NotifGroup } from './data'
import TuileNotif from './TuileNotif'

/** Largeur de la coque : son bord droit se cale sur celui du cadre. */
const LARGEUR = 380

const JOURS: { id: NotifGroup; cle: string }[] = [
  { id: 'today', cle: 'notifications.groupToday' },
  { id: 'yesterday', cle: 'notifications.groupYesterday' },
  { id: 'older', cle: 'notifications.groupOlder' },
]

function Ligne({ n, sp, dark, onClick }: { n: CrmNotif; sp: CrmPalette; dark: boolean; onClick: () => void }) {
  const { t } = useTranslation('common')
  const [survol, setSurvol] = useState(false)
  const meta = KIND_META[n.kind] ?? KIND_META.system
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', width: '100%',
        padding: 'var(--crm-space-md) var(--crm-space-md)', border: 0, textAlign: 'left',
        borderRadius: 'var(--crm-radius-xl)', background: survol ? sp.focusSurface : 'transparent',
        cursor: 'pointer', fontFamily: 'inherit', color: sp.ink,
      }}
    >
      {/* La tuile : la PHOTO de ce que l'événement désigne quand il y en a une, sinon le
          glyphe du type sur la teinte de son domaine. En sombre le glyphe passe à
          l'encre — la teinte, sur fond noir, ne tient pas un trait fin. */}
      <TuileNotif
        n={n}
        fondTuile={`color-mix(in srgb, ${meta.dot} ${dark ? 24 : 11}%, transparent)`}
        encreGlyphe={dark ? sp.ink : meta.dot}
        anneau={survol ? sp.focusSurface : sp.solidBg}
        encrePastille={sp.accentInk}
      />

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', minWidth: 0 }}>
          <span style={{
            fontSize: 'var(--crm-text-lg)', fontWeight: n.read ? 500 : 600, color: sp.ink,
            lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{n.title}</span>
          {n.count > 1 && (
            <span title={t('notifications.grouped', { count: n.count })} style={{
              flexShrink: 0, padding: '0 var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)',
              background: sp.cardSubBg, color: sp.sub,
              fontSize: 'var(--crm-text-xs)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.6,
            }}>×{n.count}</span>
          )}
        </span>
        {n.body && (
          <span style={{
            fontSize: 'var(--crm-text-md)', color: sp.sub, lineHeight: 1.35,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{n.body}</span>
        )}
        <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
          {meta.label} · {n.time}
        </span>
      </span>

      {/* Non lu : une pastille d'accent. Lue, la place reste — les lignes ne dansent pas. */}
      <span aria-hidden style={{
        width: 8, height: 8, flexShrink: 0, borderRadius: 'var(--crm-radius-pill)',
        background: n.read ? 'transparent' : sp.accent,
      }} />
    </button>
  )
}

interface CrmNotificationsPopoverProps {
  sp: CrmPalette
  dark: boolean
  items: CrmNotif[]
  /** Le coin du cadre où se loger (`useCoinDuCadre`) ; `null` le temps de la mesure. */
  coin: CoinCadre | null
  onItemClick: (n: CrmNotif) => void
  onMarkAll: () => void
  /** « Voir tout l'historique » — le journal d'audit. Omis, la ligne n'est pas rendue. */
  onSeeAll?: () => void
}

/** La popover des notifications : lignes par jour, lecture au clic, un seul lien de sortie. */
export default function CrmNotificationsPopover({
  sp, dark, items, coin, onItemClick, onMarkAll, onSeeAll,
}: CrmNotificationsPopoverProps) {
  const { t } = useTranslation('common')
  const nonLus = items.filter((n) => !n.read).reduce((s, n) => s + n.count, 0)

  return (
    <div role="dialog" aria-label={t('nav.notifications')} style={{
      position: 'fixed', top: coin ? coin.top : -9999, left: coin ? coin.right - LARGEUR : -9999,
      width: LARGEUR, zIndex: 9000, padding: 'var(--crm-space-lg)',
      background: sp.solidBg, border: `1px solid ${sp.solidBorder}`,
      // Le rayon MESURÉ du cadre sur lequel elle se pose (26 ou 24 selon l'écran).
      borderRadius: coin?.rayon || 'var(--crm-radius-6xl)',
      boxShadow: sp.solidShadow,
      animation: 'crm-fade-up 280ms cubic-bezier(.22,1,.36,1)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: 'var(--crm-space-sm) var(--crm-space-md) var(--crm-space-lg)',
      }}>
        <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, letterSpacing: '-0.01em' }}>
          {t('nav.notifications')}
        </span>
        {nonLus > 0 && (
          <span style={{
            padding: '0 var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)',
            background: sp.accent, color: sp.accentInk,
            fontSize: 'var(--crm-text-xs)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.7,
          }}>{nonLus}</span>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onMarkAll}
          disabled={nonLus === 0}
          style={{
            border: 0, background: 'transparent', fontFamily: 'inherit',
            padding: 'var(--crm-space-xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)',
            fontSize: 'var(--crm-text-sm)', fontWeight: 600,
            color: nonLus === 0 ? sp.sub : sp.ink, cursor: nonLus === 0 ? 'default' : 'pointer',
            opacity: nonLus === 0 ? 0.6 : 1,
          }}
        >{t('notifications.markAllRead')}</button>
      </div>

      <div className="scrollbar-hide" style={{ maxHeight: 460, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <EtatVide dark={dark} glyphe={<MEIcon name="bell" size={22} />} titre={t('notifications.empty')} />
        ) : JOURS.map(({ id, cle }) => {
          const duJour = items.filter((n) => n.group === id)
          if (duJour.length === 0) return null
          return (
            <section key={id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
              <span style={{
                padding: 'var(--crm-space-sm) var(--crm-space-md) var(--crm-space-2xs)',
                fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub,
              }}>{t(cle)}</span>
              {duJour.map((n) => (
                <Ligne key={n.id} n={n} sp={sp} dark={dark} onClick={() => onItemClick(n)} />
              ))}
            </section>
          )
        })}
      </div>

      {onSeeAll && (
        <div style={{ borderTop: `1px solid ${sp.frameBorder}`, marginTop: 'var(--crm-space-sm)', paddingTop: 'var(--crm-space-sm)' }}>
          <button
            type="button"
            onClick={onSeeAll}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)',
              width: '100%', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              padding: 'var(--crm-space-md)', borderRadius: 'var(--crm-radius-xl)',
              fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub,
            }}
          >
            {t('notifications.seeAll')}
            <MEIcon name="arrow-right" size={14} color={sp.sub} />
          </button>
        </div>
      )}
    </div>
  )
}
