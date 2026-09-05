/**
 * Le popover « Joindre un document » (README §4) : un fichier de la machine, ou
 * un document déjà classé au dossier de l'agence.
 *
 * z-index 310 — au-dessus de la modale qui le porte (300), sous le menu
 * contextuel (320). Il est `position: absolute` DANS la carte, pas `fixed` : le
 * voile de la modale porte un `backdrop-filter`, qui piège tout `position:
 * fixed` de ses descendants.
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useAgencyDocuments, type AgencyDocument } from '@/hooks/useAgencyDocuments'
import { fileSizeLabel } from '@/lib/mail/format'
import { MAIL_TRANSITION, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  chosenDocIds: Set<string>
  onFiles: (files: File[]) => void
  onToggleDoc: (d: AgencyDocument) => void
  onClose: () => void
}

/** Largeur et hauteur de liste de la maquette (README §4). */
const LARGEUR = 340
const HAUTEUR_LISTE = 220

export function MailAttachPopover({ ms, chosenDocIds, onFiles, onToggleDoc, onClose }: Props) {
  const { t } = useTranslation('messages')
  const docs = useAgencyDocuments(true)
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  const styleLigne: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', width: '100%', textAlign: 'left',
    padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)',
    background: 'transparent', border: 'none', color: ms.ink, fontSize: 'var(--crm-text-sm)',
    cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION,
  }
  const survol = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = ms.hover },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'transparent' },
  }

  const ligneDoc = (d: AgencyDocument) => (
    <button key={d.id} type="button" onClick={() => onToggleDoc(d)} style={styleLigne} {...survol}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{fileSizeLabel(d.size_bytes)}</span>
      {chosenDocIds.has(d.id) && <MEIcon name="check" size={13} color={ms.accentText} />}
    </button>
  )

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, width: LARGEUR,
        background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-4xl)',
        padding: 'var(--crm-space-sm)', zIndex: 310, boxShadow: ms.solidShadow,
      }}
    >
      <input ref={fileRef} type="file" multiple hidden onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); onClose() }} />
      {/* ⚠ Cette ligne est écrite en JSX au lieu de passer par l'aide commune :
          `react-hooks/refs` est une ERREUR ici, et il refuse `fileRef.current`
          dans une flèche passée en ARGUMENT — il ne peut pas prouver qu'elle ne
          sera pas appelée pendant le rendu. Dans un gestionnaire JSX, il le sait. */}
      <button type="button" onClick={() => fileRef.current?.click()} style={styleLigne} {...survol}>
        <span style={{ flex: 1, minWidth: 0 }}>{t('mail.compose.fromComputer')}</span>
      </button>
      {/* ⚠ Pas de micro-capitale ni d'interlettrage sur ce sur-titre, contrairement
          à la maquette : les deux sont des idiomes de Sugar, et deux clauses du
          cliquet de grammaire les refusent. La casse normale suffit à séparer. */}
      <div style={{ padding: 'var(--crm-space-md) var(--crm-space-lg) var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut }}>
        {t('mail.compose.agencyDocs')}
      </div>
      <div style={{ maxHeight: HAUTEUR_LISTE, overflowY: 'auto' }}>
        {(docs.data ?? []).map(ligneDoc)}
        {docs.data?.length === 0 && (
          <div style={{ padding: 'var(--crm-space-md) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.compose.noAgencyDocs')}</div>
        )}
      </div>
    </div>
  )
}
