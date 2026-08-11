/**
 * Écran « Parcours » (mobile, P9) : UI + données des dossiers actifs, monté par
 * MobileJourneyPage.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useParcoursSugar } from '@/hooks/useParcoursSugar'
import { PARCOURS_STAGES, type ParcoursDossier, type ParcoursTask, type StageId, type Urgency } from '@/components/crm-sugar/journey/journeyData'
import { MOBILE_FONT, type MobileTokens } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'

// Pastilles d'urgence opaques (couleurs métier, texte blanc — CLAUDE.md).
const URG: Record<Urgency, { bg: string; dot: string }> = {
  high: { bg: '#8E1F3D', dot: '#F0A1B5' },
  medium: { bg: '#A0521E', dot: '#F5C58A' },
  low: { bg: '#15643F', dot: '#7CD8A6' },
}
const FILTERS: (Urgency | 'all')[] = ['all', 'high', 'medium', 'low']
const STAGE_ORDER: StageId[] = ['mandat', 'market', 'nego', 'closing']

/** Tâche mise en avant sur la carte : la tâche pointée par le dossier, sinon la première active. */
function activeTask(d: ParcoursDossier): ParcoursTask | null {
  const col = d.columns[d.stageActive] ?? []
  return col.find((t) => t.id === d.activeTaskId) ?? col.find((t) => t.state === 'active') ?? null
}

// ─── Démo (harnais /dev/mobile) — gated, jamais de fetch/nav ──────────────
/** Colonnes de démo : une tâche active dans le stade voulu, les autres vides. */
function demoCols(stage: StageId, id: string, label: string): Record<StageId, ParcoursTask[]> {
  return { mandat: [], market: [], nego: [], closing: [], [stage]: [{ id, agentId: 't-greg', label, state: 'active' }] }
}
const DEMO: ParcoursDossier[] = [
  { id: 'p1', title: 'Villa contemporaine · Cologny', subtitle: "7 p · 240 m² · CHF 3'850'000", urgency: 'high', stageActive: 'nego', activeTaskId: 'a1', team: [], columns: demoCols('nego', 'a1', 'Offres reçues') },
  { id: 'p2', title: 'Champel · Av. de Champel 24', subtitle: "4 p · 112 m² · CHF 1'240'000", urgency: 'medium', stageActive: 'market', activeTaskId: 'a2', team: [], columns: demoCols('market', 'a2', 'Photos & vidéo') },
  { id: 'p3', title: 'Loft · Carouge', subtitle: "3 p · 95 m² · CHF 890'000", urgency: 'low', stageActive: 'mandat', activeTaskId: 'a3', team: [], columns: demoCols('mandat', 'a3', 'Mandat signé') },
]

/**
 * Parcours mobile (P9) — vue panoramique des dossiers (transactions actives),
 * read-focused. Câblé `useParcoursSugar` (RÉEL, RLS agence) : cartes dossier
 * (titre, sous-titre, urgence, stepper 4 étapes, tâche en cours), filtre par
 * urgence, tap → fiche deal. Bandeau équipe / avatars / drill détail = différés
 * (équipe RBAC `team=[]`, pas de table `parcours_tasks` → on ne fabrique rien ;
 * le détail réel est la fiche deal). `demo` alimente le harnais sans Supabase.
 */
export function MobileJourneyScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('pipeline')
  const { tk } = useMobileTokens()
  const live = !demo
  const { dossiers: liveDossiers, isLoading, isError, refetch } = useParcoursSugar()
  const dossiers = demo ? DEMO : liveDossiers

  const [filter, setFilter] = useState<Urgency | 'all'>('all')
  const filtered = useMemo(() => dossiers.filter((d) => filter === 'all' || d.urgency === filter), [dossiers, filter])

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top) + 14px) 18px 4px' }}>
        <button type="button" onClick={() => { if (live) navigate('/dashboard/more') }} aria-label={t('mobile.journey.back', { defaultValue: 'Plus' })} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 38, padding: '0 var(--crm-space-2xl) 0 var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, fontFamily: 'inherit' }}>
          <MEIcon name="chevron-left" size={18} color={tk.ink} strokeWidth={2.2} />
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 800, color: tk.ink }}>{t('mobile.journey.back', { defaultValue: 'Plus' })}</span>
        </button>
      </header>

      <div style={{ padding: 'var(--crm-space-xs) var(--crm-space-4xl) 0' }}>
        <h1 style={{ margin: '4px 0 0', fontSize: 'var(--crm-text-6xl)', fontWeight: 800, letterSpacing: -1, color: tk.ink, lineHeight: 1.05 }}>{t('journey.title')}</h1>
        <div style={{ marginTop: 7, fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: tk.inkSoft }}>{t('journey.filters.activeCount', { count: filtered.length })}</div>
      </div>

      {/* Filtre urgence */}
      <div style={{ display: 'flex', gap: 'var(--crm-space-md)', overflowX: 'auto', margin: '14px 0 0', padding: 'var(--crm-space-2xs) var(--crm-space-4xl) var(--crm-space-xs)', scrollbarWidth: 'none' }}>
        {FILTERS.map((f) => {
          const on = f === filter
          const label = f === 'all' ? t('journey.filters.allUrgencies') : t(`journey.urgency.${f}`)
          return (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{ flexShrink: 0, height: 34, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: on ? 800 : 700, letterSpacing: -0.2, background: on ? tk.accent : tk.card, color: on ? tk.accentInk : tk.inkSoft, boxShadow: on ? tk.shadow : tk.shadowSm, whiteSpace: 'nowrap' }}>
              {label}
            </button>
          )
        })}
      </div>

      <div style={{ padding: 'var(--crm-space-3xl) var(--crm-space-4xl) 0' }}>
        {live && isLoading && dossiers.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 150, borderRadius: 'var(--crm-radius-5xl)', background: tk.cardSubtle, boxShadow: tk.shadowSm }} />)}
          </div>
        ) : live && isError && dossiers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '44px 24px', background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
            <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 800, color: tk.ink }}>{t('mobile.journey.error', { defaultValue: 'Chargement impossible' })}</div>
            <button type="button" onClick={() => refetch()} style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 800, background: tk.accent, color: tk.accentInk }}>{t('mobile.journey.retry', { defaultValue: 'Réessayer' })}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
            <div style={{ width: 52, height: 52, borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
              <MEIcon name="layers" size={24} color={tk.muted} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.muted, marginTop: 14, maxWidth: 260, marginInline: 'auto', lineHeight: 1.45 }}>{t('journey.emptyState')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
            {filtered.map((d) => <Card key={d.id} d={d} t={t} tk={tk} onOpen={() => { if (live) navigate(`/dashboard/transactions/${d.id}`) }} />)}
          </div>
        )}
      </div>
    </div>
  )
}

/** Carte dossier : titre, sous-titre, pastille d'urgence, stepper 4 étapes, tâche en cours ; tap ouvre la fiche deal. */
function Card({ d, t, tk, onOpen }: { d: ParcoursDossier; t: TFunction; tk: MobileTokens; onOpen: () => void }) {
  const u = URG[d.urgency]
  const task = activeTask(d)
  const stage = PARCOURS_STAGES.find((s) => s.id === d.stageActive)
  const activeIdx = STAGE_ORDER.indexOf(d.stageActive)
  return (
    <button type="button" onClick={onOpen} style={{ textAlign: 'left', width: '100%', border: `1px solid ${tk.cardBorder}`, background: tk.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: tk.shadowSm, padding: 'var(--crm-space-3xl) var(--crm-space-3xl) var(--crm-space-2xl)', cursor: 'pointer', fontFamily: 'inherit', display: 'block' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 800, color: tk.ink, letterSpacing: -0.4, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</div>
          {d.subtitle ? <div style={{ fontSize: 'var(--crm-text-sm)', color: tk.muted, fontWeight: 600, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{d.subtitle}</div> : null}
        </div>
        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: u.bg, color: '#fff', fontSize: 'var(--crm-text-xs)', fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          <span style={{ width: 5, height: 5, borderRadius: 'var(--crm-radius-pill)', background: u.dot }} />{t(`journey.urgency.${d.urgency}`)}
        </span>
      </div>

      <Stepper activeIdx={activeIdx} tk={tk} />

      {task ? (
        <div style={{ marginTop: 15, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-lg) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-xl)', background: tk.accent, color: tk.accentInk }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: tk.mode === 'dark' ? 'rgba(3,3,3,.55)' : 'rgba(255,255,255,.6)', whiteSpace: 'nowrap' }}>{t('mobile.journey.inProgress', { defaultValue: 'En cours' })} · {stage ? stage.label : ''}</div>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 800, letterSpacing: -0.2, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.label}</div>
          </div>
          <MEIcon name="chevron-right" size={18} color={tk.accentInk} strokeWidth={2.2} />
        </div>
      ) : null}
    </button>
  )
}

/** Frise horizontale des 4 stades (mandat → market → nego → closing) avec état fait / actif / à venir. */
function Stepper({ activeIdx, tk }: { activeIdx: number; tk: MobileTokens }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 14 }}>
      {PARCOURS_STAGES.map((s, i) => {
        const status = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'todo'
        const col = s.color
        return (
          <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {i > 0 ? (
              <span style={{ position: 'absolute', top: 11, right: '50%', width: '100%', height: 2.5, borderRadius: 'var(--crm-radius-2xs)', background: i <= activeIdx ? col : 'transparent', borderTop: i <= activeIdx ? 'none' : `2px dashed ${tk.hair}` }} />
            ) : null}
            <span style={{ position: 'relative', zIndex: 1, width: 24, height: 24, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', background: status === 'done' ? col : tk.card, boxShadow: status === 'active' ? `0 0 0 2.5px ${col}, ${tk.shadowSm}` : status === 'todo' ? `inset 0 0 0 2px ${tk.hair}` : 'none' }}>
              {status === 'done' ? (
                <MEIcon name="check" size={13} color="#fff" strokeWidth={3} />
              ) : status === 'active' ? (
                <span style={{ width: 9, height: 9, borderRadius: 'var(--crm-radius-pill)', background: col }} />
              ) : null}
            </span>
            <span style={{ marginTop: 7, fontSize: 'var(--crm-text-xs)', fontWeight: status === 'active' ? 800 : 600, color: status === 'todo' ? tk.ghost : status === 'active' ? tk.ink : tk.muted, whiteSpace: 'nowrap', letterSpacing: -0.1, textAlign: 'center' }}>{s.label.split(' ').pop()}</span>
          </div>
        )
      })}
    </div>
  )
}
