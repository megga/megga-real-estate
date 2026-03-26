import type { ContactMemoryData } from '@/hooks/useContactMemory'
import type { ContactScore } from '@/hooks/useScoreEngine'
import { formatCHF } from '@/lib/utils'

/**
 * Build a structured text context from contact memory for the AI copilot.
 * This is injected into the Claude prompt so the AI has full knowledge of the client.
 * Target: ~1500 tokens max to leave room for the response.
 */
export function buildContactContext(memory: ContactMemoryData): Record<string, unknown> {
  const { contact, interactions, matchesSent, visits, transactions } = memory

  if (!contact) return {}

  const context: Record<string, unknown> = {}

  // ── Contact profile ──
  const fullName = `${contact.first_name} ${contact.last_name}`
  const typeLabels: Record<string, string> = {
    buyer: 'Acheteur', seller: 'Vendeur', investor: 'Investisseur',
    tenant: 'Locataire', landlord: 'Bailleur', both: 'Acheteur/Vendeur', lead: 'Lead',
  }

  context.contact_profile = [
    `${fullName} — ${typeLabels[contact.type] ?? contact.type}`,
    contact.email && `Email: ${contact.email}`,
    contact.phone && `Tél: ${contact.phone}`,
    contact.nationality && `Nationalité: ${contact.nationality}`,
    contact.language && `Langue: ${contact.language}`,
    contact.score && `Score: ${contact.score}`,
    contact.source && `Source: ${contact.source}`,
    contact.budget_announced && `Budget annoncé: ${formatCHF(contact.budget_announced)}`,
    contact.budget_estimated_ai && `Budget estimé IA: ${formatCHF(contact.budget_estimated_ai)}`,
    contact.ai_seriousness_score != null && `Sérieux IA: ${contact.ai_seriousness_score}/100`,
    contact.ai_purchase_probability != null && `Probabilité achat: ${contact.ai_purchase_probability}%`,
    contact.ai_timing && `Timing: ${contact.ai_timing}`,
    contact.ai_engagement_level && `Engagement: ${contact.ai_engagement_level}`,
    contact.ai_tension_level && `Tension (vendeur): ${contact.ai_tension_level}`,
  ].filter(Boolean).join('\n')

  // ── Search criteria ──
  if (contact.search_criteria) {
    const c = contact.search_criteria as Record<string, unknown>
    const parts: string[] = []
    if (c.type) parts.push(`Type: ${c.type}`)
    if (c.rooms_min || c.rooms_max) parts.push(`Pièces: ${c.rooms_min ?? '?'}–${c.rooms_max ?? '?'}`)
    if (c.surface_min || c.surface_max) parts.push(`Surface: ${c.surface_min ?? '?'}–${c.surface_max ?? '?'} m²`)
    if (c.budget_min || c.budget_max) parts.push(`Budget: ${c.budget_min ? formatCHF(c.budget_min as number) : '?'} – ${c.budget_max ? formatCHF(c.budget_max as number) : '?'}`)
    if (Array.isArray(c.features) && c.features.length > 0) parts.push(`Features: ${(c.features as string[]).join(', ')}`)
    if (contact.search_zones?.length > 0) parts.push(`Zones: ${contact.search_zones.join(', ')}`)
    if (parts.length > 0) context.search_criteria = parts.join('\n')
  }

  // ── Notes agent ──
  if (contact.notes) {
    context.notes_agent = contact.notes
  }

  // ── Tags ──
  if (contact.tags?.length > 0) {
    context.tags = contact.tags.join(', ')
  }

  // ── Recent interactions (activity_events) ──
  if (interactions.length > 0) {
    context.recent_interactions = interactions
      .slice(0, 15)
      .map(e => {
        const date = new Date(e.created_at).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
        const detail = e.metadata && typeof e.metadata === 'object' && 'detail' in e.metadata
          ? ` — ${(e.metadata as Record<string, string>).detail}`
          : ''
        return `${date}: ${e.action}${detail}`
      })
      .join('\n')
  }

  // ── Properties sent (matches) ──
  if (matchesSent.length > 0) {
    const unwrap = (v: unknown) => Array.isArray(v) ? v[0] : v
    context.properties_sent = matchesSent
      .slice(0, 8)
      .map(m => {
        const p = unwrap(m.property) as { title: string; address: string; city: string; price: number } | null
        const date = m.sent_at
          ? new Date(m.sent_at).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
          : new Date(m.created_at).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
        const status = m.status === 'sent' ? 'envoyé' : m.status === 'interested' ? 'intéressé' : m.status === 'visit_planned' ? 'visite planifiée' : m.status
        return p
          ? `${date}: ${p.title} (${p.city}, ${formatCHF(p.price)}) — score ${m.score}%, ${status}`
          : `${date}: Bien (score ${m.score}%) — ${status}`
      })
      .join('\n')

    context.properties_sent_summary = `${matchesSent.length} bien(s) proposé(s), ${matchesSent.filter(m => m.status === 'interested').length} intéressé(s), ${matchesSent.filter(m => m.status === 'visit_planned').length} visite(s) planifiée(s)`
  }

  // ── Visits ──
  if (visits.length > 0) {
    const unwrap = (v: unknown) => Array.isArray(v) ? v[0] : v
    context.visits = visits
      .slice(0, 6)
      .map(v => {
        const p = unwrap(v.property) as { title: string; address: string; city: string } | null
        const date = new Date(v.scheduled_at).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
        const statusLabel = v.status === 'done' ? 'effectuée' : v.status === 'planned' ? 'planifiée' : v.status === 'confirmed' ? 'confirmée' : v.status === 'cancelled' ? 'annulée' : v.status
        const feedback = v.feedback_buyer ? ` — Feedback: "${v.feedback_buyer.slice(0, 100)}"` : ''
        const rating = v.rating ? ` (${v.rating}/5)` : ''
        return p
          ? `${date}: ${p.title} (${p.city}) — ${statusLabel}${rating}${feedback}`
          : `${date}: Visite — ${statusLabel}${rating}${feedback}`
      })
      .join('\n')
  }

  // ── Active transactions ──
  if (transactions.length > 0) {
    const unwrap = (v: unknown) => Array.isArray(v) ? v[0] : v
    context.transactions = transactions
      .map(t => {
        const p = unwrap(t.property) as { title: string; address: string; city: string; price: number } | null
        const stageLabels: Record<string, string> = {
          new_lead: 'Nouveau lead', to_qualify: 'À qualifier', active_search: 'Recherche active',
          visit_planned: 'Visite planifiée', visit_done: 'Visite effectuée', interest_confirmed: 'Intérêt confirmé',
          offer: 'Offre', negotiation: 'Négociation', reserved: 'Réservé',
          financing: 'Financement', notary: 'Notaire', signed: 'Signé',
        }
        const stage = stageLabels[t.stage] ?? t.stage
        const price = t.price_offered ? ` — Offre: ${formatCHF(t.price_offered)}` : ''
        return p
          ? `${p.title} (${p.city}) — Étape: ${stage}${price}`
          : `Deal — Étape: ${stage}${price}`
      })
      .join('\n')
  }

  return context
}

/**
 * Build a text summary of the contact context for display purposes.
 */
/**
 * Enrich context with Score Engine data.
 */
export function enrichWithScores(context: Record<string, unknown>, score: ContactScore | null): Record<string, unknown> {
  if (!score) return context

  const lines: string[] = []
  lines.push(`Score comportemental : ${score.buyer_score}/100`)
  lines.push(`Réactivité : ${score.reactivity_score}/100 | Engagement : ${score.engagement_score}/100 (${score.engagement_trend})`)
  lines.push(`Cohérence budget : ${score.budget_coherence_score}/100`)
  lines.push(`Probabilité de conversion : ${score.conversion_probability}%`)
  if (score.estimated_real_budget) lines.push(`Budget réel estimé : ${formatCHF(score.estimated_real_budget)}`)
  if (score.rejection_patterns.length > 0) lines.push(`Objections détectées : ${score.rejection_patterns.join(', ')}`)

  context.score_engine = lines.join('\n')
  return context
}

export function getContextSummary(memory: ContactMemoryData): string {
  const { contact, interactions, matchesSent, visits, transactions } = memory
  if (!contact) return ''

  const parts: string[] = []
  parts.push(`${contact.first_name} ${contact.last_name}`)
  if (interactions.length > 0) parts.push(`${interactions.length} interactions`)
  if (matchesSent.length > 0) parts.push(`${matchesSent.length} biens envoyés`)
  if (visits.length > 0) parts.push(`${visits.length} visites`)
  if (transactions.length > 0) parts.push(`${transactions.length} deal(s) actif(s)`)

  return parts.join(' · ')
}
