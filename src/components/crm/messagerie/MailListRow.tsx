/**
 * Une ligne de la liste (README §2 « Lignes ») : étoile, expéditeur (précédé de sa
 * pastille — logo de l'entreprise ou initiales), pastille de libellé, objet, extrait,
 * trombone, date.
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
import type { MailSenderLogo } from '@/hooks/useMailSenderLogos'
import { displayAddress, mailDateLabel } from '@/lib/mail/format'
import { MailSenderAvatar } from './MailSenderAvatar'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  row: MailThreadRow
  label: MailLabel | null
  /** Le logo de l'expéditeur, s'il est connu — sinon la pastille porte ses initiales. */
  logo?: MailSenderLogo
  lang: string
  onOpen: () => void
  onStar: () => void
  onContext: (e: React.MouseEvent) => void
}

/** Diamètre de la pastille d'expéditeur dans une ligne : la ligne garde sa hauteur. */
const PASTILLE = 24

export function MailListRow({ ms, row, label, logo, lang, onOpen, onStar, onContext }: Props) {
  const { t } = useTranslation('messages')
  // ⚠ 600 et non 700 comme la maquette : la grammaire MEGGA X plafonne à 600
  // (cliquet `megga-x-grammar`), et l'écart 500/600 suffit à lire « non lu ».
  const weight = row.is_read ? 500 : 600
  const sender = row.from_name || row.from_email || (row.participants[0] ? displayAddress(row.participants[0]) : '')
  const adresse = row.from_email ?? row.participants[0]?.email ?? null

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

      {/* La pastille vit DANS la colonne de l'expéditeur : la grille reste celle de la maquette. */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', minWidth: 0 }}>
        <MailSenderAvatar ms={ms} nom={row.from_name} adresse={adresse} logo={logo} taille={PASTILLE} />
        <span style={{ fontWeight: weight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sender}</span>
      </span>

      {/* ⛔ La cellule ROGNE. L'objet ne rétrécissait jamais (`flexShrink: 0`) : dans une liste
          étroite ou sur un long objet, il débordait sur la colonne de la date et les deux
          textes se peignaient l'un sur l'autre (constaté au banc le 14.09.2026). */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', minWidth: 0, overflow: 'hidden' }}>
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
        {/* L'objet puis l'aperçu en UNE ligne de texte, comme Gmail : l'ellipse tombe à la fin
            de ce qui tient — dans l'aperçu d'abord, dans l'objet seulement s'il est trop long à
            lui seul. Deux boîtes flex rétrécissaient ensemble : l'objet cédait une fraction de
            pixel, et ça suffisait à lui mettre des points de suspension. */}
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: ms.mut }}>
          <span style={{ fontWeight: weight, color: ms.ink }}>{row.subject || t('mail.row.noSubject')}</span>
          {row.snippet && <span style={{ marginLeft: 'var(--crm-space-sm)' }}>— {row.snippet}</span>}
        </span>
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
