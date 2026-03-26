import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Mail, Phone, MapPin, Zap,
  Calendar, Building2, Banknote, Ruler, DoorOpen,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate, formatDate } from '@/lib/utils'
import { getContactById, type MockContact } from '@/lib/mockData'
import { TRANSACTION_STAGE_LABELS, type TransactionStage } from '@/lib/constants'
import PageTransition from '@/components/layout/PageTransition'
import EditContactDialog from '@/components/contacts/EditContactDialog'
import MatchingPanel from '@/components/matching/MatchingPanel'
import CopilotSummary from '@/components/ai-copilot/CopilotSummary'
import BuyerIntelligence from '@/components/ai-copilot/BuyerIntelligence'
import SellerIntelligence from '@/components/ai-copilot/SellerIntelligence'
import { useContact } from '@/hooks/useContacts'
import { useCopilotContext } from '@/hooks/useCopilotContext'
import { useExternalMatching, type ExternalSearchCriteria } from '@/hooks/useExternalMatching'
import { useSellerPortals } from '@/hooks/useSellerPortal'
import { useSendPropertyEmail } from '@/hooks/useSendEmail'

const scoreConfig: Record<MockContact['score'], { label: string; dot: string; text: string }> = {
  hot:  { label: 'Hot',  dot: 'bg-red-400',    text: 'text-red-400' },
  warm: { label: 'Warm', dot: 'bg-amber-400',  text: 'text-amber-400' },
  cold: { label: 'Cold', dot: 'bg-blue-400',   text: 'text-blue-400' },
}

const typeConfig: Record<MockContact['type'], { label: string; text: string }> = {
  buyer:  { label: 'Acheteur',          text: 'text-theme-secondary' },
  seller: { label: 'Vendeur',           text: 'text-theme-secondary' },
  both:   { label: 'Acheteur/Vendeur',  text: 'text-theme-secondary' },
  lead:   { label: 'Lead',              text: 'text-theme-tertiary' },
}


function ContactAvatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

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

function InfoRow({ label, value }: { icon?: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-theme-border-subtle last:border-0">
      <span className="text-xs text-theme-tertiary">{label}</span>
      <span className="text-sm text-theme-primary text-right">{value}</span>
    </div>
  )
}

/* ─── Next Best Action inline component ─── */

function NextBestAction({ title, description, actionLabel, score }: {
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
            {score && (
              <span className="text-xs font-medium text-success">{score}%</span>
            )}
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

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const contact = getContactById(id || '')
  const { setActiveContact } = useCopilotContext()
  const [showEdit, setShowEdit] = useState(false)
  const { data: supabaseContact } = useContact(id)

  // AI enrichment data — inline defaults until ai-copilot Edge Function is wired
  const aiSummary = supabaseContact
    ? `${supabaseContact.first_name} ${supabaseContact.last_name} — ${supabaseContact.type === 'buyer' ? 'Acheteur' : supabaseContact.type === 'seller' ? 'Vendeur' : supabaseContact.type}. Contact créé dans le CRM.`
    : 'Chargement du résumé IA...'
  const nextAction = {
    title: 'Prendre contact',
    description: 'Planifier un premier échange pour qualifier le besoin.',
    actionLabel: 'Appeler',
    score: undefined as number | undefined,
  }
  const enrichedData = supabaseContact ? {
    ai_seriousness_score: supabaseContact.ai_seriousness_score ?? null,
    ai_purchase_probability: supabaseContact.ai_purchase_probability ?? null,
    ai_timing: supabaseContact.ai_timing ?? null,
    ai_engagement_level: supabaseContact.ai_engagement_level ?? null,
    budget_announced: supabaseContact.budget_announced ?? null,
    budget_estimated_ai: supabaseContact.budget_estimated_ai ?? null,
    ai_tension_level: supabaseContact.ai_tension_level ?? null,
    ai_price_reduction_probability: supabaseContact.ai_price_reduction_probability ?? null,
  } : null
  const isRefreshingAi = false
  const refreshAiSummary = () => { /* TODO: connect to ai-copilot Edge Function */ }
  const [matchingTab, setMatchingTab] = useState<'internal' | 'external'>('internal')
  const { createPortal: createSellerPortal, getPortalForContact, getPortalUrl, markInviteSent } = useSellerPortals()
  const sendEmail = useSendPropertyEmail()
  const [portalCopied, setPortalCopied] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  // Derive external search criteria from contact
  const externalCriteria: ExternalSearchCriteria | null = useMemo(() => {
    if (!contact?.search_criteria) return null
    const sc = contact.search_criteria
    const typeMap: Record<string, string> = {
      'Appartement': 'APARTMENT',
      'Maison': 'HOUSE',
      'Villa': 'VILLA',
    }
    const zone = sc.location.split(',')[0].trim() || 'geneve'
    return {
      zone,
      type: typeMap[sc.property_type] || 'APARTMENT',
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

  // Set copilot context when viewing a contact
  useEffect(() => {
    if (contact) {
      setActiveContact({
        id: contact.id,
        firstName: contact.first_name,
        lastName: contact.last_name,
        type: contact.type,
        email: contact.email,
        phone: contact.phone,
      })
    }
    return () => setActiveContact(null)
  }, [contact, setActiveContact])

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium text-theme-secondary mb-1">Contact introuvable</p>
        <p className="text-sm text-theme-muted mb-4">Ce contact n'existe pas ou a été supprimé.</p>
        <Link to="/dashboard/contacts" className="text-sm text-accent hover:text-accent/80 font-medium">
          ← Retour aux contacts
        </Link>
      </div>
    )
  }
  const fullName = `${contact.first_name} ${contact.last_name}`
  const sc = scoreConfig[contact.score]
  const tc = typeConfig[contact.type]

  const showBuyer = ['buyer', 'investor', 'lead', 'both'].includes(contact.type)
  const showSeller = ['seller', 'both'].includes(contact.type)

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
              <span className={cn('text-xs font-medium', tc.text)}>
                {tc.label}
              </span>
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', sc.text)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                {sc.label}
              </span>
            </div>
            <p className="text-sm text-theme-muted">
              Contact créé le {formatDate(contact.created_at)} · {contact.source}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
            >
              Éditer
            </button>
            <button className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
              Envoyer un message
            </button>
          </div>
        </div>
      </div>

      {/* Zone 2 — AI Summary */}
      <CopilotSummary
        summary={aiSummary}
        isRefreshing={isRefreshingAi}
        onRefresh={refreshAiSummary}
      />

      {/* Zone 3 — Next Best Action */}
      <NextBestAction
        title={nextAction.title}
        description={nextAction.description}
        actionLabel={nextAction.actionLabel}
        score={nextAction.score}
      />

      {/* Intelligence cards */}
      {enrichedData && (showBuyer || showSeller) && (
        <div className={cn('grid gap-4', showBuyer && showSeller ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
          {showBuyer && enrichedData.ai_seriousness_score != null && (
            <BuyerIntelligence
              seriousnessScore={enrichedData.ai_seriousness_score ?? null}
              purchaseProbability={enrichedData.ai_purchase_probability ?? null}
              timing={enrichedData.ai_timing ?? null}
              engagementLevel={enrichedData.ai_engagement_level ?? null}
              budgetAnnounced={enrichedData.budget_announced ?? null}
              budgetEstimatedAi={enrichedData.budget_estimated_ai ?? null}
            />
          )}
          {showSeller && enrichedData.ai_tension_level != null && (
            <SellerIntelligence
              tensionLevel={enrichedData.ai_tension_level ?? null}
              priceReductionProbability={enrichedData.ai_price_reduction_probability ?? null}
            />
          )}
        </div>
      )}

      {/* ── Portail vendeur (sellers only) ───────────────────────────── */}
      {showSeller && contact && (() => {
        const existingPortal = getPortalForContact(contact.id)
        const propertyTitle = contact.transactions?.[0]?.property_title || 'Bien en vente'
        const propertyAddress = `${contact.city || ''}, ${contact.canton || ''}`

        const handleCreatePortal = () => {
          createSellerPortal({
            contactId: contact.id,
            contactName: fullName,
            contactEmail: contact.email,
            propertyTitle,
            propertyAddress,
          })
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
                price: contact.transactions?.[0]?.price || 0,
                address: propertyAddress,
                city: contact.city || '',
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

        return (
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
              Portail vendeur
            </h2>

            {!existingPortal ? (
              <div className="text-center py-4">
                <p className="text-xs text-theme-tertiary mb-3">
                  Créez un portail pour que {contact.first_name} puisse suivre la vente de son bien en temps réel.
                </p>
                <button
                  onClick={handleCreatePortal}
                  className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
                >
                  Créer le portail vendeur
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Portal link */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-theme-hover/50">
                  <code className="flex-1 text-xs text-theme-secondary font-mono truncate">
                    {getPortalUrl(existingPortal.token)}
                  </code>
                  <button
                    onClick={handleCopyLink}
                    className="shrink-0 h-7 px-2.5 rounded-md text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
                  >
                    {portalCopied ? '✓ Copié' : 'Copier'}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendInvite}
                    disabled={inviteSending}
                    className="flex-1 h-8 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-30"
                  >
                    {inviteSending ? 'Envoi...' : inviteSent ? '✓ Invitation envoyée' : existingPortal.inviteSentAt ? 'Renvoyer l\'invitation' : 'Envoyer par email'}
                  </button>
                  <a
                    href={getPortalUrl(existingPortal.token)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center"
                  >
                    Prévisualiser
                  </a>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-[10px] text-theme-muted pt-1">
                  <span>Créé {formatRelativeDate(existingPortal.createdAt)}</span>
                  {existingPortal.inviteSentAt && <span>· Invitation envoyée {formatRelativeDate(existingPortal.inviteSentAt)}</span>}
                  {existingPortal.viewCount > 0 && <span>· {existingPortal.viewCount} vue{existingPortal.viewCount > 1 ? 's' : ''}</span>}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: info + criteria */}
        <div className="lg:col-span-1 space-y-4">
          {/* Contact info */}
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">Informations</h2>
            <div className="space-y-0.5">
              <InfoRow icon={Mail} label="Email" value={contact.email} />
              <InfoRow icon={Phone} label="Téléphone" value={contact.phone} />
              <InfoRow icon={MapPin} label="Adresse" value={`${contact.address}, ${contact.city} (${contact.canton})`} />
              <InfoRow icon={Calendar} label="Dernière activité" value={formatRelativeDate(contact.last_activity)} />
              {contact.tags.length > 0 && (
                <div className="flex items-baseline justify-between py-2 border-b border-theme-border-subtle last:border-0">
                  <span className="text-xs text-theme-tertiary">Tags</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {contact.tags.map((tag) => (
                      <span key={tag} className="text-[10px] text-theme-secondary border border-theme-border px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search criteria (buyers only) */}
          {contact.search_criteria && (
            <div className="rounded-xl border border-theme-border p-5">
              <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">Critères de recherche</h2>
              <div className="space-y-0.5">
                <InfoRow icon={Building2} label="Type de bien" value={contact.search_criteria.property_type} />
                <InfoRow
                  icon={Banknote}
                  label="Budget"
                  value={`${formatCHF(contact.search_criteria.budget_min)} – ${formatCHF(contact.search_criteria.budget_max)}`}
                />
                <InfoRow icon={MapPin} label="Localisation" value={contact.search_criteria.location} />
                <InfoRow icon={DoorOpen} label="Pièces min." value={`${contact.search_criteria.rooms_min} pièces`} />
                <InfoRow icon={Ruler} label="Surface min." value={`${contact.search_criteria.surface_min} m²`} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">Notes</h2>
            <textarea
              defaultValue={contact.notes}
              rows={4}
              className="w-full text-sm text-theme-primary bg-transparent border border-theme-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
              placeholder="Ajouter des notes..."
            />
          </div>
        </div>

        {/* Right column: transactions + activity */}
        <div className="lg:col-span-2 space-y-4">
          {/* Linked transactions */}
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
              Transactions liées
              {contact.transactions.length > 0 && (
                <span className="ml-2 text-xs font-normal text-theme-muted">
                  ({contact.transactions.length})
                </span>
              )}
            </h2>

            {contact.transactions.length === 0 ? (
              <p className="text-sm text-theme-muted py-4 text-center">Aucune transaction en cours</p>
            ) : (
              <div className="space-y-3">
                {contact.transactions.map((tx, i) => {
                  const stageLabel = TRANSACTION_STAGE_LABELS[tx.stage as TransactionStage]
                  return (
                    <div
                      key={tx.id}
                      className={cn(
                        'flex items-center gap-3 py-3 cursor-pointer group',
                        i < contact.transactions.length - 1 && 'border-b border-theme-border'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">{tx.property_title}</p>
                        <p className="text-xs text-theme-tertiary mt-0.5">
                          {stageLabel || tx.stage} · {formatRelativeDate(tx.updated_at)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-theme-primary shrink-0">{formatCHF(tx.price)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Matching section (buyers only) */}
          {showBuyer && contact.search_criteria && (
            <div className="rounded-xl border border-theme-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider">
                  Matching
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMatchingTab('internal')}
                    className={cn(
                      'h-7 px-3 rounded-md text-xs transition-colors',
                      matchingTab === 'internal'
                        ? 'bg-theme-active text-theme-primary font-medium'
                        : 'text-theme-tertiary hover:text-theme-secondary'
                    )}
                  >
                    Portefeuille
                  </button>
                  <button
                    onClick={() => setMatchingTab('external')}
                    className={cn(
                      'h-7 px-3 rounded-md text-xs transition-colors',
                      matchingTab === 'external'
                        ? 'bg-theme-active text-theme-primary font-medium'
                        : 'text-theme-tertiary hover:text-theme-secondary'
                    )}
                  >
                    Marché
                    {externalListings && externalListings.length > 0 && (
                      <span className="ml-1 text-[10px] text-theme-muted">{externalListings.length}</span>
                    )}
                  </button>
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
                      <p className="text-xs text-theme-tertiary">Impossible de charger les données du marché</p>
                      <button onClick={() => refetchExternal()} className="mt-1 text-xs text-accent hover:text-accent/80 transition-colors">Réessayer</button>
                    </div>
                  )}
                  {!isLoadingExternal && !externalError && externalListings && externalListings.length === 0 && (
                    <p className="text-xs text-theme-muted text-center py-8">Aucun bien trouvé sur le marché</p>
                  )}
                  {externalListings && externalListings.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-theme-muted mb-2">{externalListings.length} résultat{externalListings.length > 1 ? 's' : ''} · RealAdvisor</p>
                      {externalListings.slice(0, 6).map(listing => (
                        <div
                          key={listing.external_id}
                          onClick={() => navigate(`/dashboard/marche/${listing.external_id}`, {
                            state: { listing, contactName: fullName },
                          })}
                          className="flex items-center gap-3 py-2 border-b border-theme-border-subtle last:border-0 group cursor-pointer hover:bg-theme-hover rounded-lg px-1 -mx-1 transition-colors"
                        >
                          {listing.photo_url ? (
                            <img src={listing.photo_url} alt="" className="h-12 w-16 rounded-lg object-cover shrink-0" loading="lazy" />
                          ) : (
                            <div className="h-12 w-16 rounded-lg bg-theme-section shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-theme-primary truncate">{listing.price > 0 ? formatCHF(listing.price) : 'Prix sur demande'}</p>
                            <p className="text-xs text-theme-tertiary truncate">{listing.address || listing.city}{listing.rooms ? ` · ${listing.rooms}p.` : ''}{listing.surface_m2 ? ` · ${listing.surface_m2} m²` : ''}</p>
                            {listing.source_agency && <p className="text-[10px] text-theme-muted truncate">via {listing.source_agency}</p>}
                          </div>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-xs text-theme-tertiary">
                            Voir →
                          </span>
                        </div>
                      ))}
                      {externalListings.length > 6 && (
                        <Link to="/dashboard/matching" className="block text-xs text-accent hover:text-accent/80 text-center pt-2 transition-colors">
                          Voir les {externalListings.length} résultats →
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
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-4">
              Historique d'activité
            </h2>

            <div className="space-y-0">
              {contact.activities.map((activity, i) => (
                <div
                  key={activity.id}
                  className={cn(
                    'flex items-start gap-3 py-3',
                    i < contact.activities.length - 1 && 'border-b border-theme-border'
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-theme-tertiary shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-theme-primary">{activity.description}</p>
                    <p className="text-xs text-theme-tertiary mt-0.5">
                      {formatDate(activity.date)} · {formatRelativeDate(activity.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    <EditContactDialog open={showEdit} onClose={() => setShowEdit(false)} contact={contact} />
    </PageTransition>
  )
}
