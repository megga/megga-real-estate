// Inbox de modération admin (P4) — deux files entrantes qui n'avaient aucune
// surface de traitement :
//   * seller_leads non assignés (soumissions vendeur storefront/vitrine) →
//     assignation à une agence (policy seller_leads_super_admin_all).
//   * contact_messages (formulaire contact storefront) → triage de statut.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Inbox, Mail } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

function fmtDateTime(iso: string): string {
  try {
    return format(new Date(iso), 'dd.MM.yyyy HH:mm')
  } catch {
    return iso
  }
}

// ── Leads vendeurs non assignés ──────────────────────────────────────────────
interface SellerLead {
  id: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  source: string
  status: string
  created_at: string
  assigned_agency_id: string | null
}

export function SellerLeadsInbox() {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [assigning, setAssigning] = useState<string | null>(null)

  const { data: leads, isLoading } = useQuery({
    queryKey: ['admin-seller-leads'],
    queryFn: async (): Promise<SellerLead[]> => {
      const { data, error } = await supabase
        .from('seller_leads')
        .select('id, contact_name, contact_email, contact_phone, source, status, created_at, assigned_agency_id')
        .is('assigned_agency_id', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as SellerLead[]
    },
    staleTime: 30_000,
  })

  const { data: agencies } = useQuery({
    queryKey: ['admin-agencies-slim'],
    queryFn: async () => {
      const { data, error } = await supabase.from('agencies').select('id, name').order('name').limit(200)
      if (error) throw error
      return data ?? []
    },
    staleTime: 300_000,
  })

  const assign = useMutation({
    mutationFn: async ({ leadId, agencyId }: { leadId: string; agencyId: string }) => {
      const { error } = await supabase
        .from('seller_leads')
        .update({ assigned_agency_id: agencyId })
        .eq('id', leadId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t('marketplace.sellerLeads.assigned'))
      void queryClient.invalidateQueries({ queryKey: ['admin-seller-leads'] })
    },
    onError: () => toast.error(t('marketplace.sellerLeads.assignError')),
  })

  return (
    <div className="rounded-xl border border-theme-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="h-4 w-4 text-theme-secondary" />
        <h2 className="text-sm font-semibold text-theme-primary">{t('marketplace.sellerLeads.title')}</h2>
      </div>
      {isLoading ? (
        <div className="h-16 bg-theme-hover rounded-lg animate-pulse" />
      ) : !leads || leads.length === 0 ? (
        <p className="text-sm text-theme-muted">{t('marketplace.sellerLeads.empty')}</p>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <div key={lead.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-theme-border-subtle px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-theme-primary">{lead.contact_name}</p>
                <p className="truncate text-xs text-theme-tertiary">
                  {lead.contact_email}{lead.contact_phone ? ` · ${lead.contact_phone}` : ''} · {lead.source} · {fmtDateTime(lead.created_at)}
                </p>
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return
                  setAssigning(lead.id)
                  assign.mutate({ leadId: lead.id, agencyId: e.target.value })
                }}
                disabled={assign.isPending && assigning === lead.id}
                className="h-8 px-2 text-xs bg-transparent border border-theme-border rounded-lg text-theme-primary"
              >
                <option value="">{t('marketplace.sellerLeads.assignTo')}</option>
                {(agencies ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Messages storefront (formulaire contact) ─────────────────────────────────
interface ContactMessage {
  id: string
  name: string
  email: string
  message: string
  source: string
  status: string
  created_at: string
}

const MESSAGE_STATUSES = ['new', 'answered', 'archived', 'spam'] as const

export function ContactMessagesInbox() {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: messages, isLoading } = useQuery({
    queryKey: ['admin-contact-messages'],
    queryFn: async (): Promise<ContactMessage[]> => {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('id, name, email, message, source, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as ContactMessage[]
    },
    staleTime: 30_000,
  })

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('contact_messages').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] })
    },
    onError: () => toast.error(t('marketplace.messages.statusError')),
  })

  return (
    <div className="rounded-xl border border-theme-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="h-4 w-4 text-theme-secondary" />
        <h2 className="text-sm font-semibold text-theme-primary">{t('marketplace.messages.title')}</h2>
      </div>
      {isLoading ? (
        <div className="h-16 bg-theme-hover rounded-lg animate-pulse" />
      ) : !messages || messages.length === 0 ? (
        <p className="text-sm text-theme-muted">{t('marketplace.messages.empty')}</p>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className="rounded-lg border border-theme-border-subtle px-3 py-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-theme-primary">
                    {msg.name} <span className="font-normal text-theme-tertiary">· {msg.email}</span>
                  </p>
                  <p className="text-xs text-theme-tertiary">{msg.source} · {fmtDateTime(msg.created_at)}</p>
                </div>
                <select
                  value={msg.status}
                  onChange={(e) => setStatus.mutate({ id: msg.id, status: e.target.value })}
                  className="h-8 px-2 text-xs bg-transparent border border-theme-border rounded-lg text-theme-primary"
                >
                  {MESSAGE_STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`marketplace.messages.status.${s}`)}</option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 text-xs text-theme-secondary line-clamp-2">{msg.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
