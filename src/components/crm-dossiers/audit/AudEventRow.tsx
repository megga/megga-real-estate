/**
 * AudEventRow — une ligne du journal d'audit agent : QUAND, QUOI, SUR QUOI, QUI.
 *
 * ⛔ REFAITE LE 14.09.2026 (Julien : « organisé et épuré ») sur la grammaire de la
 * cloche, dont le journal est l'historique complet : même tuile de 40 px (glyphe du type
 * sur la teinte de son domaine, logo WhatsApp pour un événement WhatsApp), même titre,
 * même sujet (`detailFor`). L'ancienne ligne répétait la date à chaque rangée — elle est
 * dans l'en-tête du jour —, et son chevron « Détails » n'ouvrait rien.
 *
 * Ce qui a quitté la rangée pour le DÉTAIL, ouvert par la ligne entière : la catégorie,
 * le type d'objet, la référence, l'IP, le code de l'action et les métadonnées. Rien n'a
 * disparu du journal ; tout n'est simplement plus sur la même ligne.
 *
 * Une RAFALE (`journal.ts`, `rafales`) se lit en une ligne « ×N » ; la déplier montre
 * chacun de ses événements, rattachés à leur tête par un filet.
 *
 * ⛔ L'ACTEUR SE LIT DANS `actor_kind` (src/lib/auditActor.ts), jamais dans la seule
 * absence d'`actor_id` : elle recouvre l'IA, le système ET l'agent dont le compte a été
 * supprimé. La TEINTE de la pastille dit humain / non-humain (`invBgSoft` / `invBg`) ; le
 * GLYPHE sépare l'IA (l'étincelle, CLAUDE.md §5) du système.
 */
import { useId, useMemo, useState, type ReactNode } from 'react'
import i18n from '@/i18n'
import { auditActeur } from '@/lib/auditActor'
import { auditActionLabel, auditEntityLabel } from '@/lib/auditActionLabel'
import { useCrmDark } from '@/lib/crmDark'
import { crmPalette } from '@/components/crm/tokens'
import TuileNotif from '@/components/crm/notifications/TuileNotif'
import { KIND_META } from '@/components/crm/notifications/data'
import { canalDe, detailFor, toKind, type Designe } from '@/hooks/useAgentNotifications'
import { dossierPalette, AUDIT_CATEGORIES, AUDIT_CAT_ICONS } from '../tokens'
import { CrmIcon } from '../icons'
import { heureDe, horodatage, libelleActeur, libelleCategorie } from './journal'
import type { AuditEvent } from '@/types/kyc'

/** Largeur de la colonne de l'heure — le détail s'aligne sur le texte, après elle et la tuile. */
const COL_HEURE = 44
const COL_TUILE = 40

interface Props {
  event: AuditEvent
  last: boolean
  /** Les événements de la rafale que la ligne résume (≥ 2) ; absent pour une ligne seule. */
  rafale?: AuditEvent[]
  /** Les collègues de l'agence (id → nom), pour nommer l'agent qui a agi. */
  noms?: ReadonlyMap<string, string>
  /** Ce que l'événement désigne — la photo et le titre du bien d'un match ou d'une diffusion. */
  designe?: Designe
  /** Sous 768 px : l'heure et l'acteur passent sous le titre au lieu de tenir leur colonne. */
  compacte?: boolean
  /** Ligne d'une rafale dépliée : un filet à la place de la tuile. */
  imbriquee?: boolean
}

/** Initiales d'un nom (« Grégory Lyonnet » → « GL ») ; « AG » quand le journal ne le nomme pas. */
function initiales(nom: string | undefined): string {
  const mots = (nom ?? '').trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return 'AG'
  return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase()
}

/** Une ligne du journal, son détail au clic, et — pour une rafale — ses événements. */
export function AudEventRow({ event, last, rafale, noms, designe, compacte = false, imbriquee = false }: Props) {
  const dark = useCrmDark()
  const sp = useMemo(() => crmPalette(dark), [dark])
  const S = useMemo(() => dossierPalette(dark), [dark])
  const [ouvert, setOuvert] = useState(false)
  const [survol, setSurvol] = useState(false)
  const idDetail = useId()

  const acteur = auditActeur(event)
  const nomActeur = libelleActeur(event, noms)
  const nomme = acteur === 'agent' && !!event.actor_id && !!noms?.get(event.actor_id)
  const kind = toKind(event.action, event.category)
  const meta = KIND_META[kind] ?? KIND_META.system
  // Le SUJET est ce que l'événement désigne (« Léa Martin », « Visite effectuée → Offre »),
  // sinon le titre du bien qu'il vise — un match n'a pas de libellé serveur, comme dans la
  // cloche. Rien d'autre : « Contact créé / Contact » répétait son propre titre.
  const sujet = detailFor(event) || designe?.titre || ''
  const sev = event.severity ?? 'info'
  const estRafale = !!rafale && rafale.length > 1

  const pastille = (
    <span
      title={nomActeur}
      style={{
        width: 22, height: 22, flexShrink: 0, display: 'grid', placeItems: 'center',
        borderRadius: 'var(--crm-radius-pill)', color: S.invInk,
        background: acteur === 'ai' || acteur === 'system' ? S.invBg : S.invBgSoft,
        fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: 0.2,
      }}
    >
      {acteur === 'ai' ? <CrmIcon name="sparkle" size={12} stroke={S.invInk} />
        : acteur === 'system' ? <CrmIcon name="server" size={12} stroke={S.invInk} />
          : initiales(nomme ? nomActeur : undefined)}
    </span>
  )
  const heure = (
    <time dateTime={event.created_at} style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
      {heureDe(event.created_at)}
    </time>
  )
  const qui = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', minWidth: 0 }}>
      {compacte && heure}
      {pastille}
      <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {nomActeur}
      </span>
    </span>
  )

  return (
    <div style={{ borderBottom: last ? 0 : `1px solid ${sp.cardBorder}` }}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idDetail : undefined}
        onClick={() => setOuvert((o) => !o)}
        onMouseEnter={() => setSurvol(true)}
        onMouseLeave={() => setSurvol(false)}
        style={{
          display: 'grid',
          gridTemplateColumns: compacte
            ? `${COL_TUILE}px minmax(0, 1fr) 14px`
            : `${COL_HEURE}px ${COL_TUILE}px minmax(0, 1fr) minmax(0, 180px) 14px`,
          columnGap: compacte ? 'var(--crm-space-lg)' : 'var(--crm-space-2xl)',
          alignItems: 'center',
          width: '100%',
          padding: compacte ? 'var(--crm-space-lg)' : 'var(--crm-space-lg) var(--crm-space-4xl)',
          border: 0,
          background: survol || ouvert ? sp.focusSurface : 'transparent',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: sp.ink,
          transition: 'background .15s ease',
        }}
      >
        {!compacte && heure}

        {imbriquee ? (
          // Le filet qui rattache l'événement à la tête de sa rafale.
          <span aria-hidden style={{ justifySelf: 'center', alignSelf: 'stretch', width: 2, borderRadius: 'var(--crm-radius-pill)', background: sp.cardBorder }} />
        ) : (
          // La photo du bien désigné quand il y en a une, comme dans la cloche — le type reste
          // lisible par la pastille du coin, cerclée du fond de la ligne. Sans photo, les
          // teintes de la cloche : en sombre le glyphe passe à l'encre, la teinte ne tenant
          // pas un trait fin sur fond noir.
          <TuileNotif
            n={{ kind, image: designe?.photo ?? null, canal: canalDe(event.action) }}
            fondTuile={`color-mix(in srgb, ${meta.dot} ${dark ? 24 : 11}%, transparent)`}
            encreGlyphe={dark ? sp.ink : meta.dot}
            anneau={survol || ouvert ? sp.focusSurface : sp.cardBg}
            encrePastille={sp.accentInk}
          />
        )}

        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', minWidth: 0 }}>
            <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {auditActionLabel(event.action)}
            </span>
            {estRafale && (
              <span
                title={i18n.t('common:audit.grouped', { count: rafale.length })}
                style={{
                  flexShrink: 0, padding: '0 var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)',
                  background: sp.cardSubBg, color: sp.sub, fontSize: 'var(--crm-text-xs)', fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums', lineHeight: 1.6,
                }}
              >×{rafale.length}</span>
            )}
            {sev !== 'info' && (
              <span style={{
                flexShrink: 0, padding: '0 var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)',
                background: sev === 'critical' ? S.errSoft : S.warnSoft,
                color: sev === 'critical' ? S.errDarker : S.warnDarker,
                fontSize: 'var(--crm-text-xs)', fontWeight: 600, lineHeight: 1.6,
              }}>
                {i18n.t(sev === 'critical' ? 'common:audit.severity.critical' : 'common:audit.severity.warning')}
              </span>
            )}
          </span>
          {sujet && (
            <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sujet}
            </span>
          )}
          {compacte && qui}
        </span>

        {!compacte && qui}

        <span aria-hidden style={{ display: 'grid', placeItems: 'center', transform: ouvert ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>
          <CrmIcon name="chevDown" size={13} stroke={sp.sub} />
        </span>
      </button>

      {ouvert && (estRafale ? (
        <div role="group" id={idDetail} aria-label={auditActionLabel(event.action)}>
          {rafale.map((e, i) => (
            <AudEventRow key={e.id} event={e} last={i === rafale.length - 1} noms={noms} compacte={compacte} imbriquee />
          ))}
        </div>
      ) : (
        <Detail id={idDetail} event={event} nomActeur={nomActeur} compacte={compacte} />
      ))}
    </div>
  )
}

/** Le détail d'une ligne : ce que la rangée ne montre pas, sous forme de fiche. */
function Detail({ id, event, nomActeur, compacte }: { id: string; event: AuditEvent; nomActeur: string; compacte: boolean }) {
  const dark = useCrmDark()
  const sp = crmPalette(dark)
  const t = (cle: string) => i18n.t(`common:audit.detail.${cle}`)
  const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 'var(--crm-text-sm)' } as const
  const meta = Object.entries(event.metadata ?? {})

  // La catégorie garde son identité — l'icône dans sa teinte. ⚠ La teinte sur l'ICÔNE
  // seulement : en sombre, le bleu `kyc` rend ~3,3:1 sur la sous-carte, assez pour un
  // glyphe (seuil 3:1), pas pour un texte. Le libellé reste à l'encre.
  const cat = event.category ? AUDIT_CATEGORIES[event.category] : undefined
  const champs: { cle: string; valeur: ReactNode; code?: boolean }[] = [
    { cle: 'when', valeur: horodatage(event.created_at) },
    {
      cle: 'category',
      valeur: cat && event.category ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)' }}>
          <CrmIcon name={AUDIT_CAT_ICONS[event.category]} size={13} stroke={cat.tone} />
          {libelleCategorie(event)}
        </span>
      ) : libelleCategorie(event),
    },
    { cle: 'entity', valeur: auditEntityLabel(event.entity_type) },
    ...(event.entity_id ? [{ cle: 'reference', valeur: event.entity_id, code: true }] : []),
    { cle: 'actor', valeur: nomActeur },
    ...(event.ip_address ? [{ cle: 'ip', valeur: event.ip_address, code: true }] : []),
    { cle: 'code', valeur: event.action, code: true },
  ]

  return (
    <div
      id={id}
      role="region"
      aria-label={i18n.t('common:audit.details')}
      style={{
        // Aligné sur le texte de la ligne : après la gouttière, l'heure et la tuile.
        // Le même souffle au-dessus qu'en dessous : collée à la ligne ouverte, la fiche
        // semblait en déborder (14.09.2026, Julien).
        margin: compacte
          ? 'var(--crm-space-lg)'
          : `var(--crm-space-lg) var(--crm-space-4xl) var(--crm-space-lg) calc(var(--crm-space-4xl) + ${COL_HEURE + COL_TUILE}px + 2 * var(--crm-space-2xl))`,
        padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
        borderRadius: 'var(--crm-radius-lg)',
        background: sp.cardSubBg,
        display: 'grid',
        gridTemplateColumns: 'max-content minmax(0, 1fr)',
        columnGap: 'var(--crm-space-4xl)',
        rowGap: 'var(--crm-space-sm)',
        fontSize: 'var(--crm-text-md)',
        lineHeight: 1.45,
      }}
    >
      {champs.map((c) => (
        <div key={c.cle} style={{ display: 'contents' }}>
          <span style={{ color: sp.sub, fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{t(c.cle)}</span>
          <span style={{ color: sp.ink, overflowWrap: 'anywhere', ...(c.code ? mono : null) }}>{c.valeur}</span>
        </div>
      ))}
      {meta.length > 0 && (
        <>
          <span style={{ color: sp.sub, fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{t('metadata')}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', minWidth: 0 }}>
            {meta.map(([k, v]) => (
              <span key={k} style={{ ...mono, color: sp.ink, overflowWrap: 'anywhere' }}>
                <span style={{ color: sp.sub }}>{k}</span> {typeof v === 'string' ? v : JSON.stringify(v)}
              </span>
            ))}
          </span>
        </>
      )}
    </div>
  )
}
