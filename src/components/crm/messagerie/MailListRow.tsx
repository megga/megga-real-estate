/**
 * Une ligne de la liste (README §2 « Lignes ») : étoile, expéditeur, pastille de
 * libellé, objet, extrait, trombone, date.
 *
 * ⚠ La grille est celle de la maquette au pixel (`26px 185px minmax(0,1fr) 16px
 * 58px`) : ce sont des largeurs de COLONNE, que l'échelle d'espacement du CRM ne
 * gouverne pas — elle règle les rayons, les marges et les écarts, pas la mise en
 * page d'un tableau.
 *
 * ⚠ L'encre de la pastille se CALCULE (`ms.pillInk` → `encreSur`) : la couleur
 * d'un libellé est libre (D12), donc aucun blanc en dur ne peut être supposé
 * lisible dessus.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import type { MailLabel } from '@/hooks/useMailLabels'
import { displayAddress, mailDateLabel } from '@/lib/mail/format'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  row: MailThreadRow
  label: MailLabel | null
  lang: string
  onOpen: () => void
  onStar: () => void
  onContext: (e: React.MouseEvent) => void
}

export function MailListRow({ ms, row, label, lang, onOpen, onStar, onContext }: Props) {
  const { t } = useTranslation('messages')
  // ⚠ 600 et non 700 comme la maquette : la grammaire MEGGA X plafonne à 600
  // (cliquet `megga-x-grammar`), et l'écart 500/600 suffit à lire « non lu ».
  const weight = row.is_read ? 500 : 600
  const sender = row.from_name || row.from_email || (row.participants[0] ? displayAddress(row.participants[0]) : '')

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onOpen}
      onContextMenu={(e) => { e.preventDefault(); onContext(e) }}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
      style={{
        display: 'grid', gridTemplateColumns: '26px 185px minmax(0,1fr) 16px 58px', gap: 'var(--crm-space-md)',
        alignItems: 'center', padding: 'var(--crm-space-md) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)',
        borderBottom: `1px solid ${ms.bord2}`, cursor: 'pointer', color: ms.ink, transition: MAIL_TRANSITION,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover2 }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <button
        type="button"
        aria-label={row.is_starred ? t('mail.row.unstar') : t('mail.row.star')}
        aria-pressed={row.is_starred}
        onClick={(e) => { e.stopPropagation(); onStar() }}
        style={{
          width: 26, height: 26, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none',
          cursor: 'pointer', color: row.is_starred ? ms.star : ms.dim, transition: MAIL_TRANSITION,
        }}
      >
        <MEIcon name="star" size={15} color={row.is_starred ? ms.star : ms.dim} fill={row.is_starred ? ms.star : 'none'} />
      </button>

      <span style={{ fontWeight: weight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sender}</span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', minWidth: 0 }}>
        {label && (
          <span
            style={{
              borderRadius: PILL, padding: 'var(--crm-space-2xs) var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)',
              fontWeight: 600, background: label.color, color: ms.pillInk(label.color), flexShrink: 0,
            }}
          >
            {label.name}
          </span>
        )}
        <span style={{ fontWeight: weight, whiteSpace: 'nowrap', flexShrink: 0 }}>{row.subject || t('mail.row.noSubject')}</span>
        {row.snippet && (
          <span style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            — {row.snippet}
          </span>
        )}
      </span>

      <span style={{ width: 16, display: 'grid', placeItems: 'center' }}>
        {row.has_attachments && <MEIcon name="paperclip" size={13} color={ms.mut} />}
      </span>

      <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {mailDateLabel(row.last_message_at, new Date(), lang)}
      </span>
    </div>
  )
}
