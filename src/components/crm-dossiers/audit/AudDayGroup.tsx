/**
 * AudDayGroup — un jour du journal d'audit : son en-tête, puis ses lignes dans une carte.
 *
 * L'en-tête est COLLANT : en descendant dans une longue journée, on sait toujours de quel
 * jour on lit les lignes. Il porte le compte du jour et, quand il y en a, ses critiques
 * et ses alertes — ce que les quatre cartes de chiffres disaient en haut de page, là où
 * ça se passe. Les rafales se regroupent ici, jour par jour (`rafales`).
 *
 * ⚠ LES PHOTOS SE LISENT PAR JOUR, À L'APPROCHE (14.09.2026, Julien : « comme dans la
 * pop-up — les photos de l'annonce ou du match »). Un match ou une diffusion montre la
 * photo du bien qu'il désigne, comme dans la cloche (`lirePhotosDesignees`, partagé).
 * Mais le journal porte des milliers de lignes, et `photos` est une colonne LOURDE
 * (CLAUDE.md §7) : chaque jour ne lit que les siennes, et seulement quand il arrive à
 * moins de 600 px de la zone visible — un jour jamais atteint ne coûte rien.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import i18n from '@/i18n'
import { ciblePhoto, ciblesPhotos, lirePhotosDesignees } from '@/hooks/useAgentNotifications'
import { useCrmDark } from '@/lib/crmDark'
import { crmPalette } from '@/components/crm/tokens'
import { dossierPalette } from '../tokens'
import { AudEventRow } from './AudEventRow'
import { nombreSuisse, rafales } from './journal'
import type { AuditEvent } from '@/types/kyc'

interface Props {
  libelle: string
  events: AuditEvent[]
  /** Les collègues de l'agence (id → nom). */
  noms?: ReadonlyMap<string, string>
  /** L'agence lue : elle entre dans la clé de cache des photos, comme partout. */
  agence?: string | null
  compacte?: boolean
}

/** Un jour lit ses photos un peu AVANT d'entrer à l'écran : elles sont là quand il y arrive. */
const AVANCE = '600px 0px'

/** Un jour du journal : en-tête collant, puis une carte de lignes. */
export function AudDayGroup({ libelle, events, noms, agence = null, compacte = false }: Props) {
  const dark = useCrmDark()
  const sp = useMemo(() => crmPalette(dark), [dark])
  const S = useMemo(() => dossierPalette(dark), [dark])
  const lignes = useMemo(() => rafales(events), [events])

  // L'approche se mesure dans la zone qui DÉFILE (`data-journal-defile`), pas dans la
  // fenêtre : la marge d'un observateur ne s'applique qu'à sa racine, et le cadre de la
  // page rogne tout ce qui déborde — sans elle, rien ne se lirait à l'avance.
  const ref = useRef<HTMLElement>(null)
  const [proche, setProche] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || proche) return
    const obs = new IntersectionObserver(([entree]) => {
      if (entree?.isIntersecting) { setProche(true); obs.disconnect() }
    }, { root: el.closest<HTMLElement>('[data-journal-defile]'), rootMargin: AVANCE })
    obs.observe(el)
    return () => obs.disconnect()
  }, [proche])
  // Seules les TÊTES de ligne portent une tuile : une rafale dépliée montre un filet.
  const cibles = useMemo(() => ciblesPhotos(lignes.map((l) => l.tete)), [lignes])
  const { data: designes } = useQuery({
    queryKey: ['audit-photos', agence, cibles.annonces, cibles.biens],
    enabled: proche && cibles.annonces.length + cibles.biens.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => lirePhotosDesignees(cibles),
  })
  const critiques = events.filter((e) => e.severity === 'critical').length
  const alertes = events.filter((e) => e.severity === 'warn').length

  const repere = (n: number, couleur: string, cle: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 'var(--crm-radius-pill)', background: couleur }} />
      {i18n.t(cle, { count: n })}
    </span>
  )

  return (
    <section ref={ref} aria-label={libelle}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 1,
        display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 'var(--crm-space-lg)', rowGap: 'var(--crm-space-2xs)',
        padding: 'var(--crm-space-lg) var(--crm-space-2xs) var(--crm-space-md)',
        background: sp.pageBg,
      }}>
        <h2 style={{ margin: 0, fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, letterSpacing: '-0.01em' }}>{libelle}</h2>
        <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
          {i18n.t('common:audit.eventCount', { count: events.length, n: nombreSuisse(events.length) })}
        </span>
        {critiques > 0 && repere(critiques, S.err, 'common:audit.dayCritical')}
        {alertes > 0 && repere(alertes, S.warn, 'common:audit.dayWarning')}
      </header>
      <div style={{
        background: sp.cardBg,
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 'var(--crm-radius-4xl)',
        boxShadow: sp.shadowSm,
        overflow: 'hidden',
      }}>
        {lignes.map((l, i) => {
          const c = ciblePhoto(l.tete)
          return (
            <AudEventRow
              key={l.tete.id}
              event={l.tete}
              rafale={l.events.length > 1 ? l.events : undefined}
              last={i === lignes.length - 1}
              noms={noms}
              designe={c ? designes?.[c.id] : undefined}
              compacte={compacte}
            />
          )
        })}
      </div>
    </section>
  )
}
