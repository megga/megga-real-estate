import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Mail, Zap,
  MessageSquare, Home, FileText, Shield, Star, Clock, ArrowRight,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate, formatDate } from '@/lib/utils'
import { TRANSACTION_STAGE_LABELS, type TransactionStage } from '@/lib/constants'
import PageTransition from '@/components/layout/PageTransition'
import EditContactDialog from '@/components/contacts/EditContactDialog'
import MatchingPanel from '@/components/matching/MatchingPanel'
import CopilotSummary from '@/components/ai-copilot/CopilotSummary'
import BuyerIntelligence from '@/components/ai-copilot/BuyerIntelligence'
import SellerIntelligence from '@/components/ai-copilot/SellerIntelligence'
import { useContact } from '@/hooks/useContacts'
import { useContactTransactions } from '@/hooks/useTransactions'
import { useContactTimeline, type TimelineEvent } from '@/hooks/useContactTimeline'
import { useCopilotContext } from '@/hooks/useCopilotContext'
import { useExternalMatching, type ExternalSearchCriteria } from '@/hooks/useExternalMatching'
import { useSellerPortals } from '@/hooks/useSellerPortal'
import { useSendPropertyEmail } from '@/hooks/useSendEmail'
import type { Contact } from '@/types/contact'

// ── Score / type config ───────────────────────────────────────────────────

const scoreConfig: Record<string, { label: string; dot: string; text: string }> = {
  hot:  { label: 'Hot',  dot: 'bg-red-400',    text: 'text-red-400' },
  warm: { label: 'Warm', dot: 'bg-amber-400',  text: 'text-amber-400' },
  cold: { label: 'Cold', dot: 'bg-blue-400',   text: 'text-blue-400' },
}

const typeKeys: Record<string, string> = {
  buyer: 'type.buyer', seller: 'type.seller', investor: 'type.investor',
  tenant: 'type.tenant', landlord: 'type.landlord', both: 'type.both', lead: 'type.lead',
}

// ── Timeline event config ─────────────────────────────────────────────────

function timelineIcon(action: string) {
  if (action.includes('email') || action.includes('sent'))   return <Mail className="h-3 w-3" />
  if (action.includes('visit'))                              return <Home className="h-3 w-3" />
  if (action.includes('stage'))                             return <ArrowRight className="h-3 w-3" />
  if (action.includes('message'))                           return <MessageSquare className="h-3 w-3" />
  if (action.includes('document') || action.includes('kyc'))return <FileText className="h-3 w-3" />
  if (action.includes('match'))                             return <Star className="h-3 w-3" />
  if (action.includes('kyc') || action.includes('screen'))  return <Shield className="h-3 w-3" />
  return <Clock className="h-3 w-3" />
}

function timelineLabel(event: TimelineEvent, t: (key: string, opts?: Record<string, string>) => string): string {
  const meta = event.metadata || {}
  const suffix = (detail?: string) => detail ? ` — ${detail}` : ''
  switch (event.action) {
    case 'stage_change':
      return t('timeline.stageChange', { from: String(meta.from_stage ?? ''), to: TRANSACTION_STAGE_LABELS[String(meta.to_stage ?? '') as TransactionStage] ?? String(meta.to_stage ?? '') })
    case 'email_sent':
      return t('timeline.emailSent') + suffix(meta.subject as string)
    case 'visit_planned':
      return t('timeline.visitPlanned') + suffix(meta.property_title as string)
    case 'visit_done':
      return t('timeline.visitDone') + suffix(meta.property_title as string)
    case 'property_sent':
      return t('timeline.propertySent') + suffix(meta.property_title as string)
    case 'note_added':
      return t('timeline.noteAdded')
    case 'document_uploaded':
      return t('timeline.documentUploaded') + suffix(meta.document_name as string)
    case 'kyc_created':
      return t('timeline.kycCreated')
    case 'seller_lead_created':
      return t('timeline.sellerLeadCreated')
    case 'contact_created':
      return t('timeline.contactCreated')
    case 'affordability_check':
      return t('timeline.affordabilityCheck')
    case 'match_sent':
      return t('timeline.matchSent') + suffix(meta.property_title as string)
    default:
      return event.action.replace(/_/g, ' ')
  }
}

// ── Sub-components ────────────────────────────────────────────────────────

function ContactAvatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className={cn(
      'rounded-full flex items-center justify-center flex-shrink-0 bg-theme-active',
      size === 'lg' ? 'h-14 w-14' : 'h-9 w-9'
    )}>
      <span className={cn('font-semibold text-theme-primary', size === 'lg' ? 'text-lg' : 'text-xs')}>
        {initials}
      </span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-theme-border-subtle last:border-0">
      <span className="text-xs text-theme-tertiary">{label}</span>
      <span className="text-sm text-theme-primary text-right">{value}</span>
    </div>
  )
}

function NextBestActionCard({ title, description, actionLabel, score }: {
  title: string
  description: string
  actionLabel: string
  score?: number
}) {
  return (
    <div className="rounded-xl border border-success/20 bg-success/5 p-4">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-theme-primary">{title}</h3>
            {score != null && <span className="text-xs font-medium text-success">{score}%</span>}
          </div>
          <p className="text-xs text-theme-secondary mt-0.5">{description}</p>
        </div>
        <button className="h-8 px-3 rounded-lg text-xs font-medium border border-success/30 text-success hover:bg-success/10 transition-colors shrink-0">
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

// ── AI summary hook ───────────────────────────────────────────────────────

function useAiSummary(contact: Contact | undefined) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const defaultSummary = contact
    ? `${contact.first_name} ${contact.last_name} — ${contact.type}. Contact créé le ${formatDate(contact.created_at)}.${contact.last_interaction_at ? ` Dernière interaction ${formatRelativeDate(contact.last_interaction_at)}.` : ''}`
    : null

  const refresh = useCallback(async () => {
    if (!contact) return
    setIsRefreshing(true)
    try {
      const { fetchContactMemory } = await import('@/hooks/useContactMemory')
      const { buildContactContext } = await import('@/lib/copilotContext')
      const memory = await fetchContactMemory(contact.id)

      if (memory.contact) {
        const context = buildContactContext(memory)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

        const response = await fetch(`${supabaseUrl}/functions/v1/ai-copilot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            action: 'summarize_contact',
            message: `Résume le profil de ${contact.first_name} ${contact.last_name}`,
            context,
            language: 'fr',
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setSummary(data.result ?? defaultSummary)
          return
        }
      }
    } catch {
      // fallback
    } finally {
      setIsRefreshing(false)
    }
    setSummary(defaultSummary)
  }, [contact, defaultSummary])

  return { summary: summary ?? defaultSummary, isRefreshing, refresh }
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('contacts')
  const { setActiveContact } = useCopilotContext()
  const [showEdit, setShowEdit] = useState(false)
  const [matchingTab, setMatchingTab] = useState<'internal' | 'external'>('internal')
  const [portalCopied, setPortalCopied] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  const { data: contact, isLoading, isError } = useContact(id)
  const { data: transactions = [] } = useContactTransactions(id)
  const { data: timeline = [], isLoading: timelineLoading } = useContactTimeline(id)
  const { summary: aiSummary, isRefreshing: isRefreshingAi, refresh: refreshAiSummary } = useAiSummary(contact)
  const { getPortalForContact, getPortalUrl, markInviteSent } = useSellerPortals()
  const [existingPortal, setExistingPortal] = useState<{ id: string; token: string; contactId: string; status: string } | null>(null)
  const sendEmail = useSendPropertyEmail()

  const fullName = contact ? `${contact.first_name} ${contact.last_name}` : ''

  // External matching criteria
  const externalCriteria: ExternalSearchCriteria | null = useMemo(() => {
    if (!contact?.search_criteria) return null
    const sc = contact.search_criteria
    const typeMap: Record<string, string> = { apartment: 'APARTMENT', house: 'HOUSE', villa: 'VILLA' }
    const zone = sc.zones?.[0] ?? ''
    if (!zone || !sc.budget_max) return null
    return {
      zone,
      type: typeMap[sc.type ?? ''] ?? 'APARTMENT',
      budget_max: sc.budget_max,
      budget_min: sc.budget_min,
      rooms_min: sc.rooms_min,
    }
  }, [contact?.search_criteria])

  const {
    data: externalListings,
    isLoading: isLoadingExternal,
    error: externalError,
    refetch: refetchExternal,
  } = useExternalMatching(externalCriteria)

  // Next best action — computed from Supabase data
  const nextAction = useMemo(() => {
    if (!contact) return null
    const daysSinceContact = contact.last_interaction_at
      ? Math.floor((Date.now() - new Date(contact.last_interaction_at).getTime()) / 86_400_000)
      : null

    if (contact.type === 'buyer' || contact.type === 'both') {
      if (daysSinceContact != null && daysSinceContact > 14) {
        return { title: t('detail.followUp'), description: t('detail.noInteractionDays', { days: daysSinceContact }), actionLabel: t('detail.call'), score: undefined }
      }
      return { title: t('detail.sendSelection'), description: t('detail.sendSelectionDesc'), actionLabel: t('detail.seeMatches'), score: undefined }
    }
    if (contact.type === 'seller') {
      return { title: t('detail.sellerUpdate'), description: t('detail.sellerUpdateDesc'), actionLabel: t('detail.call'), score: undefined }
    }
    return { title: t('detail.qualify'), description: t('detail.qualifyDesc'), actionLabel: t('detail.call'), score: undefined }
  }, [contact, t])

  // Set copilot context
  useEffect(() => {
    if (contact) {
      setActiveContact({
        id: contact.id,
        firstName: contact.first_name,
        lastName: contact.last_name,
        type: contact.type,
        email: contact.email ?? '',
        phone: contact.phone ?? '',
      })
    }
    return () => setActiveContact(null)
  }, [contact, setActiveContact])

  // ── Portal helpers ──
  useEffect(() => {
    if (contact?.id && ['seller', 'both'].includes(contact.type)) {
      getPortalForContact(contact.id).then(p => setExistingPortal(p))
    }
  }, [contact?.id, contact?.type, getPortalForContact])

  // ── Loading / error states ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-5 w-5 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (isError || !contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium text-theme-secondary mb-1">{t('detail.notFound')}</p>
        <p className="text-sm text-theme-muted mb-4">{t('detail.notFoundDesc')}</p>
        <Link to="/dashboard/contacts" className="text-sm text-accent hover:text-accent/80 font-medium">
          ← {t('detail.backToContacts')}
        </Link>
      </div>
    )
  }

  const sc = scoreConfig[contact.score ?? 'cold'] ?? scoreConfig.cold
  const tcLabel = typeKeys[contact.type] ? t(typeKeys[contact.type]) : contact.type

  const showBuyer  = ['buyer', 'investor', 'lead', 'both'].includes(contact.type)
  const showSeller = ['seller', 'both'].includes(contact.type)

  const propertyTitle = transactions[0]?.property?.title ?? t('detail.propertyForSale')
  const propertyAddress = transactions[0]?.property?.address ?? ''

  const handleCreatePortal = () => {
    // Portal creation is handled by Accept Seller Lead flow
    // This is kept for UI compatibility
  }

  const handleCopyLink = () => {
    if (!existingPortal) return
    navigator.clipboard.writeText(getPortalUrl(existingPortal.token))
    setPortalCopied(true)
    setTimeout(() => setPortalCopied(false), 2000)
  }

  const handleSendInvite = async () => {
    if (!existingPortal || !contact.email) return
    setInviteSending(true)
    try {
      const portalUrl = getPortalUrl(existingPortal.token)
      await sendEmail.mutateAsync({
        to: contact.email,
        contactFirstName: contact.first_name,
        property: {
          title: propertyTitle,
          price: transactions[0]?.price_final ?? transactions[0]?.price_offered ?? 0,
          address: propertyAddress,
          city: transactions[0]?.property?.city ?? '',
          rooms: null,
          surface_m2: null,
          type: '',
          photo_url: null,
          source_url: portalUrl,
          source_agency: null,
          source_portal: 'MEGGA',
        },
        message: `Votre portail vendeur est prêt. Suivez la vente de votre bien en temps réel :\n\n${portalUrl}\n\nCe lien est personnel et valable 6 mois.`,
      })
      markInviteSent(existingPortal.id)
      setInviteSent(true)
      setTimeout(() => setInviteSent(false), 4000)
    } catch {
      // error handled by mutation
    } finally {
      setInviteSending(false)
    }
  }

  // ── Render ──
  return (
    <PageTransition>
    <div className="space-y-4">

      {/* Header */}
      <div className="rounded-xl border border-theme-border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <ContactAvatar name={fullName} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold text-theme-primary">{fullName}</h1>
              <span className="text-xs font-medium text-theme-secondary">{tcLabel}</span>
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', sc.text)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                {sc.label}
              </span>
            </div>
            <p className="text-sm text-theme-muted">
              {t('detail.createdOn', { date: formatDate(contact.created_at) })}
              {contact.source ? ` · ${contact.source}` : ''}
              {contact.last_interaction_at ? ` · ${t('detail.lastInteraction', { date: formatRelativeDate(contact.last_interaction_at) })}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
            >
              {t('detail.edit')}
            </button>
            <button className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
              {t('detail.sendMessage')}
            </button>
          </div>
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <CopilotSummary
          summary={aiSummary}
          isRefreshing={isRefreshingAi}
          onRefresh={refreshAiSummary}
        />
      )}

      {/* Next Best Action */}
      {nextAction && (
        <NextBestActionCard
          title={nextAction.title}
          description={nextAction.description}
          actionLabel={nextAction.actionLabel}
          score={nextAction.score}
        />
      )}

      {/* Intelligence cards */}
      {(showBuyer || showSeller) && (
        <div className={cn('grid gap-4', showBuyer && showSeller ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
          {showBuyer && contact.ai_seriousness_score != null && (
            <BuyerIntelligence
              seriousnessScore={contact.ai_seriousness_score}
              purchaseProbability={contact.ai_purchase_probability}
              timing={contact.ai_timing}
              engagementLevel={contact.ai_engagement_level}
              budgetAnnounced={contact.budget_announced}
              budgetEstimatedAi={contact.budget_estimated_ai}
            />
          )}
          {showSeller && contact.ai_tension_level != null && (
            <SellerIntelligence
              tensionLevel={contact.ai_tension_level}
              priceReductionProbability={contact.ai_price_reduction_probability}
            />
          )}
        </div>
      )}

      {/* Portail vendeur (sellers only) */}
      {showSeller && (
        <div className="rounded-xl border border-theme-border p-5">
          <h2 className="text-sm font-semibold text-theme-primary capitalize mb-3">
            {t('detail.sellerPortal')}
          </h2>

          {!existingPortal ? (
            <div className="text-center py-4">
              <p className="text-xs text-theme-tertiary mb-3">
                {t('detail.createPortalDesc', { name: contact.first_name })}
              </p>
              <button
                onClick={handleCreatePortal}
                className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
              >
                {t('detail.createPortal')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-theme-hover/50">
                <code className="flex-1 text-xs text-theme-secondary font-mono truncate">
                  {getPortalUrl(existingPortal.token)}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="shrink-0 h-7 px-2.5 rounded-md text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
                >
                  {portalCopied ? `✓ ${t('detail.copied')}` : t('detail.copy')}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSendInvite}
                  disabled={inviteSending}
                  className="flex-1 h-8 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-30"
                >
                  {inviteSending ? t('detail.sending') : inviteSent ? `✓ ${t('detail.invitationSent')}` : t('detail.sendByEmail')}
                </button>
                <a
                  href={getPortalUrl(existingPortal.token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center"
                >
                  {t('detail.preview')}
                </a>
              </div>
              <div className="flex items-center gap-4 text-xs text-theme-muted pt-1">
                <span>{t('detail.portalActive')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Contact info */}
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary capitalize mb-3">{t('detail.information')}</h2>
            <div className="space-y-0.5">
              <InfoRow label={t('detail.email')} value={contact.email} />
              <InfoRow label={t('detail.phone')} value={contact.phone} />
              <InfoRow label={t('detail.whatsapp')} value={contact.whatsapp_phone} />
              <InfoRow label={t('detail.nationality')} value={contact.nationality} />
              <InfoRow label={t('detail.language')} value={contact.language} />
              <InfoRow
                label={t('detail.lastInteractionLabel')}
                value={contact.last_interaction_at ? formatRelativeDate(contact.last_interaction_at) : undefined}
              />
              {contact.tags && contact.tags.length > 0 && (
                <div className="flex items-baseline justify-between py-2 border-b border-theme-border-subtle last:border-0">
                  <span className="text-xs text-theme-tertiary">Tags</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {contact.tags.map((tag) => (
                      <span key={tag} className="text-xs text-theme-secondary border border-theme-border px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search criteria */}
          {contact.search_criteria && (
            <div className="rounded-xl border border-theme-border p-5">
              <h2 className="text-sm font-semibold text-theme-primary capitalize mb-3">{t('detail.searchCriteria')}</h2>
              <div className="space-y-0.5">
                <InfoRow label={t('detail.propertyType')} value={contact.search_criteria.type} />
                {(contact.search_criteria.budget_min != null || contact.search_criteria.budget_max != null) && (
                  <InfoRow
                    label={t('detail.budget')}
                    value={`${contact.search_criteria.budget_min ? formatCHF(contact.search_criteria.budget_min) : '–'} – ${contact.search_criteria.budget_max ? formatCHF(contact.search_criteria.budget_max) : '–'}`}
                  />
                )}
                {contact.search_zones && contact.search_zones.length > 0 && (
                  <InfoRow label={t('detail.zones')} value={contact.search_zones.join(', ')} />
                )}
                {contact.search_criteria.rooms_min != null && (
                  <InfoRow label={t('detail.minRooms')} value={t('detail.rooms', { count: contact.search_criteria.rooms_min })} />
                )}
                {contact.search_criteria.surface_min != null && (
                  <InfoRow label={t('detail.minSurface')} value={`${contact.search_criteria.surface_min} m²`} />
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary capitalize mb-3">{t('detail.notes')}</h2>
            <textarea
              defaultValue={contact.notes ?? ''}
              rows={4}
              className="w-full text-sm text-theme-primary bg-transparent border border-theme-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
              placeholder={t('detail.notesPlaceholder')}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Transactions */}
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary capitalize mb-3">
              {t('detail.linkedTransactions')}
              {transactions.length > 0 && (
                <span className="ml-2 text-xs font-normal text-theme-muted">({transactions.length})</span>
              )}
            </h2>

            {transactions.length === 0 ? (
              <p className="text-sm text-theme-muted py-4 text-center">{t('detail.noTransactions')}</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx, i) => {
                  const stageLabel = TRANSACTION_STAGE_LABELS[tx.stage as TransactionStage] ?? tx.stage
                  const price = tx.price_final ?? tx.price_offered ?? tx.property?.price ?? 0
                  return (
                    <div
                      key={tx.id}
                      className={cn(
                        'flex items-center gap-3 py-3 cursor-pointer group',
                        i < transactions.length - 1 && 'border-b border-theme-border'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">
                          {tx.property?.title ?? tx.property?.address ?? t('detail.untitledProperty')}
                        </p>
                        <p className="text-xs text-theme-tertiary mt-0.5">
                          {stageLabel} · {formatRelativeDate(tx.updated_at)}
                        </p>
                      </div>
                      {price > 0 && (
                        <span className="text-sm font-semibold text-theme-primary shrink-0">{formatCHF(price)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Matching (buyers only) */}
          {showBuyer && (
            <div className="rounded-xl border border-theme-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-theme-primary capitalize">Matching</h2>
                <div className="flex items-center gap-1">
                  {(['internal', 'external'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setMatchingTab(tab)}
                      className={cn(
                        'h-7 px-3 rounded-md text-xs transition-colors',
                        matchingTab === tab
                          ? 'bg-theme-active text-theme-primary font-medium'
                          : 'text-theme-tertiary hover:text-theme-secondary'
                      )}
                    >
                      {tab === 'internal' ? t('detail.portfolio') : t('detail.market')}
                      {tab === 'external' && externalListings && externalListings.length > 0 && (
                        <span className="ml-1 text-xs text-theme-muted">{externalListings.length}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {matchingTab === 'internal' && (
                <MatchingPanel contactId={contact.id} contactName={fullName} />
              )}

              {matchingTab === 'external' && (
                <div>
                  {isLoadingExternal && (
                    <div className="flex items-center justify-center h-24">
                      <div className="h-4 w-4 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
                    </div>
                  )}
                  {externalError && !isLoadingExternal && (
                    <div className="text-center py-8">
                      <p className="text-xs text-theme-tertiary">{t('detail.cannotLoadMarket')}</p>
                      <button onClick={() => refetchExternal()} className="mt-1 text-xs text-accent hover:text-accent/80 transition-colors">{t('detail.retry')}</button>
                    </div>
                  )}
                  {!isLoadingExternal && !externalError && externalListings && externalListings.length === 0 && (
                    <p className="text-xs text-theme-muted text-center py-8">{t('detail.noMarketResults')}</p>
                  )}
                  {!isLoadingExternal && !contact.search_criteria && (
                    <p className="text-xs text-theme-muted text-center py-8">{t('detail.noSearchCriteria')}</p>
                  )}
                  {externalListings && externalListings.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-theme-muted mb-2">{t(externalListings.length > 1 ? 'detail.results_plural' : 'detail.results', { count: externalListings.length })} · RealAdvisor</p>
                      {externalListings.slice(0, 6).map(listing => (
                        <div
                          key={listing.external_id}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/dashboard/marche/${listing.external_id}`, {
                            state: { listing, contactName: fullName },
                          })}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/dashboard/marche/${listing.external_id}`, { state: { listing, contactName: fullName } }) } }}
                          className="flex items-center gap-3 py-2 border-b border-theme-border-subtle last:border-0 group cursor-pointer hover:bg-theme-hover rounded-lg px-1 -mx-1 transition-colors"
                        >
                          {listing.photo_url ? (
                            <img src={listing.photo_url} alt="" className="h-12 w-16 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" />
                          ) : (
                            <div className="h-12 w-16 rounded-lg bg-theme-section shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-theme-primary truncate">{listing.price > 0 ? formatCHF(listing.price) : t('detail.priceOnRequest')}</p>
                            <p className="text-xs text-theme-tertiary truncate">{listing.address || listing.city}{listing.rooms ? ` · ${listing.rooms}p.` : ''}{listing.surface_m2 ? ` · ${listing.surface_m2} m²` : ''}</p>
                            {listing.source_agency && <p className="text-xs text-theme-muted truncate">via {listing.source_agency}</p>}
                          </div>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-xs text-theme-tertiary">
                            {t('detail.see')} →
                          </span>
                        </div>
                      ))}
                      {externalListings.length > 6 && (
                        <Link to="/dashboard/matching" className="block text-xs text-accent hover:text-accent/80 text-center pt-2 transition-colors">
                          {t('detail.seeAllResults', { count: externalListings.length })} →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Activity timeline */}
          <div className="rounded-xl border border-theme-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-theme-primary capitalize">
                {t('detail.activityHistory')}
              </h2>
              {timelineLoading && (
                <div className="h-3.5 w-3.5 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
              )}
            </div>

            {!timelineLoading && timeline.length === 0 && (
              <p className="text-sm text-theme-muted py-4 text-center">{t('detail.noActivity')}</p>
            )}

            {timeline.length > 0 && (
              <div className="space-y-0">
                {timeline.map((event, i) => (
                  <div
                    key={event.id}
                    className={cn(
                      'flex items-start gap-3 py-3',
                      i < timeline.length - 1 && 'border-b border-theme-border'
                    )}
                  >
                    <div className="w-6 h-6 rounded-full bg-theme-active flex items-center justify-center shrink-0 mt-0.5 text-theme-secondary">
                      {timelineIcon(event.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-theme-primary">{timelineLabel(event, t)}</p>
                      <p className="text-xs text-theme-tertiary mt-0.5">
                        {formatDate(event.created_at)} · {formatRelativeDate(event.created_at)}
                        {event.actor_name ? ` · ${event.actor_name}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    <EditContactDialog open={showEdit} onClose={() => setShowEdit(false)} contact={contact} />
    </PageTransition>
  )
}
