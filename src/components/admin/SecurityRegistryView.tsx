/**
 * Vue « Registre MEGGA » de l'écran Sécurité — la lecture d'`admin_log`.
 *
 * POURQUOI CE COMPOSANT EXISTE. `AdminSecurityAuditPage` lisait `activity_events`, et rien
 * d'autre : le journal des AGENCES. Le registre MEGGA — celui qui porte la chaîne
 * d'empreintes et les gestes de la console — n'avait AUCUN lecteur dans `src/`, alors que
 * sa RPC `get_admin_security_journal` existait, gardée et couverte par sept specs backend.
 * Le critère 2 du gate G2 (« UI → RPC → ligne visible dans Sécurité avec metadata ») était
 * donc bloqué au dernier maillon, côté écran, et non côté base.
 *
 * Les deux vues COEXISTENT à dessein. Elles répondent à deux questions distinctes — « qu'a
 * fait MEGGA sur une agence » et « que s'est-il passé chez les agences » — et c'est
 * précisément la frontière que tout cet écran défend. La rendre visible vaut mieux que de
 * remplacer une source par l'autre.
 *
 * ⚠ DEUX VOCABULAIRES DE SÉVÉRITÉ SE CROISENT ICI. `admin_log` écrit `crit`/`warn`/`info`,
 * `activity_events` écrit `critical`/`warning`/`info`. La migration `20260801210500` le dit
 * explicitement : « toute vue qui unit les deux sources doit traduire AU BORD, sinon un
 * événement critique s'affiche en couleur neutre sans lever d'erreur ». D'où `SEV_MAP`,
 * qui traduit une fois, ici, et réutilise les libellés existants plutôt que d'ouvrir un
 * treizième vocabulaire.
 */
import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Shield } from 'lucide-react'
import {
  useAdminSecurityJournal,
  JOURNAL_FAMILIES,
  type JournalFilter,
  type JournalSeverity,
  type JournalWindow,
} from '@/hooks/useAdminSecurityJournal'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import {
  AdminCard, AdminEmpty, AdminError, AdminIc, AdminPager, AdminPill, AdminSearchInput, AdminSkeleton,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'

const PER_PAGE = 20

/** Fenêtres admises par `admin_security_window` : toute autre valeur lève `22023`. */
const WINDOWS: JournalWindow[] = ['today', 'rolling_24h', 'month']

/** Traduction AU BORD du vocabulaire de sévérité du registre vers celui de l'écran. */
const SEV_MAP: Record<JournalSeverity, { key: 'critical' | 'warning' | 'info'; tone: AdminToneName }> = {
  crit: { key: 'critical', tone: 'err' },
  warn: { key: 'warning', tone: 'warn' },
  info: { key: 'info', tone: 'info' },
}

/** Largeurs partagées par l'en-tête et les lignes. `time` est court : la RPC ne rend que
 *  l'heure — c'est la fenêtre choisie qui porte la date. */
const COL = { time: 84, severity: 108, family: 104, action: 190, actor: 150, entity: 150 } as const

const TRUNCATE: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

/** Condense les paires en une ligne `libellé: valeur`, tronquée à 80 caractères. */
function summarizePairs(pairs: [string, string][] | null): string {
  if (!pairs || pairs.length === 0) return '—'
  const s = pairs.map(([l, v]) => `${l}: ${v}`).join(' · ')
  return s.length > 80 ? `${s.slice(0, 77)}…` : s
}

/** Journal du registre MEGGA : fenêtre, filtre unique (sévérité OU famille), recherche. */
export default function SecurityRegistryView() {
  const { t } = useTranslation('admin')
  const { sp, surf, dark } = useAdminSugar()
  const [win, setWin] = useState<JournalWindow>('today')
  const [filter, setFilter] = useState<JournalFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useAdminSecurityJournal({
    window: win, filter, search, page, perPage: PER_PAGE,
  })
  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  // Tout changement de critère ramène à la première page : la pagination est SERVEUR
  // (offset), donc rester en page 7 sur un filtre qui n'a que 2 pages rendrait du vide.
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }

  const rowHair = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'

  return (
    <>
      {/* Filtres */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Fenêtre — segment Sugar, accent noir sur l'option active */}
        <div style={{
          display: 'inline-flex', gap: 3, padding: 3, borderRadius: ADMIN_RADII.pill,
          background: surf.cardSub, border: surf.hairline,
        }}>
          {WINDOWS.map(w => {
            const on = win === w
            return (
              <button
                key={w}
                onClick={() => change(setWin)(w)}
                style={{
                  height: 30, padding: '0 14px', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 600, whiteSpace: 'nowrap',
                  background: on ? sp.accent : 'transparent', color: on ? sp.accentInk : sp.sub,
                  transition: 'background .15s ease, color .15s ease',
                }}
              >
                {t(`admin:securityAudit.window.${w}`)}
              </button>
            )
          })}
        </div>

        {/* Filtre unique : la RPC accepte indifféremment une sévérité ou une famille, les
            deux vocabulaires étant disjoints. Deux groupes pour que l'agent le voie. */}
        <div style={{ position: 'relative' }}>
          <select
            value={filter}
            onChange={e => change(setFilter)(e.target.value as JournalFilter)}
            style={{
              height: 34, padding: '0 34px 0 15px', borderRadius: ADMIN_RADII.pill, border: 0, outline: 'none',
              appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
              color: sp.ink, background: surf.card, boxShadow: sp.shadowSm,
            }}
          >
            <option value="all">{t('admin:securityAudit.filterAll')}</option>
            <optgroup label={t('admin:securityAudit.table.severity')}>
              {(Object.keys(SEV_MAP) as JournalSeverity[]).map(s => (
                <option key={s} value={s}>{t(`admin:common.severity.${SEV_MAP[s].key}`)}</option>
              ))}
            </optgroup>
            <optgroup label={t('admin:securityAudit.table.family')}>
              {JOURNAL_FAMILIES.map(f => (
                <option key={f} value={f}>{t(`admin:audit.family.${f}`)}</option>
              ))}
            </optgroup>
          </select>
          <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', display: 'grid', pointerEvents: 'none' }}>
            <AdminIc icon={ChevronDown} size={14} color={sp.sub} />
          </span>
        </div>

        <AdminSearchInput
          value={search}
          onChange={change(setSearch)}
          placeholder={t('admin:securityAudit.registry.searchPlaceholder')}
          label={t('admin:securityAudit.registry.searchPlaceholder')}
        />
      </div>

      <AdminCard padding={0} style={{ overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
          background: sp.tableHeadBg, fontSize: 11, fontWeight: 700, letterSpacing: 0.1, color: sp.sub,
        }}>
          <div style={{ width: COL.time, flexShrink: 0 }}>{t('admin:securityAudit.table.timestamp')}</div>
          <div style={{ width: COL.severity, flexShrink: 0 }}>{t('admin:securityAudit.table.severity')}</div>
          <div style={{ width: COL.family, flexShrink: 0 }}>{t('admin:securityAudit.table.family')}</div>
          <div style={{ width: COL.action, flexShrink: 0 }}>{t('admin:securityAudit.table.action')}</div>
          <div style={{ width: COL.actor, flexShrink: 0 }}>{t('admin:securityAudit.table.actor')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>{t('admin:securityAudit.table.details')}</div>
          <div style={{ width: COL.entity, flexShrink: 0, textAlign: 'right' }}>{t('admin:securityAudit.table.entity')}</div>
        </div>

        {isLoading && entries.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px' }}>
            {Array.from({ length: 8 }).map((_, i) => <AdminSkeleton key={i} height={36} />)}
          </div>
        ) : isError && entries.length === 0 ? (
          <AdminError
            message={t('admin:common.loadError')}
            onRetry={() => void refetch()}
            retryLabel={t('admin:common.retry')}
          />
        ) : entries.length === 0 ? (
          <AdminEmpty
            icon={Shield}
            title={t('admin:securityAudit.registry.empty.title')}
            hint={t('admin:securityAudit.registry.empty.subtitle')}
          />
        ) : (
          entries.map(e => {
            const sev = SEV_MAP[e.sev] ?? SEV_MAP.info
            const open = expanded === e.id
            return (
              <div key={e.id} style={{ borderTop: `1px solid ${rowHair}` }}>
                <button
                  className="adm-row"
                  onClick={() => setExpanded(open ? null : e.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
                    border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ width: COL.time, flexShrink: 0, fontSize: 11.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                    {e.ts}
                  </div>
                  <div style={{ width: COL.severity, flexShrink: 0 }}>
                    <AdminPill label={t(`admin:common.severity.${sev.key}`)} tone={sev.tone} />
                  </div>
                  <div style={{ width: COL.family, flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: sp.sub, ...TRUNCATE }}>
                    {t(`admin:audit.family.${e.fam}`)}
                  </div>
                  <div style={{ width: COL.action, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: sp.ink, ...TRUNCATE }}>
                    {e.action}
                  </div>
                  {/* `actor` vaut « Système » pour un geste machine — la base l'impose et
                      refuse tout autre libellé sans acteur. On l'affiche tel quel. */}
                  <div style={{ width: COL.actor, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: sp.ink, ...TRUNCATE }}>
                    {e.actor || '—'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: sp.sub, ...TRUNCATE }}>
                    {summarizePairs(e.meta)}
                  </div>
                  {/* ⚠ `||` et non `??` : mesuré sur la production, `entity` vaut la chaîne
                      VIDE (jamais null) quand aucune de ses trois parties n'est renseignée
                      — `admin_security_entity` assemble par `array_to_string`. Un `??`
                      laisserait la colonne blanche au lieu du tiret. */}
                  <div style={{ width: COL.entity, flexShrink: 0, textAlign: 'right', fontSize: 11.5, color: sp.sub, ...TRUNCATE }}>
                    {e.entity || '—'}
                  </div>
                </button>

                {/* Détail : les PAIRES, dans leur ordre — pas un JSON brut. C'est la forme
                    lisible que le registre produit exprès, et l'ordre y porte du sens. */}
                {open && (
                  <div style={{ padding: '12px 14px', background: surf.cardSub }}>
                    {e.meta && e.meta.length > 0 ? (
                      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(120px, max-content) 1fr', gap: '6px 16px' }}>
                        {e.meta.map(([l, v], i) => (
                          <div key={`${e.id}-${i}`} style={{ display: 'contents' }}>
                            <dt style={{ fontSize: 11.5, fontWeight: 700, color: sp.ink }}>{l}</dt>
                            <dd style={{ margin: 0, fontSize: 11.5, color: sp.sub, wordBreak: 'break-word' }}>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <span style={{ fontSize: 11.5, color: sp.sub }}>{t('admin:securityAudit.registry.noMeta')}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        <AdminPager page={page} totalPages={totalPages} total={total} perPage={PER_PAGE} onPage={setPage} />
      </AdminCard>
    </>
  )
}
