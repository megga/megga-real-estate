import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  Zap, Plus, Clock, Mail, Bell, FileText,
  ChevronDown, ChevronUp, X, Pencil, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useReminders, useAutomationRules, useMessageTemplates } from '@/hooks/useReminders'
import type { AutomationRule, MessageTemplate } from '@/hooks/useReminders'
import { formatRelativeDate } from '@/lib/utils'
import ReminderList from '@/components/automation/ReminderList'

// ── Shared styles ──────────────────────────────────────────────────────────

const inputClasses = 'w-full h-10 px-3 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors'
const labelClasses = 'block text-sm font-medium text-theme-primary mb-1.5'

// ── Trigger / Action options ──────────────────────────────────────────────

const TRIGGER_VALUES = ['property_sent', 'visit_completed', 'lead_inactive', 'document_missing', 'new_match'] as const

const ACTION_VALUES = ['create_reminder', 'send_email', 'notify_agent', 'create_task'] as const

const CATEGORY_VALUES = ['follow_up', 'post_visit', 'property_presentation', 'seller_update', 'visit_confirmation', 'objection_response'] as const

// ── New Rule Modal ────────────────────────────────────────────────────────

function NewRuleModal({ templates, onClose, onSave }: {
  templates: MessageTemplate[]
  onClose: () => void
  onSave: (rule: Omit<AutomationRule, 'id' | 'generatedCount' | 'activeCount' | 'lastTriggeredAt'>) => void
}) {
  const { t } = useTranslation('automation')
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<string>(TRIGGER_VALUES[0])
  const [action, setAction] = useState<string>(ACTION_VALUES[0])
  const [delayDays, setDelayDays] = useState(3)
  const [templateId, setTemplateId] = useState<string | null>(null)

  const triggerLabel = t(`triggers.${trigger}`)
  const actionLabel = t(`actions.${action}`)

  const canSave = name.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    onSave({
      name: name.trim(),
      triggerEvent: trigger,
      triggerLabel,
      action,
      actionLabel,
      delayDays,
      templateId,
      isActive: true,
      autoSend: false,
    })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="rounded-xl border border-theme-border bg-theme-card w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 className="text-base font-semibold text-theme-primary">{t('rule.title')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={labelClasses}>{t('rule.name')}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('rule.namePlaceholder')} className={inputClasses} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>{t('rule.trigger')}</label>
              <select value={trigger} onChange={e => setTrigger(e.target.value)} className={inputClasses}>
                {TRIGGER_VALUES.map(v => <option key={v} value={v}>{t(`triggers.${v}`)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClasses}>{t('rule.action')}</label>
              <select value={action} onChange={e => setAction(e.target.value)} className={inputClasses}>
                {ACTION_VALUES.map(v => <option key={v} value={v}>{t(`actions.${v}`)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>{t('rule.delay')}</label>
              <input type="number" min={1} max={90} value={delayDays} onChange={e => setDelayDays(Number(e.target.value))} className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>{t('rule.template')} <span className="text-theme-muted font-normal">({t('rule.templateOptional')})</span></label>
              <select value={templateId ?? ''} onChange={e => setTemplateId(e.target.value || null)} className={inputClasses}>
                <option value="">{t('rule.none')}</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="text-sm text-theme-secondary hover:text-theme-primary transition-colors">
            {t('rule.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('rule.create')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Template Modal (Create / Edit) ────────────────────────────────────────

function TemplateModal({ template, onClose, onSave }: {
  template?: MessageTemplate
  onClose: () => void
  onSave: (data: Omit<MessageTemplate, 'id'>) => void
}) {
  const { t } = useTranslation('automation')
  const isEdit = !!template
  const [name, setName] = useState(template?.name ?? '')
  const [category, setCategory] = useState(template?.category ?? 'follow_up')
  const [channel, setChannel] = useState<'email' | 'notification'>(template?.channel ?? 'email')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')

  const canSave = name.trim().length > 0 && body.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    onSave({
      name: name.trim(),
      category,
      channel,
      subject: channel === 'email' ? subject.trim() || null : null,
      body: body.trim(),
    })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="rounded-xl border border-theme-border bg-theme-card w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 className="text-base font-semibold text-theme-primary">{isEdit ? t('templateModal.edit') : t('templateModal.new')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors">
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={labelClasses}>{t('templateModal.name')}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('templateModal.namePlaceholder')} className={inputClasses} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>{t('templateModal.category')}</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputClasses}>
                {CATEGORY_VALUES.map(v => <option key={v} value={v}>{t(`categories.${v}`)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClasses}>{t('templateModal.channel')}</label>
              <select value={channel} onChange={e => setChannel(e.target.value as 'email' | 'notification')} className={inputClasses}>
                <option value="email">{t('templateModal.channelEmail')}</option>
                <option value="notification">{t('templateModal.channelNotification')}</option>
              </select>
            </div>
          </div>

          {channel === 'email' && (
            <div>
              <label className={labelClasses}>{t('templateModal.subject')}</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder={t('templateModal.subjectPlaceholder')} className={inputClasses} />
            </div>
          )}

          <div>
            <label className={labelClasses}>{t('templateModal.body')}</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={6}
              placeholder={t('templateModal.bodyPlaceholder')}
              className="w-full px-3 py-2.5 rounded-lg border border-theme-border bg-transparent text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none font-mono"
            />
            <p className="text-xs text-theme-muted mt-1">
              {t('templateModal.variables')} : {'{{contact.first_name}}'}, {'{{property.address}}'}, {'{{property.price}}'}, {'{{agent.full_name}}'}, {'{{agency.name}}'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-theme-border">
          <button onClick={onClose} className="text-sm text-theme-secondary hover:text-theme-primary transition-colors">
            {t('templateModal.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEdit ? t('templateModal.save') : t('templateModal.create')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Trigger config ──────────────────────────────────────────────────────────

const TRIGGER_CONFIG: Record<string, { icon: typeof Mail; dot: string; shortKey: string }> = {
  property_sent: { icon: Mail, dot: 'bg-blue-500', shortKey: 'triggerShort.property_sent' },
  visit_completed: { icon: Clock, dot: 'bg-teal-500', shortKey: 'triggerShort.visit_completed' },
  lead_inactive: { icon: Bell, dot: 'bg-amber-500', shortKey: 'triggerShort.lead_inactive' },
  document_missing: { icon: FileText, dot: 'bg-red-500', shortKey: 'triggerShort.document_missing' },
  new_match: { icon: Zap, dot: 'bg-purple-500', shortKey: 'triggerShort.new_match' },
}

// ── Rule Card ───────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onToggleAutoSend,
  onDuplicate,
  onDelete,
}: {
  rule: AutomationRule
  onToggle: () => void
  onToggleAutoSend: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('automation')
  const [expanded, setExpanded] = useState(false)
  const config = TRIGGER_CONFIG[rule.triggerEvent] || { icon: Zap, dot: 'bg-theme-tertiary', shortKey: rule.triggerEvent }
  const actionShort = t(`actionShort.${rule.action}`, rule.action)

  return (
    <div className={cn(
      'rounded-xl border border-theme-border overflow-hidden transition-opacity group',
      !rule.isActive && 'opacity-50'
    )}>
      <div className="p-4">
        {/* Row 1: dot + title + actions */}
        <div className="flex items-center gap-3">
          <span className={cn('w-2 h-2 rounded-full shrink-0', config.dot)} />
          <p className="text-sm font-medium text-theme-primary flex-1 min-w-0 truncate">{rule.name}</p>

          {/* Stats */}
          <div className="text-right shrink-0 hidden sm:block">
            <span className="text-xs text-theme-secondary">{t('rule.generated', { count: rule.generatedCount })}</span>
            {rule.activeCount > 0 && (
              <span className="text-xs text-amber-500 ml-1.5">{t('rule.inProgress', { count: rule.activeCount })}</span>
            )}
          </div>

          {/* Hover actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={onDuplicate} className="h-7 w-7 rounded-lg flex items-center justify-center text-theme-tertiary hover:text-theme-primary hover:bg-theme-active transition-colors" title={t('rule.duplicate')}>
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center text-theme-tertiary hover:text-red-500 hover:bg-theme-active transition-colors" title={t('rule.delete')}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <Switch checked={rule.isActive} onCheckedChange={onToggle} />

          <button
            onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 rounded-md flex items-center justify-center text-theme-tertiary hover:bg-theme-section transition-colors shrink-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Row 2: badges — aligned under the title (offset by dot + gap) */}
        <div className="flex items-center gap-1.5 mt-1.5 ml-5 flex-wrap">
          <span className="text-xs font-medium text-theme-secondary bg-theme-section px-1.5 py-0.5 rounded">
            {t(config.shortKey)}
          </span>
          <span className="text-xs text-theme-tertiary">→</span>
          <span className="text-xs font-medium text-theme-secondary bg-theme-section px-1.5 py-0.5 rounded">
            {actionShort}
          </span>
          <span className="text-xs text-theme-tertiary">·</span>
          <span className="text-xs font-medium text-theme-secondary">J+{rule.delayDays}</span>
          {rule.lastTriggeredAt && (
            <>
              <span className="text-xs text-theme-tertiary">·</span>
              <span className="text-xs text-theme-tertiary">{t('rule.lastTriggered', { date: formatRelativeDate(rule.lastTriggeredAt) })}</span>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-theme-border">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
            <div>
              <p className="text-xs text-theme-muted capitalize mb-1">{t('rule.triggerLabel')}</p>
              <p className="text-sm text-theme-primary">{rule.triggerLabel}</p>
            </div>
            <div>
              <p className="text-xs text-theme-muted capitalize mb-1">{t('rule.actionLabel')}</p>
              <p className="text-sm text-theme-primary">{rule.actionLabel}</p>
            </div>
            <div>
              <p className="text-xs text-theme-muted capitalize mb-1">{t('rule.delayLabel')}</p>
              <p className="text-sm text-theme-primary">{t(rule.delayDays > 1 ? 'rule.day_plural' : 'rule.day', { count: rule.delayDays })}</p>
            </div>
            <div>
              <p className="text-xs text-theme-muted capitalize mb-1">{t('rule.templateLabel')}</p>
              <p className="text-sm text-theme-primary">{rule.templateId || t('rule.none')}</p>
            </div>
          </div>

          {/* Auto-send toggle */}
          <div className="mt-4 p-3 rounded-lg bg-theme-section border border-theme-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-theme-primary">{t('rule.autoSend')}</p>
                <p className="text-xs text-theme-muted">{t('rule.autoSendDesc')}</p>
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

function TemplateCard({ template, onEdit, onDelete }: {
  template: ReturnType<typeof useMessageTemplates>['templates'][0]
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const { t } = useTranslation('automation')
  const channelLabel = template.channel === 'email' ? t('templateModal.channelEmail') : t('templateModal.channelNotification')

  return (
    <div className="rounded-xl border border-theme-border overflow-hidden group">
      <div className="flex items-center gap-3 p-4 cursor-pointer" role="button" tabIndex={0} aria-expanded={expanded} onClick={() => setExpanded(!expanded)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }}>
        <div className="h-9 w-9 rounded-lg bg-theme-section flex items-center justify-center flex-shrink-0 text-theme-muted">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-theme-primary">{template.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-medium text-theme-secondary bg-theme-section px-1.5 py-0.5 rounded-badge">
              {t(`categories.${template.category}`, template.category)}
            </span>
            <span className="text-xs text-theme-tertiary">
              {channelLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {onEdit && (
            <button onClick={onEdit} className="h-7 w-7 rounded-lg flex items-center justify-center text-theme-tertiary hover:text-theme-primary hover:bg-theme-active transition-colors" title={t('templateModal.edit')}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="h-7 w-7 rounded-lg flex items-center justify-center text-theme-tertiary hover:text-red-500 hover:bg-theme-active transition-colors" title={t('rule.delete')}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-theme-tertiary" /> : <ChevronDown className="h-4 w-4 text-theme-tertiary" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-theme-border">
          {template.subject && (
            <div className="mt-3">
              <p className="text-xs text-theme-muted mb-1">{t('templateModal.subject')}</p>
              <p className="text-sm text-theme-primary">{template.subject}</p>
            </div>
          )}
          <div className="mt-3">
            <p className="text-xs text-theme-muted mb-1">{t('templateModal.body')}</p>
            <pre className="text-xs text-theme-secondary bg-theme-section rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed">
              {template.body}
            </pre>
          </div>
          <div className="mt-2">
            <p className="text-xs text-theme-muted">
              {t('templateModal.variables')} : {'{{contact.first_name}}'}, {'{{property.address}}'}, {'{{property.price}}'}, {'{{agent.full_name}}'}, etc.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const { t } = useTranslation('automation')
  const { active, triggered, pending, markAsDone, snooze, cancel } = useReminders()
  const { rules, toggleRule, toggleAutoSend, addRule, deleteRule, duplicateRule } = useAutomationRules()
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useMessageTemplates()

  const [showNewRule, setShowNewRule] = useState(false)
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)

  const activeRules = rules.filter((r) => r.isActive).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">{t('title')}</h1>
          <p className="text-sm text-theme-muted mt-0.5">
            {t(activeRules > 1 ? 'rulesActive_plural' : 'rulesActive', { count: activeRules })} · {t(active.length > 1 ? 'remindersActive_plural' : 'remindersActive', { count: active.length })}
          </p>
        </div>
        <button
          onClick={() => setShowNewRule(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('newRule')}
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="reminders">
        <TabsList>
          <TabsTrigger value="reminders">
            {t('tabs.reminders')}
            {active.length > 0 && <span className="ml-1.5 w-2 h-2 rounded-full bg-red-500" />}
          </TabsTrigger>
          <TabsTrigger value="rules">
            {t('tabs.rules')}
          </TabsTrigger>
          <TabsTrigger value="templates">
            {t('tabs.templates')}
          </TabsTrigger>
        </TabsList>

        {/* Reminders tab */}
        <TabsContent value="reminders">
          <div className="space-y-4">
            {/* Triggered (urgent) */}
            {triggered.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-theme-primary mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {t('toProcess')} ({triggered.length})
                </h2>
                <ReminderList reminders={triggered} onDone={markAsDone} onSnooze={snooze} onCancel={cancel} />
              </div>
            )}

            {/* Pending */}
            {pending.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-theme-primary mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-theme-tertiary" />
                  {t('pending')} ({pending.length})
                </h2>
                <ReminderList reminders={pending} onDone={markAsDone} onSnooze={snooze} onCancel={cancel} />
              </div>
            )}

            {active.length === 0 && (
              <div className="text-center py-16 rounded-xl border border-theme-border">
                <div className="h-12 w-12 rounded-full bg-theme-active flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-6 w-6 text-theme-tertiary" />
                </div>
                <p className="text-sm font-medium text-theme-secondary">{t('noReminders')}</p>
                <p className="text-xs text-theme-tertiary mt-1">{t('noRemindersDesc')}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Rules tab */}
        <TabsContent value="rules">
          <div className="space-y-3">
            {/* Control banner — dismissable */}
            {!bannerDismissed && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-theme-border">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <p className="text-xs text-theme-secondary flex-1">
                  {t('bannerInfo')}
                </p>
                <button onClick={() => setBannerDismissed(true)} className="h-6 w-6 rounded flex items-center justify-center text-theme-tertiary hover:text-theme-primary transition-colors shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={() => toggleRule(rule.id)}
                onToggleAutoSend={() => toggleAutoSend(rule.id)}
                onDuplicate={() => duplicateRule(rule.id)}
                onDelete={() => deleteRule(rule.id)}
              />
            ))}
          </div>
        </TabsContent>

        {/* Templates tab */}
        <TabsContent value="templates">
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => setShowNewTemplate(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
              >
                <Plus className="h-3 w-3" />
                {t('newTemplate')}
              </button>
            </div>
            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onEdit={() => setEditingTemplate(tpl)}
                onDelete={() => deleteTemplate(tpl.id)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showNewRule && (
        <NewRuleModal
          templates={templates}
          onClose={() => setShowNewRule(false)}
          onSave={addRule}
        />
      )}
      {showNewTemplate && (
        <TemplateModal
          onClose={() => setShowNewTemplate(false)}
          onSave={addTemplate}
        />
      )}
      {editingTemplate && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={(data) => {
            updateTemplate(editingTemplate.id, data)
            setEditingTemplate(null)
          }}
        />
      )}
    </div>
  )
}
