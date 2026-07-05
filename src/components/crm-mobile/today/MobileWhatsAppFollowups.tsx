import { useNavigate } from 'react-router-dom'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMobileTokens } from '../useMobileTokens'
import type { MobileTokens } from '../tokens'
import { useAgencyFollowupSuggestions, AGENCY_FOLLOWUPS_LIMIT, type AgencyFollowupRow } from '@/hooks/useAgencyFollowupSuggestions'
import { followupDueLabel, type FollowupUrgency } from '@/lib/whatsappFollowupDue'

const MAX_ROWS = 4
const plural = (n: number) => (n > 1 ? 's' : '')

// Pastille d'échéance → couleurs mobiles (paires bg/fg tint des tokens Sugar Pure ;
// jamais le CTA solide danger/dangerInk réservé aux boutons destructifs).
function duePill(urgency: FollowupUrgency, tk: MobileTokens): { bg: string; fg: string } {
  if (urgency === 'overdue') return { bg: tk.dangerBg, fg: tk.dangerFg }
  if (urgency === 'today') return { bg: tk.riskBg, fg: tk.riskFg }
  return { bg: tk.cardSubtle, fg: tk.muted }
}

function FollowupRow({ row, last, tk }: { row: AgencyFollowupRow; last: boolean; tk: MobileTokens }) {
  const navigate = useNavigate()
  const due = followupDueLabel(row.due_at)
  const pill = duePill(due.urgency, tk)
  return (
    <button
      type="button"
      onClick={() => navigate(`/dashboard/contacts/${row.contact_id}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '12px 14px', border: 0, background: 'transparent', cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left',
        boxShadow: last ? 'none' : `inset 0 -1px 0 ${tk.hair}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: tk.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.contact_name}</div>
        <div style={{ fontSize: 11.5, color: tk.muted, fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.action}</div>
      </div>
      <span style={{ background: pill.bg, color: pill.fg, padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: 0.2, whiteSpace: 'nowrap', flexShrink: 0 }}>{due.text}</span>
      <MEIcon name="chevron-right" size={16} color={tk.ghost} />
    </button>
  )
}

/**
 * Bloc mobile « Suivis WhatsApp » — parité de CockpitWhatsAppFollowups (desktop).
 * MÊME hook agence (useAgencyFollowupSuggestions) et MÊME logique d'échéance
 * (whatsappFollowupDue) ; chaque ligne ouvre la fiche contact où vit le HITL
 * accepter(→ rappel)/écarter. Empty-state honnête : rien en attente = pas de bloc
 * (comme le desktop). Lecture seule (aucune mutation ici).
 */
export function MobileWhatsAppFollowups() {
  const { tk } = useMobileTokens()
  const { data: rows } = useAgencyFollowupSuggestions()

  if (!rows || rows.length === 0) return null

  const shown = rows.slice(0, MAX_ROWS)
  const extra = rows.length - shown.length
  // Lecture plafonnée : « N+ » plutôt qu'un total mensonger.
  const capped = rows.length >= AGENCY_FOLLOWUPS_LIMIT

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11, padding: '0 2px' }}>
        <MEIcon name="message" size={15} color={tk.ink} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: -0.4, color: tk.ink }}>Suivis WhatsApp</h3>
        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: tk.muted, flexShrink: 0 }}>
          {rows.length}{capped ? '+' : ''} suivi{plural(rows.length)} en attente
        </span>
      </div>
      <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 18, boxShadow: tk.shadowSm, overflow: 'hidden' }}>
        {shown.map((r, i) => (
          <FollowupRow key={r.id} row={r} last={extra === 0 && i === shown.length - 1} tk={tk} />
        ))}
        {extra > 0 && (
          <div style={{ padding: '9px 14px', fontSize: 11.5, fontWeight: 700, color: tk.muted, textAlign: 'center' }}>
            +{extra} autre{plural(extra)}
          </div>
        )}
      </div>
    </div>
  )
}
