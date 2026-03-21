import { useState } from 'react'
import {
  Zap, Plus, Clock, Mail, Bell, FileText, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useReminders, useAutomationRules, useMessageTemplates } from '@/hooks/useReminders'
import ReminderList from '@/components/automation/ReminderList'

// ── Trigger labels ──────────────────────────────────────────────────────────

const TRIGGER_ICONS: Record<string, typeof Mail> = {
  property_sent: Mail,
  visit_completed: Clock,
  lead_inactive: Bell,
  document_missing: FileText,
  new_match: Zap,
}

// ── Rule Card ───────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onToggleAutoSend,
}: {
  rule: ReturnType<typeof useAutomationRules>['rules'][0]
  onToggle: () => void
  onToggleAutoSend: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = TRIGGER_ICONS[rule.triggerEvent] || Zap

  return (
    <div className={cn(
      'bg-white rounded-card shadow-card border border-border overflow-hidden transition-opacity',
      !rule.isActive && 'opacity-60'
    )}>
      <div className="flex items-center gap-3 p-4">
        <div className={cn(
          'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
          rule.isActive ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-gray-400'
        )}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary-900">{rule.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rule.triggerLabel} → {rule.actionLabel} (J+{rule.delayDays})
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{rule.generatedCount} relances</span>
          <Switch checked={rule.isActive} onCheckedChange={onToggle} />
          <button
            onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 rounded-md flex items-center justify-center text-primary-400 hover:bg-section transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border">
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Déclencheur</p>
              <p className="text-sm text-primary-800">{rule.triggerLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Action</p>
              <p className="text-sm text-primary-800">{rule.actionLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Délai</p>
              <p className="text-sm text-primary-800">{rule.delayDays} jour{rule.delayDays > 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Template</p>
              <p className="text-sm text-primary-800">{rule.templateId || 'Aucun'}</p>
            </div>
          </div>

          {/* Auto-send toggle */}
          <div className="mt-4 p-3 rounded-lg bg-section border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                <div>
                  <p className="text-xs font-medium text-primary-900">Envoi automatique</p>
                  <p className="text-[10px] text-muted-foreground">Si activé, le message sera envoyé sans validation agent</p>
                </div>
              </div>
              <Switch checked={rule.autoSend} onCheckedChange={onToggleAutoSend} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Template Card ───────────────────────────────────────────────────────────

function TemplateCard({ template }: { template: ReturnType<typeof useMessageTemplates>['templates'][0] }) {
  const [expanded, setExpanded] = useState(false)

  const channelBadge = template.channel === 'email'
    ? 'bg-blue-100 text-blue-600'
    : template.channel === 'whatsapp'
      ? 'bg-green-100 text-green-600'
      : 'bg-purple-100 text-purple-600'

  const categoryLabels: Record<string, string> = {
    follow_up: 'Relance',
    post_visit: 'Post-visite',
    property_presentation: 'Présentation bien',
    seller_update: 'Mise à jour vendeur',
    visit_confirmation: 'Confirmation visite',
  }

  return (
    <div className="bg-white rounded-card shadow-card border border-border overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="h-9 w-9 rounded-lg bg-section flex items-center justify-center flex-shrink-0 text-primary-500">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary-900">{template.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-medium text-primary-600 bg-section px-1.5 py-0.5 rounded-badge">
              {categoryLabels[template.category] || template.category}
            </span>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge', channelBadge)}>
              {template.channel === 'both' ? 'Email + WhatsApp' : template.channel === 'email' ? 'Email' : 'WhatsApp'}
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-primary-400" /> : <ChevronDown className="h-4 w-4 text-primary-400" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          {template.subject && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1">Objet</p>
              <p className="text-sm text-primary-800">{template.subject}</p>
            </div>
          )}
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">Corps du message</p>
            <pre className="text-xs text-primary-700 bg-section rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed">
              {template.body}
            </pre>
          </div>
          <div className="mt-2">
            <p className="text-[10px] text-muted-foreground">
              Variables : {'{{contact.first_name}}'}, {'{{property.address}}'}, {'{{property.price}}'}, {'{{agent.full_name}}'}, etc.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const { active, triggered, pending, markAsDone, snooze, cancel } = useReminders()
  const { rules, toggleRule, toggleAutoSend } = useAutomationRules()
  const { templates } = useMessageTemplates()

  const activeRules = rules.filter((r) => r.isActive).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Automatisation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeRules} règle{activeRules > 1 ? 's' : ''} active{activeRules > 1 ? 's' : ''} · {active.length} relance{active.length > 1 ? 's' : ''} en cours
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-button transition-colors">
          <Plus className="h-4 w-4" />
          Nouvelle règle
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="reminders">
        <TabsList>
          <TabsTrigger value="reminders">
            Relances
            {active.length > 0 && (
              <span className="ml-1.5 text-[10px] font-bold bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                {active.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules">
            Règles
            <span className="ml-1.5 text-[10px] font-bold bg-section text-primary-600 px-1.5 py-0.5 rounded-full">
              {rules.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="templates">
            Templates
            <span className="ml-1.5 text-[10px] font-bold bg-section text-primary-600 px-1.5 py-0.5 rounded-full">
              {templates.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Reminders tab */}
        <TabsContent value="reminders">
          <div className="space-y-4">
            {/* Triggered (urgent) */}
            {triggered.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-primary-900 mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  À traiter ({triggered.length})
                </h2>
                <ReminderList reminders={triggered} onDone={markAsDone} onSnooze={snooze} onCancel={cancel} />
              </div>
            )}

            {/* Pending */}
            {pending.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-primary-900 mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary-300" />
                  En attente ({pending.length})
                </h2>
                <ReminderList reminders={pending} onDone={markAsDone} onSnooze={snooze} onCancel={cancel} />
              </div>
            )}

            {active.length === 0 && (
              <div className="text-center py-12 bg-white rounded-card shadow-card">
                <Clock className="h-8 w-8 text-primary-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucune relance en attente</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Rules tab */}
        <TabsContent value="rules">
          <div className="space-y-3">
            {/* Control banner */}
            <div className="bg-accent/5 border border-accent/10 rounded-card p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
              <p className="text-xs text-primary-700">
                <span className="font-medium">L'agent garde le contrôle.</span> Par défaut, les relances créent des rappels. L'envoi automatique est désactivé et nécessite une activation explicite par règle.
              </p>
            </div>

            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={() => toggleRule(rule.id)}
                onToggleAutoSend={() => toggleAutoSend(rule.id)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Templates tab */}
        <TabsContent value="templates">
          <div className="space-y-3">
            {templates.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
