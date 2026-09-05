/**
 * La colonne centrale quand aucun fil n'est ouvert (README §2) : la barre
 * d'outils (recherche + deux pastilles + pagination) et les douze lignes de la
 * page.
 *
 * ⚠ Le dossier « Brouillons » n'est PAS une page de `mail_list_threads` : les
 * brouillons sont locaux (D7) et n'ont ni expéditeur, ni étoile, ni pièces. Ils
 * ont donc leur propre rangée, sur la MÊME grille — la colonne d'étoile reste
 * vide plutôt que d'être supprimée, sans quoi les objets ne s'aligneraient plus
 * avec ceux des autres dossiers.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { MAIL_PER_PAGE, type MailThreadRow } from '@/hooks/useMailThreads'
import type { MailLabel } from '@/hooks/useMailLabels'
import type { MailDraft } from '@/hooks/useMailDrafts'
import { MailListRow } from './MailListRow'
import { MailPager } from './MailPager'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

/** La grille partagée par les lignes de fil et les lignes de brouillon. */
const GRILLE = '26px 185px minmax(0,1fr) 16px 58px'
/** Extrait de brouillon : au-delà, la ligne est de toute façon tronquée par l'ellipse. */
const EXTRAIT_BROUILLON = 120

interface Props {
  ms: MailSurfaces
  lang: string
  q: string
  onQ: (q: string) => void
  unreadOnly: boolean
  onUnreadOnly: (v: boolean) => void
  attOnly: boolean
  onAttOnly: (v: boolean) => void
  page: number
  total: number
  onPage: (p: number) => void
  rows: MailThreadRow[]
  labels: MailLabel[]
  isLoading: boolean
  /** non nul = la requête a ÉCHOUÉ ; sans lui, un échec se lit « Aucun message ». */
  error: Error | null
  onRetry: () => void
  /** non nul en dossier « Brouillons » seulement */
  drafts: MailDraft[] | null
  onOpen: (id: string) => void
  onOpenDraft: (id: string) => void
  onStar: (row: MailThreadRow) => void
  onContext: (e: React.MouseEvent, row: MailThreadRow) => void
}

export function MailList(p: Props) {
  const { t } = useTranslation('messages')
  const { ms } = p

  /**
   * ⚠ Les brouillons sont servis EN ENTIER par leur hook (ils sont locaux, il
   * n'y a pas de page à demander au serveur), alors que le pager, lui, compte
   * en pages de `MAIL_PER_PAGE`. Sans cette découpe le pager annonçait « 1-12
   * sur 30 » au-dessus des trente lignes, et changer de page ne bougeait rien.
   */
  const pageDrafts = p.drafts ? p.drafts.slice(p.page * MAIL_PER_PAGE, (p.page + 1) * MAIL_PER_PAGE) : null

  const chip = (active: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        borderRadius: PILL, padding: 'var(--crm-space-sm) var(--crm-space-2xl)', fontSize: 'var(--crm-text-sm)',
        fontWeight: 500, border: `1px solid ${active ? ms.accent : ms.bord3}`, background: active ? ms.accent : ms.elev,
        color: active ? ms.accentInk : ms.txt3, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION,
      }}
    >
      {label}
    </button>
  )
  const labelOf = (id: string | null) => p.labels.find((l) => l.id === id) ?? null

  return (
    <>
      <div style={{ padding: 'var(--crm-space-4xl) var(--crm-space-7xl) var(--crm-space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
        <label
          style={{
            flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
            background: ms.elev, border: `1px solid ${ms.bord}`, borderRadius: PILL,
            padding: 'var(--crm-space-md) var(--crm-space-3xl)',
          }}
        >
          <MEIcon name="search" size={15} color={ms.mut} />
          <input
            value={p.q}
            onChange={(e) => p.onQ(e.target.value)}
            placeholder={t('mail.list.searchPlaceholder')}
            aria-label={t('mail.list.search')}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: ms.ink, fontSize: 'var(--crm-text-sm)', fontFamily: 'inherit' }}
          />
        </label>
        {chip(p.unreadOnly, t('mail.list.unread'), () => p.onUnreadOnly(!p.unreadOnly))}
        {chip(p.attOnly, t('mail.list.attachment'), () => p.onAttOnly(!p.attOnly))}
        <MailPager ms={ms} page={p.page} perPage={MAIL_PER_PAGE} total={p.drafts ? p.drafts.length : p.total} onPage={p.onPage} />
      </div>

      <div className="scrollbar-hide" style={{ padding: '0 var(--crm-space-2xl) var(--crm-space-3xl)', overflowY: 'auto', minHeight: 0, flex: 1 }}>
        {pageDrafts ? (
          pageDrafts.length === 0 ? (
            <MailListEmpty ms={ms} text={t('mail.empty.noMessage')} />
          ) : (
            pageDrafts.map((d) => (
              <div
                key={d.id}
                role="row"
                tabIndex={0}
                onClick={() => p.onOpenDraft(d.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') p.onOpenDraft(d.id) }}
                style={{
                  display: 'grid', gridTemplateColumns: GRILLE, gap: 'var(--crm-space-md)', alignItems: 'center',
                  padding: 'var(--crm-space-md) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)',
                  borderBottom: `1px solid ${ms.bord2}`, cursor: 'pointer', color: ms.ink, transition: MAIL_TRANSITION,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = ms.hover2 }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span />
                <span style={{ fontWeight: 500, color: ms.txt3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.to.map((a) => a.email).join(', ') || t('mail.draft.noRecipient')}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 500 }}>{d.subject || t('mail.row.noSubject')}</span>{' '}
                  <span style={{ color: ms.mut }}>— {(d.body_text ?? '').slice(0, EXTRAIT_BROUILLON)}</span>
                </span>
                <span />
                <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.txt3, textAlign: 'right' }}>{t('mail.draft.badge')}</span>
              </div>
            ))
          )
        ) : p.error ? (
          <MailListError ms={ms} onRetry={p.onRetry} />
        ) : p.isLoading ? null : p.rows.length === 0 ? (
          <MailListEmpty ms={ms} text={t('mail.empty.noMessage')} />
        ) : (
          p.rows.map((r) => (
            <MailListRow
              key={r.id}
              ms={ms}
              row={r}
              label={labelOf(r.label_id)}
              lang={p.lang}
              onOpen={() => p.onOpen(r.id)}
              onStar={() => p.onStar(r)}
              onContext={(e) => p.onContext(e, r)}
            />
          ))
        )}
      </div>
    </>
  )
}

/**
 * L'état vide de la LISTE, et non `EtatVide` : celui-ci porte une illustration et
 * un appel à l'action, ce qui est juste pour « aucune boîte » et faux ici — une
 * recherche sans résultat n'appelle aucun geste, elle attend qu'on retape.
 */
/**
 * L'échec de chargement, distinct de l'état vide — et la distinction est le
 * défaut qu'on répare : `useMailThreads` rendait `[]` sur une requête en erreur,
 * si bien qu'un timeout ou un refus RLS s'affichait « Aucun message ». L'agent
 * voyait une boîte propre à la place de son courrier, sans rien à cliquer.
 * D'où le bouton : une erreur transitoire se rejoue, elle ne se contemple pas.
 */
function MailListError({ ms, onRetry }: { ms: MailSurfaces; onRetry: () => void }) {
  const { t } = useTranslation('messages')
  return (
    <div role="alert" style={{ padding: 'var(--crm-space-7xl) var(--crm-space-4xl)', textAlign: 'center', fontSize: 'var(--crm-text-sm)', color: ms.dangerText }}>
      <div style={{ marginBottom: 'var(--crm-space-2xl)' }}>{t('mail.list.err.load')}</div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL,
          padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)',
          fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: MAIL_TRANSITION,
        }}
      >
        {t('mail.list.err.retry')}
      </button>
    </div>
  )
}

function MailListEmpty({ ms, text }: { ms: MailSurfaces; text: string }) {
  return (
    <div style={{ padding: 'var(--crm-space-7xl) var(--crm-space-4xl)', textAlign: 'center', fontSize: 'var(--crm-text-sm)', color: ms.mut }}>
      {text}
    </div>
  )
}
