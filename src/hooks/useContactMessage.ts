// Hook pour le formulaire de contact public (page /contact).
//
// 3 étapes orchestrées :
//   1. INSERT dans contact_messages (anon, autorisé par RLS si consent_privacy=true)
//   2. Email de confirmation au visiteur     (template: contact_confirmation)
//   3. Email de notification à l'admin MEGGA (template: contact_notification_admin)
//
// Les 2 emails sont en fire-and-forget : si Resend tombe, on ne fait pas
// échouer le submit côté visiteur (son message est en base, l'admin le verra
// quand même au back-office). Modèle identique à useCreateTicket.
//
// Pas de catégories complexes ni de SLA : c'est un message libre depuis la
// page marketing, pas un ticket de support produit.

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import i18n from '@/i18n'

export interface ContactMessageInput {
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
  consentPrivacy: boolean
  /** Override la langue détectée par i18n (par défaut : i18n.language ou 'fr'). */
  lang?: 'fr' | 'de' | 'en' | 'it'
  /** Origine du form pour l'analytique (par défaut : 'contact_page'). */
  source?: string
}

const ADMIN_NOTIFICATION_EMAIL = 'contact@megga.ch'

function detectLang(): 'fr' | 'de' | 'en' | 'it' {
  const code = (i18n.language || 'fr').slice(0, 2).toLowerCase()
  return (['fr', 'de', 'en', 'it'] as const).find(l => l === code) ?? 'fr'
}

export function useCreateContactMessage() {
  return useMutation({
    mutationFn: async (input: ContactMessageInput) => {
      // ── 1. INSERT (la RLS exige consent_privacy=true) ────────────
      const { data: row, error } = await supabase
        .from('contact_messages')
        .insert({
          name:            input.name.trim(),
          email:           input.email.trim(),
          phone:           input.phone?.trim() || null,
          subject:         input.subject?.trim() || null,
          message:         input.message.trim(),
          consent_privacy: input.consentPrivacy,
          lang:            input.lang ?? detectLang(),
          source:          input.source ?? 'contact_page',
        } as unknown as import('@/types/database').TablesInsert<'contact_messages'>)
        .select('id, created_at')
        .single()

      if (error) throw error

      // ── 2. Email confirmation au visiteur (fire & forget) ────────
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: input.email,
            template: 'contact_confirmation',
            data: {
              name: input.name,
              subject: input.subject || null,
              message: input.message,
            },
          },
        })
      } catch { /* non bloquant — le message est en base */ }

      // ── 3. Email notification admin (fire & forget) ──────────────
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: ADMIN_NOTIFICATION_EMAIL,
            template: 'contact_notification_admin',
            data: {
              name:    input.name,
              email:   input.email,
              phone:   input.phone || null,
              subject: input.subject || null,
              message: input.message,
              lang:    input.lang ?? detectLang(),
              dashboard_url: `${window.location.origin}/dashboard/admin/contact-messages`,
            },
          },
        })
      } catch { /* idem */ }

      return { id: row.id, createdAt: row.created_at }
    },
  })
}
