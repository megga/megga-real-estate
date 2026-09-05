/**
 * « Classer dans le dossier » (README §8) : la pièce est COPIÉE dans les
 * documents du contact, elle ne bouge pas de la boîte.
 *
 * ⚠ PAS DE SEGMENT « ACCÈS » (maître §9). La maquette en montrait un (« Tout le
 * cabinet / Soins uniquement ») ; `documents` n'a AUCUNE colonne d'accès. Le
 * rendre serait un réglage sans effet — un mensonge d'interface qui se
 * découvrirait le jour où quelqu'un compterait dessus.
 *
 * ⚠ L'ALLOWLIST DES ESSENCES N'EST PAS RECOPIÉE ICI. Six types sont acceptés par
 * le bucket (PDF, JPEG, PNG, WebP, Word .doc/.docx) et le plafond vaut 20 Mio ;
 * c'est `mail-attachment` qui tranche, et l'écran rend son verdict. Dupliquer la
 * liste côté client la ferait diverger de la migration en silence, et l'écran
 * refuserait un jour ce que le serveur accepte.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMailContactSearch, type MailContactHit } from '@/hooks/useMailContactSearch'
import type { MailAttachmentRow } from '@/hooks/useMailThread'
import { invokeMail } from '@/lib/mail/invoke'
import { fileSizeLabel, initialsOf } from '@/lib/mail/format'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

/** Les huit classements proposés ; l'edge en dérive `document_category`. */
const TYPES = ['contrat', 'mandat', 'piece_identite', 'justificatif_domicile', 'financement', 'plan', 'photo', 'autre'] as const
type TypeDoc = (typeof TYPES)[number]

/** Motif du serveur → clé i18n. Ce qui n'y figure pas tombe sur `generic`. */
const ERREURS: Record<string, string> = {
  unsupported_type: 'mail.file.err.unsupported',
  too_large: 'mail.file.err.tooLarge',
  contact_not_found: 'mail.file.err.contact',
}

/** Carte, voile et empilement (README §8). */
const LARGEUR = 560
const VOILE = 0.12
const Z_INDEX = 306
/** Le sélecteur de contact monte au-dessus de sa propre modale. */
const Z_PICKER = 310
/** Vignette de la pièce et hauteur maximale de la liste de contacts (README §8). */
const VIGNETTE = 76
const LISTE_MAX = 290
const AVATAR = 28

interface Props {
  ms: MailSurfaces
  att: MailAttachmentRow
  /** Le contact déjà rattaché au fil, s'il y en a un : le classement le suit par défaut. */
  defaultContactId: string | null
  onClose: () => void
  /** `avis` non nul = classé, mais quelque chose reste à dire à l'agent. */
  onFiled: (avis?: 'filedNotLinked') => void
  onPreview: () => void
}

/** La modale de classement. Montée avec sa pièce, donc la saisie repart de zéro. */
export function MailFileAttachmentModal({ ms, att, defaultContactId, onClose, onFiled, onPreview }: Props) {
  const { t } = useTranslation('messages')
  const [contact, setContact] = useState<MailContactHit | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [q, setQ] = useState('')
  const [type, setType] = useState<TypeDoc>('autre')
  // Le nom au dossier part du nom de fichier SANS son extension : elle est déjà
  // portée par l'essence, et un « .pdf » dans un nom de document est du bruit.
  const [name, setName] = useState(() => att.filename.replace(/\.[^.]+$/, ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hits = useMailContactSearch(q)

  const ext = att.filename.split('.').pop()?.toUpperCase() ?? ''
  const contactId = contact?.id ?? defaultContactId
  const estImage = att.mime_type.startsWith('image/')

  const submit = async () => {
    if (!contactId) return
    setBusy(true); setError(null)
    const r = await invokeMail<{ ok: true; document_id: string; warning?: string }>(
      'mail-attachment', { action: 'file', attachment_id: att.id, contact_id: contactId, document_type: type, name },
    )
    setBusy(false)
    if (r.error) { setError(t(ERREURS[r.error] ?? 'mail.file.err.generic')); return }
    // ⛔ `not_marked_filed` EST UN SUCCÈS, ET IL DOIT SE VOIR. L'edge répond 200
    // avec cet avertissement quand le document a bien été créé mais que
    // `mail_attachments.document_id` n'a pas pu être posé. Sans le remonter, la
    // pastille « Classé au dossier » n'apparaissait jamais, le bouton restait
    // offert, et l'agent classait une seconde fois : un doublon dans `documents`
    // — précisément ce que l'aperçu dit devoir empêcher.
    onFiled(r.data?.warning === 'not_marked_filed' ? 'filedNotLinked' : undefined)
  }

  const champ = {
    background: ms.elev, border: `1px solid ${ms.bord}`, color: ms.ink, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box' as const, borderRadius: PILL,
    padding: 'var(--crm-space-md) var(--crm-space-2xl)', fontSize: 'var(--crm-text-md)', width: '100%',
  }
  const surTitre = (texte: string) => (
    <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ms.mut, marginBottom: 'var(--crm-space-sm)' }}>{texte}</div>
  )

  return (
    <MailModalShell ms={ms} open onClose={onClose} width={LARGEUR} ariaLabel={t('mail.file.title')} veil={VOILE} zIndex={Z_INDEX}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, margin: 0 }}>{t('mail.file.title')}</h2>
          <div style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut, marginTop: 'var(--crm-space-2xs)' }}>{t('mail.file.subtitle')}</div>
        </div>
        <MailCloseButton ms={ms} onClick={onClose} label={t('mail.actions.close')} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)', marginTop: 'var(--crm-space-4xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', background: ms.elev, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)' }}>
          <button
            type="button"
            onClick={onPreview}
            aria-label={t('mail.file.zoom')}
            style={{ width: VIGNETTE, height: VIGNETTE, borderRadius: 'var(--crm-radius-lg)', background: ms.card, border: `1px solid ${ms.bord}`, cursor: 'zoom-in', display: 'grid', placeItems: 'center', color: ms.mut, flexShrink: 0 }}
          >
            <MEIcon name={estImage ? 'gallery' : 'file-text'} size={28} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{ext} · {fileSizeLabel(att.size_bytes)}</div>
            <button
              type="button"
              onClick={onPreview}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', background: 'none', border: 'none', padding: 0, marginTop: 'var(--crm-space-2xs)', color: ms.accentText, fontSize: 'var(--crm-text-xs)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <MEIcon name="zoom-in" size={12} color={ms.accentText} /> {t('mail.file.zoom')}
            </button>
          </div>
        </div>

        {/* ⚠ Le sélecteur est `position: absolute` DANS la carte, jamais `fixed` :
            le voile de la modale porte un `backdrop-filter`, qui piège tout
            `position: fixed` de ses descendants. */}
        <div style={{ position: 'relative' }}>
          {surTitre(t('mail.file.contact'))}
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            style={{ ...champ, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ flex: 1 }}>
              {contact ? `${contact.first_name} ${contact.last_name}` : defaultContactId ? t('mail.file.contactCurrent') : t('mail.file.contactPlaceholder')}
            </span>
            <MEIcon name="chevron-down" size={12} color={ms.mut} />
          </button>
          {pickerOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: Z_PICKER, background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-md)', maxHeight: LISTE_MAX, overflowY: 'auto', boxShadow: ms.solidShadow }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mail.link.searchPlaceholder')} aria-label={t('mail.link.search')} autoFocus style={{ ...champ, fontSize: 'var(--crm-text-sm)' }} />
              <div style={{ marginTop: 'var(--crm-space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
                {(hits.data ?? []).map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => { setContact(h); setPickerOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', width: '100%', textAlign: 'left', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: 'transparent', border: 'none', color: ms.ink, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span aria-hidden style={{ width: AVATAR, height: AVATAR, borderRadius: '50%', background: ms.elev, border: `1px solid ${ms.bord}`, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 600, flexShrink: 0 }}>
                      {initialsOf(`${h.first_name} ${h.last_name}`, h.email)}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{h.first_name} {h.last_name}</span>
                      <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{h.email}</span>
                    </span>
                  </button>
                ))}
                {hits.data?.length === 0 && (
                  <div style={{ padding: 'var(--crm-space-md)', fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.link.empty')}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          {surTitre(t('mail.file.type'))}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
            {TYPES.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={type === k}
                onClick={() => setType(k)}
                style={{
                  borderRadius: PILL, padding: 'var(--crm-space-xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', fontWeight: 500,
                  border: `1px solid ${type === k ? ms.accent : ms.bord3}`,
                  background: type === k ? ms.accent : ms.elev,
                  color: type === k ? ms.accentInk : ms.txt3,
                  cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION,
                }}
              >
                {t(`mail.file.types.${k}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          {surTitre(t('mail.file.name'))}
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t('mail.file.name')} style={champ} />
        </div>

        {error && <div role="alert" style={{ fontSize: 'var(--crm-text-xs)', color: ms.dangerText }}>{error}</div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-4xl)' }}>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-md)', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('mail.actions.cancel')}
        </button>
        <button
          type="button"
          disabled={!contactId || busy}
          onClick={() => void submit()}
          style={{
            background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL,
            padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
            cursor: contactId && !busy ? 'pointer' : 'default', opacity: contactId && !busy ? 1 : 0.5, fontFamily: 'inherit',
          }}
        >
          {busy ? t('mail.file.busy') : t('mail.file.submit')}
        </button>
      </div>
    </MailModalShell>
  )
}
