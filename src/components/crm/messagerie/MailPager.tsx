/**
 * La pagination de la liste (README §2) : « 1 à 12 sur 48 » et deux chevrons.
 *
 * ⚠ Porté d'`AdminPager` (`admin/kit/adminKit.tsx:598-623`) en prenant `ms` en
 * prop plutôt qu'en lisant `useAdminSurfaces` : cet écran n'est pas la console.
 * La fenêtre glissante de pages numérotées n'est PAS reprise — douze lignes par
 * page et un total connu, l'agent n'a rien à viser.
 *
 * ⚠ Le total ne vient pas d'un `count: 'exact'` mais du `count(*) over ()` que
 * `mail_list_threads` rend AVEC la page (D8) : un décompte exact sur une boîte
 * pleine serait un scan complet, donc un statement timeout (CLAUDE.md §7).
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { MAIL_TRANSITION, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  /** page courante, base ZÉRO (celle du reducer et de la RPC) */
  page: number
  perPage: number
  total: number
  onPage: (p: number) => void
}

export function MailPager({ ms, page, perPage, total, onPage }: Props) {
  const { t } = useTranslation('messages')
  const from = total === 0 ? 0 : page * perPage + 1
  const to = Math.min((page + 1) * perPage, total)
  const last = Math.max(0, Math.ceil(total / perPage) - 1)

  const btn = (dir: 'prev' | 'next', disabled: boolean) => (
    <button
      type="button"
      aria-label={t(`mail.pager.${dir}`)}
      disabled={disabled}
      onClick={() => onPage(dir === 'prev' ? page - 1 : page + 1)}
      style={{
        width: 24, height: 24, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none',
        color: disabled ? ms.dim : ms.txt3, cursor: disabled ? 'default' : 'pointer', transition: MAIL_TRANSITION,
      }}
    >
      <MEIcon name={dir === 'prev' ? 'chevron-left' : 'chevron-right'} size={12} />
    </button>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', marginLeft: 'auto' }}>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, fontVariantNumeric: 'tabular-nums' }}>
        {t('mail.pager.range', { from, to, total })}
      </span>
      {btn('prev', page <= 0)}
      {btn('next', page >= last)}
    </div>
  )
}
