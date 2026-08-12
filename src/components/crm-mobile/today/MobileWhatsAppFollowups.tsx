/**
 * Bloc mobile « Suivis WhatsApp » : mapping d'échéance (duePill), ligne tappable
 * avec HITL (FollowupRow), et bloc plafonné (export).
 */
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMobileTokens } from '../useMobileTokens'
import type { MobileTokens } from '../tokens'
import { useAgencyFollowupSuggestions, useAgencyFollowupActions, AGENCY_FOLLOWUPS_LIMIT, type AgencyFollowupRow } from '@/hooks/useAgencyFollowupSuggestions'
import { followupDueLabel, type FollowupUrgency } from '@/lib/whatsappFollowupDue'

const MAX_ROWS = 4

// Pastille d'échéance → couleurs mobiles (paires bg/fg tint des tokens Sugar Pure ;
// jamais le CTA solide danger/dangerInk réservé aux boutons destructifs).
function duePill(urgency: FollowupUrgency, tk: MobileTokens): { bg: string; fg: string } {
  if (urgency === 'overdue') return { bg: tk.dangerBg, fg: tk.dangerFg }
  if (urgency === 'today') return { bg: tk.riskBg, fg: tk.riskFg }
  return { bg: tk.cardSubtle, fg: tk.muted }
}

/** Ligne d'un suivi : contact + action + pastille d'échéance ; tap → fiche, boutons ✓/✕ = HITL accepter/écarter. */
function FollowupRow({ row, last, tk }: { row: AgencyFollowupRow; last: boolean; tk: MobileTokens }) {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const { accept, dismiss } = useAgencyFollowupActions()
  // Occupé = une mutation en vol POUR CETTE ligne (les hooks sont partagés entre lignes).
  const busy = (accept.isPending && accept.variables === row.id) || (dismiss.isPending && dismiss.variables === row.id)
  const due = followupDueLabel(row.due_at)
  const pill = duePill(due.urgency, tk)
  const actionBtn = (label: string, onTap: () => void, icon: 'check' | 'close') => (
    <button
      type="button" title={label} aria-label={label} disabled={busy}
      onClick={(e) => { e.stopPropagation(); onTap() }}
      style={{
        width: 32, height: 32, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, padding: 0,
        display: 'grid', placeItems: 'center', cursor: busy ? 'default' : 'pointer',
        background: tk.cardSubtle, border: `1px solid ${tk.cardBorder}`,
        opacity: busy ? 0.45 : 1,
      }}
    >
      <MEIcon name={icon} size={15} color={icon === 'check' ? tk.goal : tk.muted} strokeWidth={2.4} />
    </button>
  )
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => navigate(`/dashboard/contacts/${row.contact_id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/dashboard/contacts/${row.contact_id}`) } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', width: '100%',
        padding: 'var(--crm-space-lg) var(--crm-space-xl) var(--crm-space-lg) var(--crm-space-2xl)', cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left', opacity: busy ? 0.55 : 1,
        boxShadow: last ? 'none' : `inset 0 -1px 0 ${tk.hair}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.contact_name}</div>
        <div style={{ fontSize: 'var(--crm-text-sm)', color: tk.muted, fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.action}</div>
      </div>
      <span style={{ background: pill.bg, color: pill.fg, padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: 0.2, whiteSpace: 'nowrap', flexShrink: 0 }}>{due.text}</span>
      {/* Actions HITL inline (la ligne reste tappable → fiche). ✓ accepter = vrai rappel · ✕ écarter. */}
      {actionBtn(t('today.waFollowups.accept'), () => accept.mutate(row.id), 'check')}
      {actionBtn(t('today.waFollowups.dismiss'), () => dismiss.mutate(row.id), 'close')}
    </div>
  )
}

/**
 * Bloc mobile « Suivis WhatsApp » — parité de CockpitWhatsAppFollowups (desktop).
 * MÊME hook agence (useAgencyFollowupSuggestions) et MÊME logique d'échéance
 * (whatsappFollowupDue) ; le HITL accepter(→ rappel)/écarter vit SUR la ligne
 * (useAgencyFollowupActions — la carte fiche est tombée à la refonte #823), le
 * tap de la ligne ouvre la fiche. Empty-state honnête : rien en attente = pas
 * de bloc (comme le desktop).
 */
export function MobileWhatsAppFollowups() {
  const { t } = useTranslation('dashboard')
  const { tk } = useMobileTokens()
  const { data: rows } = useAgencyFollowupSuggestions()

  if (!rows || rows.length === 0) return null

  const shown = rows.slice(0, MAX_ROWS)
  const extra = rows.length - shown.length
  // Lecture plafonnée : « N+ » plutôt qu'un total mensonger.
  const capped = rows.length >= AGENCY_FOLLOWUPS_LIMIT

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 11, padding: '0 var(--crm-space-2xs)' }}>
        <MEIcon name="message" size={15} color={tk.ink} />
        <h3 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, letterSpacing: -0.4, color: tk.ink }}>{t('today.waFollowups.title')}</h3>
        <span style={{ marginLeft: 'auto', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, flexShrink: 0 }}>
          {t('today.waFollowups.pending', { count: rows.length, countLabel: `${rows.length}${capped ? '+' : ''}` })}
        </span>
      </div>
      <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-3xl)', boxShadow: tk.shadowSm, overflow: 'hidden' }}>
        {shown.map((r, i) => (
          <FollowupRow key={r.id} row={r} last={extra === 0 && i === shown.length - 1} tk={tk} />
        ))}
        {extra > 0 && (
          <div style={{ padding: 'var(--crm-space-md) var(--crm-space-2xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, textAlign: 'center' }}>
            {t('today.waFollowups.more', { count: extra })}
          </div>
        )}
      </div>
    </div>
  )
}
