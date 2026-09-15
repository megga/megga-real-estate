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
 *
 * La SÉLECTION (15.09.2026) : la pastille d'expéditeur devient une case au survol, au focus,
 * et sur toutes les lignes dès qu'une est cochée — comme Spark et Outlook. Même diamètre,
 * même place : la grille de la maquette ne gagne aucune colonne. Maj+clic coche une plage ;
 * Espace coche la ligne qui a le focus.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { MailThreadRow } from '@/hooks/useMailThreads'
import type { MailLabel } from '@/hooks/useMailLabels'
import type { MailSenderLogo } from '@/hooks/useMailSenderLogos'
import { displayAddress, mailDateLabel } from '@/lib/mail/format'
import { MailSenderAvatar } from './MailSenderAvatar'
import { MailCase } from './MailCase'
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
  /** La ligne est cochée. */
  selectionne: boolean
  /** Une ligne au moins est cochée : toutes les pastilles sont des cases. */
  enSelection: boolean
  /** Coche ou décoche ; `plage` = Maj enfoncée, du dernier fil coché jusqu'à celui-ci. */
  onSelect: (plage: boolean) => void
}

/** Diamètre de la pastille d'expéditeur dans une ligne : la ligne garde sa hauteur. */
const PASTILLE = 24

export function MailListRow({ ms, row, label, logo, lang, onOpen, onStar, onContext, selectionne, enSelection, onSelect }: Props) {
  const { t } = useTranslation('messages')
  const [survol, setSurvol] = useState(false)
  const [focus, setFocus] = useState(false)
  const caseVisible = selectionne || enSelection || survol || focus
  const fond = selectionne ? ms.elev : 'transparent'
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
      aria-selected={selectionne}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter') onOpen()
        if (e.key === ' ') { e.preventDefault(); onSelect(e.shiftKey) }
      }}
      style={{
        display: 'grid', gridTemplateColumns: '26px 185px minmax(0,1fr) 16px 58px', gap: 'var(--crm-space-md)',
        alignItems: 'center', padding: 'var(--crm-space-md) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)',
        borderBottom: `1px solid ${ms.bord2}`, cursor: 'pointer', color: ms.ink, transition: MAIL_TRANSITION, background: fond,
      }}
      onMouseEnter={(e) => { setSurvol(true); if (!selectionne) e.currentTarget.style.background = ms.hover2 }}
      onMouseLeave={(e) => { setSurvol(false); e.currentTarget.style.background = fond }}
    >
      {/* Pas d'étoile sur un spam : « Suivis » exclut le spam, le geste semblerait sans effet
          (même règle que le menu de la ligne). La cellule reste, la grille aussi. */}
      {row.is_spam ? <span aria-hidden style={{ width: 26 }} /> : (
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
      )}

      {/* La pastille vit DANS la colonne de l'expéditeur : la grille reste celle de la maquette. */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', minWidth: 0 }}>
        <button
          type="button"
          role="checkbox"
          aria-checked={selectionne}
          aria-label={t('mail.select.row', { sender })}
          onClick={(e) => { e.stopPropagation(); onSelect(e.shiftKey) }}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{ width: PASTILLE, height: PASTILLE, padding: 0, border: 'none', background: 'transparent', borderRadius: '50%', flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
        >
          {/* ⛔ `pointer-events: none` : le bouton doit être la CIBLE du clic, pas son contenu.
              La pastille devient case au survol, et un premier toucher (tablette) ou un clic
              rapide survole ET appuie dans la foulée : l'appui visait la pastille, que le rendu
              remplaçait avant le relâchement — et le navigateur ne rendait pas le clic. */}
          <span style={{ pointerEvents: 'none', display: 'grid', placeItems: 'center' }}>
            {caseVisible
              ? <MailCase ms={ms} etat={selectionne ? 'cochee' : 'vide'} taille={PASTILLE} />
              : <MailSenderAvatar ms={ms} nom={row.from_name} adresse={adresse} logo={logo} taille={PASTILLE} />}
          </span>
        </button>
        {/* L'adresse au survol : la colonne n'a la place que du nom. */}
        <span title={adresse ?? undefined} style={{ fontWeight: weight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sender}</span>
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
