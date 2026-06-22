// MEGGA CRM — Refonte « Aujourd'hui » · PAGE COCKPIT (port fidèle)
// ----------------------------------------------------------------------------
// Port 1:1 de `today-proto-aujourdhui.jsx`. Colonne focus (FocusColumn) +
// rangée « Ensuite » + bento 2×2 (Agenda · Relances IA · Pipeline · Objectif).
// Contenu plafonné (flex 0 1 760px) et centré verticalement (voulu : sur grand
// écran le cockpit ne s'étire pas).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TK, type TkToneName } from './tk'
import { RXIcon, Tile, TileHead, MoreLink, Orbs } from './kit'
import { DATA, type EnsuiteItemData } from './data'
import { selectFocusQueue, type FocusItem } from './focusQueue'
import { useFocusQueue } from './useFocusQueue'
import { FocusColumn } from './FocusColumn'
import { AgendaTile } from './AgendaTile'
import { RelancesTile } from './RelancesTile'
import { PipelineTile } from './PipelineTile'
import { ObjectifTile } from './ObjectifTile'
import { FocusMode } from './FocusMode'
import { RelanceSession } from './RelanceSession'
import { useTodayNav } from './TodayNavContext'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { useAuth } from '@/hooks/useAuth'
import { formatTodayHeader } from '@/lib/utils'

// ─── « Ensuite » — file d'attente compacte ──────────────────────────────
// `e.tag` reste un CODE stable (clé de tonalité + de libellé). La tonalité et le
// libellé affiché sont résolus via map ; le libellé est traduit au rendu.
const ENSUITE_TONE: Record<string, TkToneName> = { Mandat: 'info', Vendeur: 'ok', KYC: 'warn', Compromis: 'ok', Offre: 'warn', Visite: 'info', Match: 'info', Relance: 'neutral' }
const TAG_LABEL_KEY: Record<string, string> = {
  Offre: 'today.cockpit.tags.offer',
  Mandat: 'today.cockpit.tags.mandate',
  Vendeur: 'today.cockpit.tags.seller',
  KYC: 'today.cockpit.tags.kyc',
  Relance: 'today.cockpit.tags.relance',
  Match: 'today.cockpit.tags.match',
  Compromis: 'today.cockpit.tags.compromis',
  Visite: 'today.cockpit.tags.visit',
}

function EnsuiteItem({ e }: { e: EnsuiteItemData }) {
  const { t } = useTranslation('dashboard')
  const p = TK[ENSUITE_TONE[e.tag] || 'neutral'] || TK.neutral
  const name = (e.label.split('—').pop() || e.label).trim()
  const tagLabel = TAG_LABEL_KEY[e.tag] ? t(TAG_LABEL_KEY[e.tag]) : e.tag
  const [h, setH] = useState(false)
  return (
    <button
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', flexDirection: 'column', gap: 7, padding: '9px 11px', borderRadius: 14,
        background: h ? TK.cardHi : TK.card,
        border: `1px solid ${h ? TK.borderHi : TK.cardBorder}`,
        transform: h ? 'translateY(-1px)' : 'none',
        boxShadow: h ? TK.shadow : 'none',
        transition: 'transform .18s ease, background .18s ease, border-color .18s ease, box-shadow .18s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 700, color: TK.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        <span style={{ flexShrink: 0, opacity: h ? 1 : 0, transform: h ? 'translateX(0)' : 'translateX(-3px)', transition: 'opacity .18s ease, transform .18s ease' }}>
          <RXIcon name="arrow" size={13} sw={2} color={TK.sub} />
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, flexShrink: 0,
          background: p.bg, color: p.fg, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>{tagLabel}</span>
        <span style={{ fontSize: 10.5, color: TK.sub, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{e.time}</span>
      </div>
    </button>
  )
}

// Dérive la rangée « Ensuite » des priorités qui suivent la première (la file
// Focus sans son sommet). La valeur produite est un CODE de tag (stable, clé de
// `ENSUITE_TONE` + `TAG_LABEL_KEY`), jamais affiché tel quel : le libellé est
// traduit au rendu dans `EnsuiteItem`.
const ENSUITE_TAG: Record<string, string> = { OFFRE: 'Offre', MANDAT: 'Mandat', VENDEUR: 'Vendeur', KYC: 'KYC', RELANCE: 'Relance', MATCH: 'Match' }
// « Ensuite » = aperçu des items du tier « next » (le tier « now » est en tête
// de la colonne Focus, le tier « rest » reste masqué).
function deriveEnsuite(items: FocusItem[]): EnsuiteItemData[] {
  return items.filter((it) => it.tier === 'next').slice(0, 3).map((it) => ({
    initials: it.initials, av: it.av, label: it.contact, time: it.time, tag: ENSUITE_TAG[it.category] || 'Relance',
  }))
}

function EnsuiteRow({ items }: { items: EnsuiteItemData[] }) {
  const { t } = useTranslation('dashboard')
  if (items.length === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 9 }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: TK.sub, flexShrink: 0 }}>{t('today.cockpit.next')}</span>
      <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
        {items.map((e, i) => (
          <EnsuiteItem key={i} e={e} />
        ))}
      </div>
    </div>
  )
}

// ─── Pilule « Mode Focus » (en-tête) ────────────────────────────────────
function FocusPill({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation('dashboard')
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 11, height: 48, padding: '0 22px',
        borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', color: TK.ink,
        background: h ? TK.cardHi : TK.card, border: `1px solid ${h ? TK.borderHi : TK.border}`,
        boxShadow: h ? TK.shadow : 'none', transform: h ? 'translateY(-1px)' : 'none',
        transition: 'background .2s, border-color .2s, transform .2s, box-shadow .2s',
      }}>
      <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{t('today.cockpit.focusMode')}</span>
    </button>
  )
}

// ─── PAGE AUJOURD'HUI ───────────────────────────────────────────────────
export function PageAujourdhui({ demo = false }: { demo?: boolean } = {}) {
  const { t } = useTranslation('dashboard')
  const { navigate } = useTodayNav()
  const { profile } = useAuth()
  // En-tête réel : prénom de l'agent connecté + date du jour (FR), au lieu du
  // « Gregory / Dimanche 14 juin » figé du seed démo (cassait la crédibilité).
  const headerFirstName = profile?.full_name?.trim().split(/\s+/)[0] ?? ''
  const headerGreeting = headerFirstName
    ? t('today.cockpit.greeting', { name: headerFirstName })
    : t('today.cockpit.greetingNoName')
  const headerDate = formatTodayHeader()
  const [focusMode, setFocusMode] = useState(false)
  const [relanceOpen, setRelanceOpen] = useState(false)

  // Total pipeline d'en-tête — vrai cumul des deals actifs (hors 'lost'),
  // fallback démo si aucune transaction. (usePipelineSugar dédupe avec la tuile.)
  const { deals, isLoading } = usePipelineSugar()
  // Total réel (CHF 0.0M honnête si aucun deal) ; le seed démo ne sert que derrière `demo`.
  const pipelineTotal = demo
    ? DATA.pipelineTotal
    : isLoading
      ? '—'
      : `CHF ${(deals.filter((d) => d.stage !== 'lost').reduce((s, d) => s + (d.value || 0), 0) / 1e6).toFixed(1)}M`

  // File de priorités réelle (matches forts + reminders + deals), scorée et
  // tierisée, partagée colonne Focus / Mode Focus / rangée Ensuite. Empty-state
  // HONNÊTE en prod : pas de seed fictif quand l'agent n'a rien (le seed démo
  // n'est servi que derrière le flag `demo`).
  const { items: focusItems, isLive: focusLive, isLoading: focusLoading, completeItem, snoozeItem } = useFocusQueue()
  const baseQueue: FocusItem[] = selectFocusQueue({ live: focusLive, items: focusItems, isDemo: demo })
  const ensuite: EnsuiteItemData[] = focusLive ? deriveEnsuite(focusItems) : (demo ? DATA.ensuite : [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: TK.bgGrad,
      fontFamily: 'Manrope, system-ui, sans-serif', color: TK.ink, padding: '34px 28px 34px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Orbs />
      {/* Contenu plafonné + centré */}
      <div style={{ position: 'relative', zIndex: 1, flex: '0 1 760px', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {/* EN-TÊTE pleine largeur — aligne les deux colonnes en dessous */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: TK.sub, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{headerDate}</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, letterSpacing: -0.8, color: TK.ink, lineHeight: 1.1 }}>{headerGreeting}</h1>
          </div>
          <FocusPill onClick={() => setFocusMode(true)} />
        </div>

        <div style={{ flex: 1, display: 'flex', gap: 14, minHeight: 0 }}>

          {/* COLONNE FOCUS — dominante */}
          <div style={{ width: '34%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <FocusColumn key={focusLive ? 'live' : 'seed'} baseQueue={baseQueue} isLoading={focusLoading && !demo} onDone={completeItem} onSnooze={snoozeItem} />
            <EnsuiteRow items={ensuite} />
          </div>

          {/* DROITE — bento 2×2 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 14, minHeight: 0 }}>
              <Tile style={{ display: 'flex', flexDirection: 'column' }}>
                <TileHead icon="cal" title={t('today.cockpit.tiles.agenda')} action={<MoreLink onClick={() => navigate('calendar')} />} />
                <AgendaTile demo={demo} />
              </Tile>
              <Tile style={{ display: 'flex', flexDirection: 'column' }}>
                <TileHead icon="bolt" title={t('today.cockpit.tiles.relances')} accent={TK.primary} />
                <RelancesTile demo={demo} onStart={() => setRelanceOpen(true)} />
              </Tile>
            </div>
            <div style={{ flex: 0.94, display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 14, minHeight: 0 }}>
              <Tile style={{ display: 'flex', flexDirection: 'column' }}>
                <TileHead icon="trend" title={t('today.cockpit.tiles.pipeline')}
                  action={<span style={{ fontSize: 13.5, fontWeight: 800, color: TK.ink, fontVariantNumeric: 'tabular-nums' }}>{pipelineTotal}</span>} />
                <PipelineTile demo={demo} />
              </Tile>
              <Tile style={{ display: 'flex', flexDirection: 'column' }}>
                <TileHead icon="target" title={t('today.cockpit.tiles.objectif')} />
                <ObjectifTile demo={demo} />
              </Tile>
            </div>
          </div>
        </div>
      </div>
      {focusMode && <FocusMode baseQueue={baseQueue} onClose={() => setFocusMode(false)} onDone={completeItem} onSnooze={snoozeItem} />}
      {relanceOpen && <RelanceSession onClose={() => setRelanceOpen(false)} />}
    </div>
  )
}
