// Inbox de modération admin (P4) — deux files entrantes qui n'avaient aucune
// surface de traitement :
//   * seller_leads non assignés (soumissions vendeur storefront/vitrine) →
//     assignation à une agence (policy seller_leads_super_admin_all).
//   * contact_messages (formulaire contact storefront) → triage de statut.
//
// Rendu en grammaire Sugar (kit `admin/kit`) : chaque file est un bento
// `AdminCard` séparé par l'ombre, ses lignes par un filet — plus de
// `rounded-xl border border-theme-border` ni de `border-theme-border-subtle`.
// Les listes vides passent par `AdminEmpty`, le chargement par `AdminSkeleton`.

import { useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Inbox, Mail } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { AdminCard, AdminDivider, AdminEmpty, AdminIc, AdminSkeleton } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import type { LucideIcon } from 'lucide-react'

function fmtDateTime(iso: string): string {
  try {
    return format(new Date(iso), 'dd.MM.yyyy HH:mm')
  } catch {
    return iso
  }
}

/**
 * Coque commune des deux files : en-tête à icône, filet, puis contenu.
 *
 * Les deux inboxes vivent côte à côte dans « Clients finaux » : sans coque
 * partagée, leurs en-têtes divergeaient à la première retouche.
 */
function InboxBento({ icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  const { sp } = useAdminSugar()
  return (
    <AdminCard padding={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)' }}>
        <AdminIc icon={icon} size={16} color={sp.sub} />
        <h2 style={{ margin: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>{title}</h2>
      </div>
      <AdminDivider />
      {children}
    </AdminCard>
  )
}

/** Sélecteur Sugar : surface creuse + filet INTÉRIEUR, jamais de bordure décorative. */
function useSelectStyle(): CSSProperties {
  const { sp, surf, dark } = useAdminSugar()
  return {
    height: 32, padding: '0 var(--crm-space-lg)', borderRadius: ADMIN_RADII.row, border: 0,
    background: surf.cardSub, color: sp.ink, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, outline: 'none',
    boxShadow: `0 0 0 1.5px ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)'} inset`,
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

/** File des leads vendeurs sans agence : une ligne par lead, assignation au sélecteur. */
export function SellerLeadsInbox() {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [assigning, setAssigning] = useState<string | null>(null)
  const { sp, surf } = useAdminSugar()
  const selectStyle = useSelectStyle()

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
      toast.success(t('endUsers.sellerLeads.assigned'))
      void queryClient.invalidateQueries({ queryKey: ['admin-seller-leads'] })
    },
    onError: () => toast.error(t('endUsers.sellerLeads.assignError')),
  })

  return (
    <InboxBento icon={Inbox} title={t('endUsers.sellerLeads.title')}>
      {isLoading ? (
        <div style={{ padding: 'var(--crm-space-2xl)' }}><AdminSkeleton height={64} /></div>
      ) : !leads || leads.length === 0 ? (
        <AdminEmpty icon={Inbox} title={t('endUsers.sellerLeads.empty')} />
      ) : (
        <div>
          {leads.map((lead, i) => (
            <div
              key={lead.id}
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--crm-space-xl)',
                padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderTop: i === 0 ? undefined : surf.hairline,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 700, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lead.contact_name}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                style={selectStyle}
              >
                <option value="">{t('endUsers.sellerLeads.assignTo')}</option>
                {(agencies ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </InboxBento>
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

/** File des messages du formulaire de contact : extrait du message + triage de statut. */
export function ContactMessagesInbox() {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const { sp, surf } = useAdminSugar()
  const selectStyle = useSelectStyle()

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
    onError: () => toast.error(t('endUsers.messages.statusError')),
  })

  return (
    <InboxBento icon={Mail} title={t('endUsers.messages.title')}>
      {isLoading ? (
        <div style={{ padding: 'var(--crm-space-2xl)' }}><AdminSkeleton height={64} /></div>
      ) : !messages || messages.length === 0 ? (
        <AdminEmpty icon={Mail} title={t('endUsers.messages.empty')} />
      ) : (
        <div>
          {messages.map((msg, i) => (
            <div key={msg.id} style={{ padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderTop: i === 0 ? undefined : surf.hairline }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 700, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg.name} <span style={{ fontWeight: 500, color: sp.sub }}>· {msg.email}</span>
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                    {msg.source} · {fmtDateTime(msg.created_at)}
                  </p>
                </div>
                <select
                  value={msg.status}
                  onChange={(e) => setStatus.mutate({ id: msg.id, status: e.target.value })}
                  style={selectStyle}
                >
                  {MESSAGE_STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`endUsers.messages.status.${s}`)}</option>
                  ))}
                </select>
              </div>
              <p className="line-clamp-2" style={{ margin: '6px 0 0', fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.soft, lineHeight: 1.45 }}>
                {msg.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </InboxBento>
  )
}
