/**
 * « Rapprocher l'adresse » (README §7, transposé : le « numéro » de la maquette
 * WhatsApp devient l'ADRESSE e-mail, le « patient » devient le contact).
 *
 * Le geste écrit `mail_threads.contact_id` ET apprend l'alias
 * (`mail_contact_aliases`), en un seul appel `mail-actions link_contact` : les
 * prochains messages de cette adresse se rattacheront seuls (maître D11).
 * ⛔ On n'écrase JAMAIS l'adresse de la fiche — on apprend une adresse de plus.
 *
 * ⚠ « Créer la fiche » ouvre la liste des contacts SANS pré-remplissage : la
 * création pré-remplie depuis un mail n'est pas de ce lot (maître §9). Mieux
 * vaut un chemin qui dit ce qu'il fait qu'un formulaire à moitié rempli dont on
 * ne sait pas ce qu'il a retenu.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMailContactSearch } from '@/hooks/useMailContactSearch'
import { initialsOf } from '@/lib/mail/format'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

/** Largeur de la carte et opacité du voile (README §7). */
const LARGEUR = 520
const VOILE = 0.12
/** Diamètre de la pastille d'initiales d'une ligne de résultat. */
const AVATAR = 30
/** La RPC est muette sous deux caractères : inutile de la solliciter avant. */
const MIN_RECHERCHE = 2

interface Props {
  ms: MailSurfaces
  open: boolean
  email: string
  name: string | null
  busy: boolean
  onClose: () => void
  onLink: (contactId: string) => void
}

/** La modale de rapprochement : recherche, résultats, et la sortie « Créer la fiche ». */
export function MailLinkContactModal({ ms, open, email, name, busy, onClose, onLink }: Props) {
  const { t } = useTranslation('messages')
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  /**
   * ⚠ Tant que l'agent n'a rien tapé, on cherche le NOM de l'expéditeur : dans
   * la plupart des cas la fiche existe déjà sous ce nom, et la modale s'ouvre
   * alors sur la bonne ligne. Une modale qui s'ouvre vide fait retaper ce que
   * l'écran affiche juste au-dessus.
   */
  const hits = useMailContactSearch(q.length >= MIN_RECHERCHE ? q : (name ?? ''))

  return (
    <MailModalShell ms={ms} open={open} onClose={onClose} width={LARGEUR} ariaLabel={t('mail.link.title')} veil={VOILE} column>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>{t('mail.link.title')}</h2>
          <div style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut, marginTop: 'var(--crm-space-2xs)' }}>{name ? `${name} · ${email}` : email}</div>
        </div>
        <MailCloseButton ms={ms} onClick={onClose} label={t('mail.actions.close')} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-2xl)', marginTop: 'var(--crm-space-4xl)' }}>
        <MEIcon name="search" size={14} color={ms.mut} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('mail.link.searchPlaceholder')}
          aria-label={t('mail.link.search')}
          autoFocus
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: ms.ink, fontSize: 'var(--crm-text-sm)', fontFamily: 'inherit' }}
        />
      </label>

      <div style={{ marginTop: 'var(--crm-space-md)', overflowY: 'auto', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        {(hits.data ?? []).map((h) => (
          <div
            key={h.id}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', transition: MAIL_TRANSITION }}
            onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <div aria-hidden style={{ width: AVATAR, height: AVATAR, borderRadius: '50%', background: ms.elev, border: `1px solid ${ms.bord}`, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 600, flexShrink: 0 }}>
              {initialsOf(`${h.first_name} ${h.last_name}`, h.email)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.first_name} {h.last_name}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.email}{h.phone ? ` · ${h.phone}` : ''}</div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onLink(h.id)}
              style={{ background: 'none', border: 'none', color: ms.accent, fontSize: 'var(--crm-text-xs)', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit', padding: 0, flexShrink: 0 }}
            >
              {t('mail.link.cta')}
            </button>
          </div>
        ))}
        {hits.data?.length === 0 && (
          <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)', color: ms.mut }}>{t('mail.link.empty')}</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', borderTop: `1px solid ${ms.bord2}`, paddingTop: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-lg)' }}>
        <span style={{ flex: 1, fontSize: 'var(--crm-text-xs)', color: ms.mut }}>{t('mail.link.note')}</span>
        <button
          type="button"
          onClick={() => { onClose(); navigate('/dashboard/contacts') }}
          style={{ border: `1px solid ${ms.bord3}`, borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-3xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, background: 'transparent', color: ms.txt3, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: MAIL_TRANSITION }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = ms.ink; e.currentTarget.style.color = ms.ink }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = ms.bord3; e.currentTarget.style.color = ms.txt3 }}
        >
          {t('mail.link.create')}
        </button>
      </div>
    </MailModalShell>
  )
}
