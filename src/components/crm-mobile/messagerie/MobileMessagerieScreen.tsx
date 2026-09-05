/**
 * MEGGA CRM mobile — Messagerie, en LECTURE SEULE (maître D16).
 *
 * Ce que l'écran fait : la boîte de réception de la première boîte visible, et la
 * lecture d'un fil. Ce qu'il ne fait pas : composer, répondre, transférer,
 * classer une pièce, connecter une boîte. Ces gestes demandent une saisie longue
 * et un choix de destinataire, et ils restent sur ordinateur — **et l'écran le
 * DIT** (`mail.mobile.readOnly`) plutôt que de laisser chercher le bouton.
 *
 * ⚠ MANROPE, PAS INTER TIGHT. La frontière est une règle depuis le 15 août 2026
 * et elle est gardée dans les deux sens (`polices-domaines.spec.ts`) : Inter
 * Tight est la police de l'agent au BUREAU, Manrope celle du mobile et de tout
 * ce que voit un client. Écrire `var(--crm-font)` ici fait rougir la porte.
 *
 * ⚠ Les COULEURS, elles, viennent de `mailSurfaces` comme au bureau, et non de
 * `MT_LIGHT`/`MT_DARK` : la messagerie est une seule fonctionnalité, elle rend
 * le MÊME corps de message dans la même iframe assainie, et `MailBodyFrame` est
 * typé sur `MailSurfaces`. Deux palettes sur un écran auraient coûté plus que
 * l'écart au reste du mobile.
 *
 * ⚠ Aucun littéral de rayon, d'espacement ni de taille : `crm-mobile` est sous
 * le cliquet de grammaire, dont les DEUX compteurs (`hors` et `total`) ne
 * peuvent que descendre.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { crmPalette } from '@/components/crm/tokens'
import { useCrmDark } from '@/lib/crmDark'
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { MAIL_PER_PAGE, useMailThreads } from '@/hooks/useMailThreads'
import { useMailThread } from '@/hooks/useMailThread'
import { mailDateLabel } from '@/lib/mail/format'
import { MailBodyFrame } from '@/components/crm/messagerie/MailBodyFrame'
import { mailSurfaces } from '@/components/crm/messagerie/mailTokens'
import { MOBILE_FONT } from '@/components/crm-mobile/tokens'

export default function MobileMessagerieScreen() {
  const { t, i18n } = useTranslation('messages')
  const lang = i18n.language.slice(0, 2)
  const dark = useCrmDark()
  const sp = crmPalette(dark)
  const ms = mailSurfaces(sp, dark)

  const accounts = useMailAccounts()
  // ⚠ La PREMIÈRE boîte, sans sélecteur : sur mobile on lit, on ne pilote pas.
  // Le tri de `useMailAccounts` est stable (`created_at` croissant), donc la
  // boîte lue ne change pas d'une visite à l'autre.
  const boite = accounts.list[0] ?? null
  const [page, setPage] = useState(0)
  const [sel, setSel] = useState<string | null>(null)

  const threads = useMailThreads(boite?.id ?? null, {
    folder: 'in', labelId: null, q: '', unreadOnly: false, attOnly: false, page,
  })
  const thread = useMailThread(sel)
  const ligne = threads.rows.find((r) => r.id === sel) ?? null

  const cadre = {
    minHeight: '100vh',
    background: sp.pageBg,
    color: sp.ink,
    fontFamily: MOBILE_FONT,
    padding: 'var(--crm-space-2xl)',
  } as const

  return (
    <div style={cadre}>
      <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600 }}>{t('mail.folders.in')}</div>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, marginTop: 'var(--crm-space-2xs)' }}>
        {boite?.email ?? t('mail.empty.noAccount.title')}
      </div>
      {/* La restriction est dite UNE fois, en tête, pas au moment où l'agent
          cherche un bouton qui n'existe pas. */}
      <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, marginTop: 'var(--crm-space-2xs)' }}>
        {t('mail.mobile.readOnly')}
      </div>

      {!sel ? (
        <div style={{ marginTop: 'var(--crm-space-2xl)' }}>
          {threads.rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSel(r.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                borderBottom: `1px solid ${ms.bord2}`, padding: 'var(--crm-space-lg) 0',
                color: sp.ink, fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-md)', fontWeight: r.is_read ? 500 : 600 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.from_name || r.from_email}
                </span>
                <span style={{ color: ms.txt3, fontSize: 'var(--crm-text-xs)', flexShrink: 0 }}>
                  {mailDateLabel(r.last_message_at, new Date(), lang)}
                </span>
              </div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: r.is_read ? 500 : 600 }}>
                {r.subject || t('mail.row.noSubject')}
              </div>
              <div style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.snippet}
              </div>
            </button>
          ))}

          {/* ⚠ Sans boîte la requête est DÉSACTIVÉE, donc elle reste `pending`
              pour toujours : tester `isLoading` d'abord rendait le message
              « aucune boîte » inatteignable, et l'écran restait vide et muet.
              La boîte se teste donc AVANT le chargement. */}
          {!boite ? (
            <div style={{ padding: 'var(--crm-space-7xl) 0', textAlign: 'center', color: ms.mut, fontSize: 'var(--crm-text-sm)' }}>
              {t('mail.empty.noAccount.body')}
            </div>
          ) : threads.rows.length === 0 && !threads.isLoading ? (
            <div style={{ padding: 'var(--crm-space-7xl) 0', textAlign: 'center', color: ms.mut, fontSize: 'var(--crm-text-sm)' }}>
              {t('mail.empty.noMessage')}
            </div>
          ) : null}

          {/* ⚠ Une page SUIVANTE, pas un pager complet : sur un pouce, revenir en
              arrière se fait en remontant la liste, pas en visant une flèche. */}
          {threads.total > (page + 1) * MAIL_PER_PAGE && (
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              style={{
                marginTop: 'var(--crm-space-2xl)', background: 'none', border: `1px solid ${ms.bord3}`,
                borderRadius: 'var(--crm-radius-pill)', padding: 'var(--crm-space-md) var(--crm-space-3xl)',
                color: ms.txt3, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', cursor: 'pointer',
              }}
            >
              {t('mail.pager.next')}
            </button>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 'var(--crm-space-2xl)' }}>
          <button
            type="button"
            onClick={() => setSel(null)}
            style={{ background: 'none', border: 'none', color: ms.txt3, fontFamily: 'inherit', padding: 0, fontSize: 'var(--crm-text-md)', cursor: 'pointer' }}
          >
            {t('mail.read.back')}
          </button>
          <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, marginTop: 'var(--crm-space-lg)' }}>
            {ligne?.subject || t('mail.row.noSubject')}
          </div>
          {(thread.data ?? []).map((m) => (
            <div key={m.id} style={{ marginTop: 'var(--crm-space-2xl)', paddingTop: 'var(--crm-space-lg)', borderTop: `1px solid ${ms.bord2}` }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3 }}>
                {m.direction === 'outbound' ? t('mail.read.me') : (m.from_name || m.from_email)}
                {' · '}
                {mailDateLabel(m.sent_at, new Date(), lang)}
              </div>
              <MailBodyFrame ms={ms} html={m.body_html} text={m.body_text} truncated={m.body_truncated} police={MOBILE_FONT} />
              {/* Les pièces sont NOMMÉES, pas ouvrables : les classer au dossier
                  demande de choisir un contact et un type, donc l'ordinateur. */}
              {m.mail_attachments.filter((a) => !a.is_inline).map((a) => (
                <div key={a.id} style={{ marginTop: 'var(--crm-space-md)', fontSize: 'var(--crm-text-xs)', color: ms.txt3 }}>
                  {a.filename}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
