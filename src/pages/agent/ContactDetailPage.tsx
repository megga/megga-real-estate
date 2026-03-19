import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Phone, MessageCircle, Mail, Tag, Building2,
  Banknote, Ruler, DoorOpen, MapPin, Sparkles, Calendar,
  ChevronRight, FileText, Clock,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate, formatDate } from '@/lib/utils'
import { TRANSACTION_STAGE_LABELS, LEGACY_STAGE_MAP, type TransactionStage } from '@/lib/constants'
import { useContactDetail } from '@/hooks/useContactDetail'
import CopilotSummary from '@/components/ai-copilot/CopilotSummary'
import NextBestAction from '@/components/action-board/NextBestAction'
import ContactTimeline from '@/components/crm/ContactTimeline'
import MatchingPanel from '@/components/matching/MatchingPanel'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { MockContact } from '@/lib/mockData'

// --- Config maps ---

const scoreConfig: Record<MockContact['score'], { label: string; dot: string; bg: string }> = {
  hot:  { label: 'Hot',  dot: 'bg-danger',  bg: 'bg-danger/10 text-danger' },
  warm: { label: 'Warm', dot: 'bg-warning', bg: 'bg-warning/10 text-warning' },
  cold: { label: 'Cold', dot: 'bg-accent',  bg: 'bg-accent/10 text-accent' },
}

const typeConfig: Record<string, { label: string; cls: string }> = {
  buyer:    { label: 'Acheteur',          cls: 'bg-accent/10 text-accent' },
  seller:   { label: 'Vendeur',           cls: 'bg-success/10 text-success' },
  investor: { label: 'Investisseur',      cls: 'bg-purple-100 text-purple-700' },
  both:     { label: 'Acheteur/Vendeur',  cls: 'bg-warning/10 text-warning' },
  lead:     { label: 'Lead',              cls: 'bg-primary-100 text-primary-600' },
  tenant:   { label: 'Locataire',         cls: 'bg-teal-100 text-teal-700' },
  landlord: { label: 'Bailleur',          cls: 'bg-indigo-100 text-indigo-700' },
}

const timingLabels: Record<string, string> = {
  immediate: 'Immédiat',
  '1-3_months': '1-3 mois',
  '3-6_months': '3-6 mois',
  '6-12_months': '6-12 mois',
  long_term: 'Long terme',
}

const engagementLabels: Record<string, { label: string; cls: string }> = {
  very_high: { label: 'Très élevé', cls: 'bg-success/10 text-success' },
  high:      { label: 'Élevé',      cls: 'bg-success/10 text-success' },
  medium:    { label: 'Moyen',      cls: 'bg-warning/10 text-warning' },
  low:       { label: 'Faible',     cls: 'bg-danger/10 text-danger' },
  dormant:   { label: 'Dormant',    cls: 'bg-primary-100 text-primary-500' },
}

const tensionLabels: Record<string, { label: string; cls: string }> = {
  calm:     { label: 'Calme',    cls: 'bg-success/10 text-success' },
  moderate: { label: 'Modéré',   cls: 'bg-warning/10 text-warning' },
  tense:    { label: 'Tendu',    cls: 'bg-danger/10 text-danger' },
  critical: { label: 'Critique', cls: 'bg-danger text-white' },
}

// --- Sub-components ---

function ContactAvatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const palette = [
    'bg-accent', 'bg-success', 'bg-warning', 'bg-danger',
    'bg-primary-600', 'bg-primary-400',
  ]
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length

  return (
    <div className={cn(
      'rounded-full flex items-center justify-center flex-shrink-0',
      palette[idx],
      size === 'lg' ? 'h-14 w-14' : 'h-9 w-9'
    )}>
      <span className={cn('font-semibold text-white', size === 'lg' ? 'text-lg' : 'text-xs')}>
        {initials}
      </span>
    </div>
  )
}

function ScoreBadge({ value, label }: { value: number; label: string }) {
  const color = value >= 70 ? 'text-success bg-success/10' : value >= 40 ? 'text-warning bg-warning/10' : 'text-danger bg-danger/10'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-badge', color)}>
        <Sparkles className="h-3 w-3" />
        {value}%
      </span>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, aiHint }: { icon: typeof Mail; label: string; value: string; aiHint?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-primary-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-primary-900">{value}</p>
          {aiHint && <Sparkles className="h-3 w-3 text-accent flex-shrink-0" />}
        </div>
      </div>
    </div>
  )
}

// --- Tab content: Infos ---

function TabInfos({ contact, enriched }: {
  contact: MockContact
  enriched: ReturnType<typeof useContactDetail>['enrichedData']
}) {
  const isBuyer = contact.type === 'buyer' || contact.type === 'both'
  const isSeller = contact.type === 'seller' || contact.type === 'both'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Contact info */}
      <div className="bg-white rounded-card shadow-card p-5">
        <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider mb-3">Coordonnées</h2>
        <div className="space-y-0.5">
          <InfoRow icon={Mail} label="Email" value={contact.email} />
          <InfoRow icon={Phone} label="Téléphone" value={contact.phone} />
          {enriched?.whatsapp_phone && (
            <InfoRow icon={MessageCircle} label="WhatsApp" value={enriched.whatsapp_phone} />
          )}
          <InfoRow icon={MapPin} label="Adresse" value={`${contact.address}, ${contact.city} (${contact.canton})`} />
          <InfoRow icon={Calendar} label="Dernière interaction" value={formatRelativeDate(contact.last_activity)} />
          {enriched?.language && (
            <InfoRow icon={Tag} label="Langue" value={enriched.language === 'fr' ? 'Français' : enriched.language} />
          )}
          {enriched?.nationality && (
            <InfoRow icon={Tag} label="Nationalité" value={enriched.nationality} />
          )}
        </div>

        {/* Tags */}
        {contact.tags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {contact.tags.map((tag) => (
                <span key={tag} className="text-xs bg-section text-primary-600 px-2.5 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Scoring */}
      {enriched && (
        <div className="bg-white rounded-card shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider">Scoring IA</h2>
            <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-badge">
              Estimation IA
            </span>
          </div>
          <div className="space-y-3">
            {enriched.ai_seriousness_score != null && (
              <ScoreBadge value={enriched.ai_seriousness_score} label="Sérieux" />
            )}
            {enriched.ai_purchase_probability != null && (
              <ScoreBadge value={enriched.ai_purchase_probability} label="Probabilité d'achat" />
            )}
            {enriched.ai_timing && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Timing</span>
                <span className="text-xs font-medium text-primary-700 bg-section px-1.5 py-0.5 rounded-badge">
                  {timingLabels[enriched.ai_timing] || enriched.ai_timing}
                </span>
              </div>
            )}
            {enriched.ai_engagement_level && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Engagement</span>
                <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-badge', engagementLabels[enriched.ai_engagement_level]?.cls)}>
                  {engagementLabels[enriched.ai_engagement_level]?.label}
                </span>
              </div>
            )}
            {isSeller && enriched.ai_tension_level && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Niveau de tension</span>
                <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-badge', tensionLabels[enriched.ai_tension_level]?.cls)}>
                  {tensionLabels[enriched.ai_tension_level]?.label}
                </span>
              </div>
            )}
            {isSeller && enriched.ai_price_reduction_probability != null && (
              <ScoreBadge value={enriched.ai_price_reduction_probability} label="Probabilité baisse prix" />
            )}
          </div>
        </div>
      )}

      {/* Search criteria (buyers) */}
      {isBuyer && contact.search_criteria && (
        <div className="bg-white rounded-card shadow-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider mb-3">Critères de recherche</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
            <InfoRow icon={Building2} label="Type de bien" value={contact.search_criteria.property_type} />
            <InfoRow
              icon={Banknote}
              label="Budget annoncé"
              value={enriched?.budget_announced ? formatCHF(enriched.budget_announced) : `${formatCHF(contact.search_criteria.budget_min)} – ${formatCHF(contact.search_criteria.budget_max)}`}
            />
            {enriched?.budget_estimated_ai && enriched.budget_announced && enriched.budget_estimated_ai !== enriched.budget_announced && (
              <InfoRow
                icon={Banknote}
                label="Budget estimé IA"
                value={formatCHF(enriched.budget_estimated_ai)}
                aiHint
              />
            )}
            <InfoRow icon={MapPin} label="Localisation" value={contact.search_criteria.location} />
            <InfoRow icon={DoorOpen} label="Pièces min." value={`${contact.search_criteria.rooms_min} pièces`} />
            <InfoRow icon={Ruler} label="Surface min." value={`${contact.search_criteria.surface_min} m²`} />
          </div>

          {/* Search zones as badges */}
          {enriched?.search_zones && enriched.search_zones.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Zones de recherche</p>
              <div className="flex flex-wrap gap-1.5">
                {enriched.search_zones.map((zone) => (
                  <span key={zone} className="text-xs bg-accent/10 text-accent font-medium px-2.5 py-1 rounded-full">
                    {zone}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timing */}
          {enriched?.ai_timing && (
            <div className="mt-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary-400" />
              <span className="text-xs text-muted-foreground">Timing d'achat :</span>
              <span className="text-xs font-medium text-primary-700 bg-section px-1.5 py-0.5 rounded-badge">
                {timingLabels[enriched.ai_timing]}
              </span>
              <Sparkles className="h-3 w-3 text-accent" />
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className={cn('bg-white rounded-card shadow-card p-5', !isBuyer && 'lg:col-span-2')}>
        <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider mb-3">Notes</h2>
        <textarea
          defaultValue={contact.notes}
          rows={4}
          className="w-full text-sm text-primary-700 bg-section border border-border rounded-input p-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
          placeholder="Ajouter des notes..."
        />
      </div>
    </div>
  )
}

// --- Tab content: Transactions ---

function TabTransactions({ transactions }: { transactions: MockContact['transactions'] }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-8 w-8 text-primary-300 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Aucune transaction liée</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => {
        const resolvedStage = (LEGACY_STAGE_MAP[tx.stage] || tx.stage) as TransactionStage
        const stageLabel = TRANSACTION_STAGE_LABELS[resolvedStage]
        return (
          <div
            key={tx.id}
            className="flex items-center gap-4 p-4 rounded-card bg-white shadow-card hover:shadow-card-hover transition-shadow cursor-pointer"
          >
            <div className="h-10 w-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary-900 truncate">{tx.property_title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                  {stageLabel || tx.stage}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeDate(tx.updated_at)}
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-primary-900">{formatCHF(tx.price)}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-primary-300 flex-shrink-0" />
          </div>
        )
      })}
    </div>
  )
}

// --- Placeholder tabs ---

function TabPlaceholder({ icon: Icon, message }: { icon: typeof Mail; message: string }) {
  return (
    <div className="text-center py-12">
      <Icon className="h-8 w-8 text-primary-300 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// --- Main Page ---

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const {
    contact, enrichedData, aiSummary, nextAction,
    isRefreshingAi, refreshAiSummary, isLoading, isError,
  } = useContactDetail(id || '')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isError || !contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium text-primary-700 mb-1">Contact introuvable</p>
        <p className="text-sm text-muted-foreground mb-4">Ce contact n'existe pas ou a été supprimé.</p>
        <Link to="/dashboard/contacts" className="text-sm text-accent hover:text-accent/80 font-medium">
          ← Retour aux contacts
        </Link>
      </div>
    )
  }

  const fullName = `${contact.first_name} ${contact.last_name}`
  const sc = scoreConfig[contact.score]
  const tc = typeConfig[contact.type] || typeConfig.lead

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        to="/dashboard/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Contacts
      </Link>

      {/* ========== ZONE 1 — En-tête ========== */}
      <div className="bg-white rounded-card shadow-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <ContactAvatar name={fullName} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold text-primary-900">{fullName}</h1>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-badge', tc.cls)}>
                {tc.label}
              </span>
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-badge', sc.bg)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                {sc.label}
              </span>
              {/* AI Engagement badge */}
              {enrichedData?.ai_engagement_level && engagementLabels[enrichedData.ai_engagement_level] && (
                <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-badge', engagementLabels[enrichedData.ai_engagement_level].cls)}>
                  <Sparkles className="h-2.5 w-2.5" />
                  {engagementLabels[enrichedData.ai_engagement_level].label}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Créé le {formatDate(contact.created_at)}
              {contact.last_activity && (
                <> · Dernière interaction {formatRelativeDate(contact.last_activity)}</>
              )}
            </p>
          </div>
          {/* Quick action buttons */}
          <div className="flex items-center gap-2">
            <button
              className="h-9 w-9 border border-border rounded-button hover:bg-section flex items-center justify-center transition-colors"
              title="Appeler"
            >
              <Phone className="h-4 w-4 text-primary-600" />
            </button>
            {enrichedData?.whatsapp_phone && (
              <button
                className="h-9 w-9 border border-border rounded-button hover:bg-green-50 flex items-center justify-center transition-colors"
                title="WhatsApp"
              >
                <MessageCircle className="h-4 w-4 text-green-600" />
              </button>
            )}
            <button
              className="h-9 w-9 border border-border rounded-button hover:bg-blue-50 flex items-center justify-center transition-colors"
              title="Email"
            >
              <Mail className="h-4 w-4 text-blue-600" />
            </button>
          </div>
        </div>
      </div>

      {/* ========== ZONE 2 — Résumé IA ========== */}
      <CopilotSummary
        summary={aiSummary}
        isRefreshing={isRefreshingAi}
        onRefresh={refreshAiSummary}
      />

      {/* ========== ZONE 3 — Next Best Action ========== */}
      <NextBestAction
        title={nextAction.title}
        description={nextAction.description}
        actionLabel={nextAction.actionLabel}
        score={nextAction.score}
      />

      {/* ========== ZONE 4 — Tabs ========== */}
      <div className="bg-white rounded-card shadow-card p-5">
        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="infos">Infos</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="biens">Biens envoyés</TabsTrigger>
            <TabsTrigger value="matching">Matching</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="offres">Offres</TabsTrigger>
          </TabsList>

          <TabsContent value="infos">
            <TabInfos contact={contact} enriched={enrichedData} />
          </TabsContent>

          <TabsContent value="timeline">
            <ContactTimeline activities={contact.activities} />
          </TabsContent>

          <TabsContent value="biens">
            <TabTransactions transactions={contact.transactions} />
          </TabsContent>

          <TabsContent value="matching">
            <MatchingPanel contactId={id || ''} contactName={fullName} />
          </TabsContent>

          <TabsContent value="documents">
            <TabPlaceholder icon={FileText} message="Aucun document lié à ce contact" />
          </TabsContent>

          <TabsContent value="offres">
            <TabPlaceholder icon={Banknote} message="Aucune offre pour ce contact" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
