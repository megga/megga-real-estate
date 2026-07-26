/**
 * Page super-admin — feature flags.
 *
 * Route : `/feature-flags` (console admin.megga.ch).
 * Chaque flag est activable globalement ou restreint à certains plans
 * (starter/pro/entreprise) et à certaines agences ; les bascules écrivent
 * directement via `useFeatureFlags`.
 *
 * Rendu en grammaire Sugar (kit `@/components/admin/kit`) : bentos séparés par
 * l'ombre, bascule globale en `AdminSwitch` (les icônes `ToggleLeft`/`ToggleRight`
 * n'avaient ni état pressé ni sémantique clavier), ciblages en pilules NEUTRES —
 * nommer un plan ou une agence désigne une valeur métier, pas la plateforme, donc
 * pas de violet ; l'état actif d'un bouton de plan prend l'accent noir Sugar. Le
 * repère « Admin MEGGA » a quitté la page : il ne vit plus qu'une fois, dans le
 * rail du shell.
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, X, Zap } from 'lucide-react'
import { useFeatureFlags, type FeatureFlag } from '@/hooks/useFeatureFlags'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import { useTranslation } from 'react-i18next'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import AdminPage from '@/components/admin/kit/AdminPage'
import { AdminCard, AdminDivider, AdminEmpty, AdminGhostBtn, AdminIc, AdminPill, AdminSkeleton, AdminSwitch } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'

// Les plans réels de l'enum agency_plan — « agency » n'existe pas (un ciblage
// posé dessus ne matchait jamais, corrigé P5).
const PLAN_IDS = ['starter', 'pro', 'entreprise'] as const

/**
 * Sélecteur d'agences ciblées par un flag.
 *
 * Le panneau est posé sur une surface OPAQUE (`sp.solidBg`) : la surface de
 * carte Sugar est translucide en sombre, et le texte de la page transparaîtrait
 * sous la liste.
 */
function AgencyTargetPicker({ flag, agencies, disabled, onUpdate }: {
  flag: FeatureFlag
  agencies: { id: string; name: string }[]
  disabled: boolean
  onUpdate: (ids: string[]) => void
}) {
  const { t } = useTranslation('admin')
  const { sp, tones } = useAdminSugar()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Échap ferme le sélecteur. L'écoute est posée sur le DOCUMENT, pas sur le voile :
  // un `<div>` sans `tabIndex` n'est jamais focusable, donc un `onKeyDown` dessus ne
  // se déclenche jamais — c'est pourquoi Échap n'a jamais fonctionné ici. Le champ de
  // recherche du menu a le focus à l'ouverture et l'évènement remonte jusqu'au
  // document, ce qui couvre le cas réel.
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return agencies
    return agencies.filter(a => a.name.toLowerCase().includes(q))
  }, [agencies, search])

  const toggleAgency = (id: string) => {
    const next = flag.enabled_agencies.includes(id)
      ? flag.enabled_agencies.filter(a => a !== id)
      : [...flag.enabled_agencies, id]
    onUpdate(next)
  }

  return (
    // `.ffx-picker` est porté par l'enveloppe et non par le bouton : `AdminGhostBtn`
    // n'expose pas de `className`. La règle de survol cible donc `> button`.
    <div className="ffx-picker" style={{ position: 'relative' }}>
      <AdminGhostBtn
        onClick={() => setOpen(!open)}
        disabled={disabled}
        style={{ height: 28, padding: '0 12px', fontSize: 11.5, gap: 6 }}
      >
        {t('admin:featureFlags.targetAgency')}
        <AdminIc
          icon={ChevronDown}
          size={13}
          color={sp.sub}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}
        />
      </AdminGhostBtn>

      {open && (
        <>
          {/* Voile « clic dehors » seulement : le clavier est géré par l'écoute
              document au-dessus (un div non focusable ne reçoit pas de keydown). */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            style={{
              position: 'absolute', left: 0, top: '100%', marginTop: 6, zIndex: 20, width: 264,
              padding: 6, borderRadius: ADMIN_RADII.card,
              background: sp.solidBg, border: `1px solid ${sp.solidBorder}`, boxShadow: sp.solidShadow,
            }}
          >
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('admin:featureFlags.searchAgency')}
              style={{
                width: '100%', height: 30, marginBottom: 4, borderRadius: ADMIN_RADII.pill, border: 0, outline: 'none',
                padding: '0 12px', background: sp.solidBgSub, color: sp.ink,
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              }}
            />
            <div className="scrollbar-hide" style={{ maxHeight: 224, overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <p style={{ margin: 0, padding: '10px 10px', fontSize: 12, color: sp.soft }}>
                  {t('admin:featureFlags.noAgencyFound')}
                </p>
              )}
              {filtered.map(a => {
                const active = flag.enabled_agencies.includes(a.id)
                return (
                  <button
                    key={a.id}
                    className="adm-row"
                    onClick={() => toggleAgency(a.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      padding: '7px 10px', borderRadius: ADMIN_RADII.row, border: 0, background: 'transparent',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      fontSize: 12, fontWeight: active ? 700 : 600, color: active ? sp.ink : sp.sub,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                    {active && <AdminIc icon={Check} size={13} color={tones.ok} />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Écran feature flags : un bento par flag, bascule globale + ciblages plan/agence. */
export default function AdminFeatureFlagsPage() {
  const { flags, isLoading, updateFlag } = useFeatureFlags()
  const { agencies } = useAdminAgencies()
  const { t } = useTranslation('admin')
  const { sp, surf, dark, tones } = useAdminSugar()

  const agencyById = useMemo(() => new Map(agencies.map(a => [a.id, a])), [agencies])

  // Survol des contrôles dont le fond de REPOS est déclaré en inline : une règle
  // d'auteur normale ne l'emporte JAMAIS sur le style inline, d'où le
  // `!important` — même mécanique que `.adm-row` (admin-console.css), que
  // portent ici les éléments au fond transparent (croix, options du menu).
  //
  // `.adm-row` ne convient PAS aux contrôles posés sur `surf.card` : sa teinte
  // sombre vaut exactement `rgba(255,255,255,0.05)`, c'est-à-dire la surface de
  // carte elle-même — le survol serait invisible en thème sombre. On la renforce
  // donc ici pour le déclencheur du sélecteur et les pilules de plan inactives.
  const hovOnCard = dark ? 'rgba(255,255,255,0.13)' : 'rgba(15,23,42,0.055)'
  const hoverCss = `
    .ffx-picker > button, .ffx-plan { transition: background-color .16s ease, opacity .16s ease; }
    .ffx-picker > button:hover:not(:disabled) { background: ${hovOnCard} !important; }
    .ffx-plan[aria-pressed='false']:hover { background: ${hovOnCard} !important; }
    .ffx-plan[aria-pressed='true']:hover { opacity: .86; }
  `

  return (
    <AdminPage title={t('admin:featureFlags.title')} subtitle={t('admin:featureFlags.subtitle')}>
      <style>{hoverCss}</style>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <AdminSkeleton key={i} height={96} radius={ADMIN_RADII.card} />
          ))}
        </div>
      ) : flags.length === 0 ? (
        <AdminCard padding={0}>
          <AdminEmpty icon={Zap} title={t('admin:featureFlags.empty.title')} />
        </AdminCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {flags.map(flag => (
            <AdminCard key={flag.id} padding="16px 18px">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
                      {flag.label}
                    </h3>
                    <code
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 11, fontWeight: 600, color: sp.soft,
                        background: surf.cardSub, padding: '3px 9px', borderRadius: ADMIN_RADII.pill,
                      }}
                    >
                      {flag.key}
                    </code>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, fontWeight: 500, color: sp.sub, lineHeight: 1.5 }}>
                    {flag.description}
                  </p>

                  {/* Rappel des plans ciblés (lecture seule) */}
                  {!flag.enabled_globally && flag.enabled_plans.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.soft }}>{t('admin:featureFlags.plans')} :</span>
                      {flag.enabled_plans.map(plan => (
                        <AdminPill key={plan} label={t(`admin:common.plan.${plan}`)} style={{ padding: '3px 10px', fontSize: 11 }} />
                      ))}
                    </div>
                  )}
                </div>

                <AdminSwitch
                  on={flag.enabled_globally}
                  label={t('admin:featureFlags.toggle')}
                  onClick={() => updateFlag.mutate({ id: flag.id, updates: { enabled_globally: !flag.enabled_globally } })}
                />
              </div>

              {/* Ciblage par plan (une bascule par plan quand le flag n'est pas global) */}
              {!flag.enabled_globally && (
                <>
                  <AdminDivider margin="14px 0 12px" />
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.soft, marginRight: 2 }}>
                      {t('admin:featureFlags.activeFor')}
                    </span>
                    {PLAN_IDS.map(plan => {
                      const active = flag.enabled_plans.includes(plan)
                      return (
                        <button
                          key={plan}
                          // L'état actif porte l'accent noir : le teinter l'effacerait,
                          // son survol passe donc par l'opacité (voir `hoverCss`).
                          className="ffx-plan"
                          onClick={() => {
                            const newPlans = active
                              ? flag.enabled_plans.filter(p => p !== plan)
                              : [...flag.enabled_plans, plan]
                            updateFlag.mutate({ id: flag.id, updates: { enabled_plans: newPlans } })
                          }}
                          aria-pressed={active}
                          style={{
                            height: 30, padding: '0 13px', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                            background: active ? sp.accent : surf.card, color: active ? sp.accentInk : sp.soft,
                            boxShadow: active ? 'none' : sp.shadowSm,
                          }}
                        >
                          {t(`admin:common.plan.${plan}`)}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Ciblage par agence (enabled_agencies — supporté par le hook depuis 20260518_001, UI ajoutée P5) */}
              {!flag.enabled_globally && (
                <>
                  <AdminDivider margin="12px 0" />
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.soft, marginRight: 2 }}>
                      {t('admin:featureFlags.agencies')}
                    </span>
                    {flag.enabled_agencies.map(id => (
                      <span
                        key={id}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          height: 28, padding: '0 5px 0 11px', borderRadius: ADMIN_RADII.pill,
                          background: tones.neutralBg, color: tones.neutralInk,
                          fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {agencyById.get(id)?.name ?? t('admin:featureFlags.unknownAgency')}
                        </span>
                        <button
                          className="adm-row"
                          onClick={() => updateFlag.mutate({ id: flag.id, updates: { enabled_agencies: flag.enabled_agencies.filter(a => a !== id) } })}
                          aria-label={t('admin:featureFlags.removeAgency')}
                          style={{
                            width: 18, height: 18, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
                            background: 'transparent', color: tones.neutralInk, cursor: 'pointer',
                            display: 'grid', placeItems: 'center',
                          }}
                        >
                          <AdminIc icon={X} size={12} color={tones.neutralInk} />
                        </button>
                      </span>
                    ))}
                    <AgencyTargetPicker
                      flag={flag}
                      agencies={agencies}
                      disabled={updateFlag.isPending}
                      onUpdate={ids => updateFlag.mutate({ id: flag.id, updates: { enabled_agencies: ids } })}
                    />
                  </div>
                </>
              )}
            </AdminCard>
          ))}
        </div>
      )}
    </AdminPage>
  )
}
