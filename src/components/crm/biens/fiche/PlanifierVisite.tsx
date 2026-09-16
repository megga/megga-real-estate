/**
 * Planifier une visite DEPUIS la fiche d'un bien — un seul écran, le bien déjà choisi.
 *
 * ── POURQUOI IL REMPLACE `VisitNewPage` ICI ──────────────────────────────────
 * Depuis la fiche, « Planifier une visite » ouvrait l'ancien parcours plein écran en
 * trois étapes, dont la première redemandait… le bien (Julien, 16.09.2026). Et son
 * étape 3 promettait trois automatisations — « e-mail au visiteur », « signature
 * demandée 24 h avant » — que RIEN n'exécute : elles n'étaient écrites que dans
 * `qualification.automations`, sans lecteur. Ce formulaire ne promet que ce qui a lieu.
 *
 * ── CE QU'UN AGENT FAIT QUAND IL POSE UNE VISITE, DANS L'ORDRE DE L'ÉCRAN ────
 *   1. Qui    — d'abord les gens DÉJÀ liés au bien (acheteurs en cours, suggestions
 *               MEGGA AI), puis tout le carnet, ou un visiteur neuf créé sur place.
 *   2. Quand  — un CALENDRIER mensuel (une visite se pose souvent à une date précise, des
 *               semaines à l'avance — la bande de 14 jours du premier jet ne le permettait
 *               pas), les heures au quart d'heure, ou une heure libre ; les visites de
 *               l'agence sont MONTRÉES (un conflit se signale, il ne bloque pas).
 *   3. Où     — sur place (adresse du bien + point de rendez-vous / accès) ou en visio.
 *   4. Après  — bon de visite prêt à signer ; la visite rejoint le deal du visiteur
 *               sur ce bien s'il en a un, et le Calendrier (qui lit `visits`).
 *   5. Confirmer au client — WhatsApp ou e-mail PRÉ-REMPLIS, que l'agent envoie
 *               lui-même : aucun envoi automatique (validation humaine, CLAUDE.md §5).
 *
 * ⚠ Le point de rendez-vous est rangé dans `qualification.rendezVous` : il n'a pas de
 * colonne, et il sert d'abord au message de confirmation, où le client en a besoin.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { VxAvatar, VxPhoto } from '@/components/crm-dossiers/vitrine/vitrineKit'
import type { VxPalette } from '@/components/crm-dossiers/vitrine/vitrineTokens'
import { crmVoileAssombrissant, type CrmPalette } from '@/components/crm/tokens'
import { useContacts, useCreateContact } from '@/hooks/useContacts'
import { useCreateAgentVisit } from '@/hooks/useVisitDetail'
import { useVisits } from '@/hooks/useVisits'
import { useAuth } from '@/hooks/useAuth'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { pickAvatarBg } from '@/lib/crmAdapters'
import { buildWaMeUrl } from '@/lib/waMeUrl'
import { majusculeInitiale } from '@/lib/utils'
import type { Property } from '@/types/listing'

/** Une personne déjà liée au bien : acheteur d'un deal, ou suggestion du moteur. */
export interface VisiteurLie {
  contactId: string
  nom: string
  /** Deal de CE contact sur CE bien — la visite s'y rattache. */
  dealId?: string | null
  /** Score MEGGA AI (estimation), pour une suggestion. */
  score?: number | null
}

interface Props {
  bien: Property
  dark: boolean
  sp: CrmPalette
  vx: VxPalette
  liees: VisiteurLie[]
  onClose: () => void
  onPlanned: () => void
  onOpenVisit: (visitId: string) => void
  /** Aperçu sans session : on montre tout, on n'écrit rien. */
  demo?: boolean
}

interface Visiteur {
  id: string | null
  prenom: string
  nom: string
  phone: string | null
  email: string | null
}

const DUREES = [30, 45, 60, 90]
/** Heures proposées : 7 h → 20 h 45, au quart d'heure. Une autre se saisit à la main. */
const HEURES = Array.from({ length: 56 }, (_, i) => `${String(7 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const debutDe = (jour: string, heure: string) => new Date(`${jour}T${heure}:00`)

// ─── Atomes ────────────────────────────────────────────────────────────────
function Section({ n, titre, children, droite, vx }: { n: number; titre: string; children: ReactNode; droite?: ReactNode; vx: VxPalette }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', minHeight: 28 }}>
        <span aria-hidden style={{ width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)', background: vx.cardSub, color: vx.inkSoft, display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 600, flexShrink: 0 }}>{n}</span>
        <h3 style={{ margin: 0, flex: 1, fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: vx.ink }}>{titre}</h3>
        {droite}
      </div>
      {children}
    </section>
  )
}

function Puce({ on, onClick, children, disabled, title, vx, style }: {
  on?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; title?: string; vx: VxPalette; style?: CSSProperties
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-pressed={on} className={on ? undefined : 'pv-puce'} style={{
      position: 'relative', height: 36, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: 0,
      fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
      background: on ? vx.black : vx.cardSub, color: on ? vx.onAccent : disabled ? vx.ghost : vx.inkSoft,
      cursor: disabled ? 'not-allowed' : 'pointer', ...style,
    }}>{children}</button>
  )
}

function Champ({ value, onChange, placeholder, icon, type = 'text', autoFocus, label, vx }: {
  value: string; onChange: (v: string) => void; placeholder?: string; icon?: MEIconName; type?: string; autoFocus?: boolean; label: string; vx: VxPalette
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', background: vx.cardSub, color: vx.muted, minWidth: 0 }}>
      {icon && <MEIcon name={icon} size={15} />}
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        aria-label={label} autoFocus={autoFocus} autoComplete="off" className="pv-input"
        style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent', color: vx.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, padding: 0 }}
      />
    </label>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default function PlanifierVisite({ bien, dark, sp, vx, liees, onClose, onPlanned, onOpenVisit, demo }: Props) {
  const { t, i18n } = useTranslation('listings')
  const locale = `${(i18n.language || 'fr').slice(0, 2)}-CH`
  const { profile } = useAuth()
  const { contacts } = useContacts()
  const { visits: visitesAgence } = useVisits()
  const creerContact = useCreateContact()
  const { mutateAsync: creerVisite } = useCreateAgentVisit()
  const piege = useFocusTrap(true, onClose)

  // ── Qui ──
  const [visiteur, setVisiteur] = useState<Visiteur | null>(null)
  const [recherche, setRecherche] = useState('')
  const [nouveau, setNouveau] = useState<{ prenom: string; nom: string; phone: string; email: string } | null>(null)
  const [accompagnants, setAccompagnants] = useState('')
  // ── Quand ── (horloge figée à l'ouverture : les créneaux passés ne bougent pas en cours de saisie)
  const [maintenant] = useState(() => new Date())
  const aujourdhui = useMemo(() => { const d = new Date(maintenant); d.setHours(0, 0, 0, 0); return d }, [maintenant])
  // Demain par défaut : une visite se pose rarement pour l'heure qui vient.
  const [jour, setJour] = useState(() => { const d = new Date(maintenant); d.setDate(d.getDate() + 1); return iso(d) })
  const [mois, setMois] = useState(() => { const d = new Date(maintenant); d.setDate(d.getDate() + 1); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const listeHeuresRef = useRef<HTMLDivElement>(null)
  const [heure, setHeure] = useState<string | null>(null)
  const [duree, setDuree] = useState(45)
  // ── Où ──
  const [mode, setMode] = useState<'sur_place' | 'video'>('sur_place')
  const [rendezVous, setRendezVous] = useState('')
  const [lienVisio, setLienVisio] = useState('')
  // ── Après ──
  const [bon, setBon] = useState(true)
  // ── Envoi ──
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [planifiee, setPlanifiee] = useState<{ id: string | null } | null>(null)

  const isRent = bien.transaction_type === 'rent'
  const adresse = [bien.address, [bien.postal_code, bien.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const lieeDe = (id: string | null) => (id ? liees.find((l) => l.contactId === id) ?? null : null)

  // Le carnet, sans les vendeurs et bailleurs : on ne fait pas visiter un bien à qui le vend.
  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    if (!q) return []
    return (contacts ?? [])
      .filter((c) => c.type !== 'seller' && c.type !== 'landlord')
      .filter((c) => `${c.first_name ?? ''} ${c.last_name ?? ''} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(q))
      .slice(0, 6)
  }, [contacts, recherche])

  const choisirContact = (id: string) => {
    const c = (contacts ?? []).find((x) => x.id === id)
    const l = lieeDe(id)
    const [prenom, ...reste] = (l?.nom ?? '').split(' ')
    setVisiteur({
      id,
      prenom: c?.first_name ?? prenom ?? '',
      nom: c?.last_name ?? reste.join(' '),
      phone: c?.phone ?? null,
      email: c?.email ?? null,
    })
    setRecherche(''); setNouveau(null)
  }

  // ── Créneaux : ce que l'agence a déjà ce jour-là ──
  const pris = useMemo(() => visitesAgence.filter((v) => iso(v.start) === jour), [visitesAgence, jour])
  const conflitDe = (h: string, minutes: number) => {
    const a = debutDe(jour, h).getTime()
    const b = a + minutes * 60_000
    return pris.find((v) => v.start.getTime() < b && v.end.getTime() > a) ?? null
  }
  const passe = (h: string) => debutDe(jour, h).getTime() < maintenant.getTime()
  const conflit = heure ? conflitDe(heure, duree) : null
  const visitesParJour = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of visitesAgence) m.set(iso(v.start), (m.get(iso(v.start)) ?? 0) + 1)
    return m
  }, [visitesAgence])

  // ── Le mois affiché : lundi en tête, cases vides avant le 1er ──
  const cases = useMemo(() => {
    const vides = (mois.getDay() + 6) % 7
    const n = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate()
    return [...Array.from({ length: vides }, () => null), ...Array.from({ length: n }, (_, i) => new Date(mois.getFullYear(), mois.getMonth(), i + 1))]
  }, [mois])
  const initialesJours = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' })), [locale])
  const moisPasse = mois.getFullYear() < aujourdhui.getFullYear() || (mois.getFullYear() === aujourdhui.getFullYear() && mois.getMonth() <= aujourdhui.getMonth())
  const changerMois = (delta: number) => setMois((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  // La colonne des heures s'ouvre sur l'heure choisie, sinon sur 9 h — pas sur 7 h, en haut.
  useEffect(() => {
    const liste = listeHeuresRef.current
    const cible = liste?.querySelector<HTMLElement>(`[data-heure="${heure ?? '09:00'}"]`)
    if (liste && cible) liste.scrollTop = cible.offsetTop - liste.clientHeight / 2 + cible.offsetHeight / 2
    // ⚠ Sur le JOUR seulement : recentrer à chaque clic d'heure ferait sauter la liste sous le doigt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jour])

  const nomVisiteur = visiteur ? `${visiteur.prenom} ${visiteur.nom}`.trim() : ''
  const debut = heure ? debutDe(jour, heure) : null
  const fin = debut ? new Date(debut.getTime() + duree * 60_000) : null
  const fmtJour = (d: Date) => majusculeInitiale(d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }))
  const fmtHeure = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  const nouveauValide = !!nouveau && nouveau.prenom.trim() !== '' && nouveau.nom.trim() !== '' && (nouveau.phone.trim() !== '' || nouveau.email.trim() !== '')
  const pret = (!!visiteur || nouveauValide) && !!heure && (mode === 'sur_place' || lienVisio.trim() !== '')

  const planifier = async () => {
    if (!pret || !debut) return
    setEnCours(true); setErreur(null)
    try {
      let v = visiteur
      if (!v && nouveau) {
        v = { id: null, prenom: nouveau.prenom.trim(), nom: nouveau.nom.trim(), phone: nouveau.phone.trim() || null, email: nouveau.email.trim() || null }
        if (!demo) {
          // L'id est posé ici : la réponse de l'insertion ne le rend pas toujours (cf. hook).
          const id = crypto.randomUUID()
          await creerContact.mutateAsync({
            id, firstName: v.prenom, lastName: v.nom, email: v.email, phone: v.phone ?? undefined,
            type: isRent ? 'tenant' : 'buyer',
          })
          v = { ...v, id }
        }
        setVisiteur(v)
      }
      if (demo || !v?.id) { setPlanifiee({ id: null }); return }
      const extra = accompagnants.split(',').map((s) => s.trim()).filter(Boolean)
      const creee = await creerVisite({
        bienId: bien.id,
        contactId: v.id,
        dealId: lieeDe(v.id)?.dealId ?? null,
        scheduledAt: debut.toISOString(),
        durationMinutes: duree,
        generateBon: bon,
        visitorNames: [`${v.prenom} ${v.nom}`.trim(), ...extra],
        visitorIds: [v.id],
        visitType: mode,
        videoLink: mode === 'video' ? lienVisio.trim() : null,
        rendezVous: mode === 'sur_place' ? rendezVous.trim() || null : null,
      })
      setPlanifiee({ id: creee?.id ?? null })
      onPlanned()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : t('fiche.visite.erreur'))
    } finally {
      setEnCours(false)
    }
  }

  // ── Message de confirmation — l'agent l'ENVOIE lui-même ──
  const message = debut && visiteur ? t(mode === 'video' ? 'fiche.visite.message.video' : 'fiche.visite.message.surPlace', {
    prenom: visiteur.prenom,
    bien: bien.title,
    // Casse NATIVE de la langue : « jeudi » en français, « Donnerstag » en allemand.
    jour: debut.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }),
    heure: fmtHeure(debut),
    adresse,
    acces: rendezVous.trim() ? ` ${t('fiche.visite.message.acces', { acces: rendezVous.trim() })}` : '',
    lien: lienVisio.trim(),
    agent: profile?.full_name ?? '',
  }).trim() : ''
  const mailto = visiteur?.email && message
    ? `mailto:${encodeURIComponent(visiteur.email)}?subject=${encodeURIComponent(t('fiche.visite.message.sujet', { bien: bien.title }))}&body=${encodeURIComponent(message)}`
    : undefined

  const carte: CSSProperties = {
    // ⚠ `min()` et non `maxWidth: 100%` : dans une grille, le 100 % se mesure sur une piste
    // dimensionnée par la carte elle-même — elle débordait à gauche dans un cadre étroit.
    width: 'min(940px, 100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    background: sp.solidBg, borderRadius: 'var(--crm-radius-6xl)', boxShadow: sp.solidShadow, animation: 'bfRise .24s cubic-bezier(.2,.8,.2,1)',
  }

  return (
    // Rendu DANS le cadre de la fiche (parent positionné) : centré sur la fiche, le voile
    // et le flou épousent le cadre — mêmes réglages que `MailModalShell` (0,4 · 6 px).
    <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0, zIndex: 130, background: crmVoileAssombrissant(0.4), backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', placeItems: 'center', padding: 'var(--crm-space-6xl)', animation: 'bfFade .18s ease-out' }}>
      <style>{`
        .pv-carte { container-type: inline-size; }
        .pv-corps { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--crm-space-6xl); }
        .pv-col { display: flex; flex-direction: column; gap: var(--crm-space-6xl); min-width: 0; }
        .pv-quand { display: grid; grid-template-columns: minmax(0, 1fr) 112px; gap: var(--crm-space-xl); }
        .pv-mois { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--crm-space-2xs); }
        .pv-heures { position: relative; overflow-y: auto; display: flex; flex-direction: column; gap: var(--crm-space-2xs); scrollbar-width: thin; }
        .pv-jourcase:not(:disabled):hover, .pv-heure:not(:disabled):hover { background: ${vx.cardSub2} !important; }
        .pv-puce:not(:disabled):hover, .pv-ligne:hover { background: ${vx.cardSub2} !important; }
        .pv-input::placeholder { color: ${vx.muted}; }
        @container (max-width: 760px) {
          .pv-corps { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
      <div ref={piege} role="dialog" aria-modal="true" aria-label={t('detail.scheduleVisit')} className="pv-carte" onMouseDown={(e) => e.stopPropagation()} style={carte}>

        {/* ── En-tête : le bien est déjà là ── */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-4xl) var(--crm-space-6xl)', borderBottom: `1px solid ${vx.hairline}`, flexShrink: 0 }}>
          <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 'var(--crm-radius-lg)', overflow: 'hidden', background: vx.cardSub, flexShrink: 0, display: 'grid', placeItems: 'center', color: vx.muted }}>
            {bien.photos?.[0] ? <VxPhoto src={bien.photos[0]} dark={dark} /> : <MEIcon name="home" size={18} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.5, color: vx.ink }}>
              {planifiee ? t('fiche.visite.planifiee') : t('detail.scheduleVisit')}
            </h2>
            <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: vx.muted, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {bien.title}{adresse ? ` · ${adresse}` : ''}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('cancel')} className="pv-puce" style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-pill)', border: 0, background: vx.cardSub, color: vx.inkSoft, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <MEIcon name="close" size={15} />
          </button>
        </header>

        {planifiee ? (
          /* ═══ Après : ce qui a été posé, et la confirmation au client ═══ */
          <div style={{ overflowY: 'auto', padding: 'var(--crm-space-6xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-6xl)' }}>
            <div style={{ display: 'flex', gap: 'var(--crm-space-xl)', alignItems: 'center' }}>
              <span style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-pill)', background: vx.okBg, color: vx.ok, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <MEIcon name="check" size={20} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: vx.ink }}>
                  {debut && fin ? `${fmtJour(debut)} · ${fmtHeure(debut)} – ${fmtHeure(fin)}` : ''}
                </div>
                <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-lg)', color: vx.inkSoft }}>
                  {nomVisiteur}{mode === 'video' ? ` · ${t('fiche.visite.ou.video')}` : adresse ? ` · ${adresse}` : ''}
                </div>
                <div style={{ marginTop: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-md)', color: vx.muted }}>
                  {demo ? t('fiche.visite.demo') : t('fiche.visite.dansCalendrier')}
                </div>
              </div>
            </div>

            <Section n={5} titre={t('fiche.visite.confirmer.titre')} vx={vx}>
              <div style={{ fontSize: 'var(--crm-text-md)', color: vx.muted, marginTop: 'calc(-1 * var(--crm-space-md))' }}>{t('fiche.visite.confirmer.aide')}</div>
              <div style={{ padding: 'var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', background: vx.cardSub, color: vx.inkSoft, fontSize: 'var(--crm-text-lg)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {message}
              </div>
              <div style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
                {visiteur?.phone ? (
                  <a href={buildWaMeUrl(visiteur.phone, message)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', background: vx.black, color: vx.onAccent, fontSize: 'var(--crm-text-md)', fontWeight: 600, textDecoration: 'none' }}>
                    <MEIcon name="message" size={14} />{t('fiche.visite.confirmer.whatsapp')}
                  </a>
                ) : null}
                {mailto ? (
                  <a href={mailto} className="pv-puce" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', background: vx.cardSub, color: vx.inkSoft, fontSize: 'var(--crm-text-md)', fontWeight: 600, textDecoration: 'none' }}>
                    <MEIcon name="mail" size={14} />{t('fiche.visite.confirmer.email')}
                  </a>
                ) : null}
                {!visiteur?.phone && !mailto && (
                  <span style={{ fontSize: 'var(--crm-text-md)', color: vx.muted }}>{t('fiche.visite.confirmer.aucunCanal')}</span>
                )}
              </div>
            </Section>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-md)' }}>
              {planifiee.id && (
                <Puce vx={vx} onClick={() => onOpenVisit(planifiee.id!)} style={{ height: 40, padding: '0 var(--crm-space-2xl)' }}>{t('fiche.visite.ouvrir')}</Puce>
              )}
              <Puce on vx={vx} onClick={onClose} style={{ height: 40, padding: '0 var(--crm-space-2xl)' }}>{t('fiche.visite.termine')}</Puce>
            </div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--crm-space-6xl)' }}>
              <div className="pv-corps">
                <div className="pv-col">
                  {/* ═══ 1. Qui ═══ */}
                  <Section n={1} titre={t('fiche.visite.qui.titre')} vx={vx}>
                    {visiteur ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: vx.cardSub }}>
                        <VxAvatar name={nomVisiteur} bg={visiteur.id ? pickAvatarBg(visiteur.id) : undefined} size={40} dark={dark} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: vx.ink }}>{nomVisiteur}</div>
                          <div style={{ fontSize: 'var(--crm-text-sm)', color: vx.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {[visiteur.phone, visiteur.email].filter(Boolean).join(' · ') || t('fiche.visite.qui.sansCoordonnees')}
                          </div>
                          {lieeDe(visiteur.id)?.dealId && (
                            <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', color: vx.ok, fontWeight: 600 }}>{t('fiche.visite.qui.rattacheDeal')}</div>
                          )}
                        </div>
                        <Puce vx={vx} onClick={() => setVisiteur(null)} style={{ height: 32, background: vx.card }}>{t('fiche.visite.qui.changer')}</Puce>
                      </div>
                    ) : nouveau ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--crm-space-sm)' }}>
                          <Champ vx={vx} autoFocus label={t('fiche.visite.qui.prenom')} placeholder={t('fiche.visite.qui.prenom')} value={nouveau.prenom} onChange={(v) => setNouveau({ ...nouveau, prenom: v })} />
                          <Champ vx={vx} label={t('fiche.visite.qui.nom')} placeholder={t('fiche.visite.qui.nom')} value={nouveau.nom} onChange={(v) => setNouveau({ ...nouveau, nom: v })} />
                        </div>
                        <Champ vx={vx} icon="phone" type="tel" label={t('fiche.visite.qui.telephone')} placeholder={t('fiche.visite.qui.telephone')} value={nouveau.phone} onChange={(v) => setNouveau({ ...nouveau, phone: v })} />
                        <Champ vx={vx} icon="mail" type="email" label={t('fiche.visite.qui.email')} placeholder={t('fiche.visite.qui.email')} value={nouveau.email} onChange={(v) => setNouveau({ ...nouveau, email: v })} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
                          <span style={{ flex: 1, fontSize: 'var(--crm-text-sm)', color: vx.muted }}>{t('fiche.visite.qui.nouveauAide')}</span>
                          <Puce vx={vx} onClick={() => setNouveau(null)} style={{ height: 32 }}>{t('cancel')}</Puce>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
                        {liees.length > 0 && !recherche && (
                          <>
                            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: vx.muted }}>{t('fiche.visite.qui.surCeBien')}</div>
                            {liees.slice(0, 4).map((l) => (
                              <button key={l.contactId} type="button" onClick={() => choisirContact(l.contactId)} className="pv-ligne" style={ligne(vx)}>
                                <VxAvatar name={l.nom} bg={pickAvatarBg(l.contactId)} size={32} dark={dark} />
                                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: vx.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nom}</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', color: l.dealId ? vx.ok : vx.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {l.dealId ? t('fiche.visite.qui.enCours') : <><MEIcon name="sparkle" size={11} />{t('fiche.visite.qui.score', { score: l.score ?? 0 })}</>}
                                </span>
                              </button>
                            ))}
                          </>
                        )}
                        <Champ vx={vx} icon="search" label={t('fiche.visite.qui.rechercher')} placeholder={t('fiche.visite.qui.rechercher')} value={recherche} onChange={setRecherche} />
                        {resultats.map((c) => (
                          <button key={c.id} type="button" onClick={() => choisirContact(c.id)} className="pv-ligne" style={ligne(vx)}>
                            <VxAvatar name={`${c.first_name ?? ''} ${c.last_name ?? ''}`} bg={pickAvatarBg(c.id)} size={32} dark={dark} />
                            {/* Le nom seul (Julien, 16.09.2026) : téléphone et e-mail alourdissaient la liste. */}
                            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: vx.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.first_name} {c.last_name}</span>
                          </button>
                        ))}
                        {recherche.trim() !== '' && resultats.length === 0 && (
                          <div style={{ fontSize: 'var(--crm-text-md)', color: vx.muted, padding: 'var(--crm-space-xs) 0' }}>{t('fiche.visite.qui.aucun')}</div>
                        )}
                        <button type="button" onClick={() => {
                          const [prenom, ...reste] = recherche.trim().split(/\s+/)
                          setNouveau({ prenom: prenom ?? '', nom: reste.join(' '), phone: '', email: '' })
                          setRecherche('')
                        }} className="pv-ligne" style={{ ...ligne(vx), background: 'transparent', color: vx.inkSoft }}>
                          <span style={{ width: 32, height: 32, borderRadius: 'var(--crm-radius-pill)', background: vx.cardSub, display: 'grid', placeItems: 'center', flexShrink: 0 }}><MEIcon name="plus" size={14} /></span>
                          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{t('fiche.visite.qui.nouveau')}</span>
                        </button>
                      </div>
                    )}
                    {(visiteur || nouveau) && (
                      <Champ vx={vx} icon="users" label={t('fiche.visite.qui.accompagnants')} placeholder={t('fiche.visite.qui.accompagnants')} value={accompagnants} onChange={setAccompagnants} />
                    )}
                  </Section>

                  {/* ═══ 2. Où — numéroté dans l'ORDRE DE LECTURE : colonne de gauche, puis de droite, et empilé ═══ */}
                  <Section n={2} titre={t('fiche.visite.ou.titre')} vx={vx}>
                    <div style={{ display: 'flex', gap: 'var(--crm-space-xs)' }}>
                      <Puce vx={vx} on={mode === 'sur_place'} onClick={() => setMode('sur_place')}>{t('fiche.visite.ou.surPlace')}</Puce>
                      <Puce vx={vx} on={mode === 'video'} onClick={() => setMode('video')}>{t('fiche.visite.ou.video')}</Puce>
                    </div>
                    {mode === 'sur_place' ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-lg)', color: vx.ink, fontWeight: 500 }}>
                          <MEIcon name="location" size={15} color={vx.muted} />{adresse || '—'}
                        </div>
                        <Champ vx={vx} icon="key" label={t('fiche.visite.ou.rendezVous')} placeholder={t('fiche.visite.ou.rendezVousExemple')} value={rendezVous} onChange={setRendezVous} />
                      </>
                    ) : (
                      <Champ vx={vx} icon="external" type="url" label={t('fiche.visite.ou.lien')} placeholder={t('fiche.visite.ou.lienExemple')} value={lienVisio} onChange={setLienVisio} />
                    )}
                  </Section>
                </div>

                <div className="pv-col">
                  {/* ═══ 3. Quand ═══ */}
                  <Section n={3} titre={t('fiche.visite.quand.titre')} vx={vx}>
                    <div className="pv-quand">
                      {/* ── Le calendrier du mois ── */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', marginBottom: 'var(--crm-space-sm)' }}>
                          <span style={{ flex: 1, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: vx.ink }}>
                            {majusculeInitiale(mois.toLocaleDateString(locale, { month: 'long', year: 'numeric' }))}
                          </span>
                          <button type="button" onClick={() => changerMois(-1)} disabled={moisPasse} aria-label={t('fiche.visite.quand.moisPrecedent')} className="pv-jourcase" style={navMois(vx, moisPasse)}>
                            <MEIcon name="chevron-left" size={14} />
                          </button>
                          <button type="button" onClick={() => changerMois(1)} aria-label={t('fiche.visite.quand.moisSuivant')} className="pv-jourcase" style={navMois(vx, false)}>
                            <MEIcon name="chevron-right" size={14} />
                          </button>
                        </div>
                        <div className="pv-mois" aria-hidden style={{ marginBottom: 'var(--crm-space-2xs)' }}>
                          {initialesJours.map((j, i) => (
                            <span key={i} style={{ textAlign: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: vx.muted }}>{j.toUpperCase().slice(0, 1)}</span>
                          ))}
                        </div>
                        <div className="pv-mois" role="group" aria-label={t('fiche.visite.quand.jour')}>
                          {cases.map((d, i) => {
                            if (!d) return <span key={`v${i}`} />
                            const cle = iso(d)
                            const on = cle === jour
                            const passe = d.getTime() < aujourdhui.getTime()
                            const estAujourdhui = d.getTime() === aujourdhui.getTime()
                            const nb = visitesParJour.get(cle) ?? 0
                            return (
                              <button key={cle} type="button" disabled={passe} aria-pressed={on}
                                aria-label={d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                                title={nb ? t('fiche.visite.quand.dejaCeJour', { count: nb }) : undefined}
                                onClick={() => { setJour(cle); setHeure(null) }}
                                className={on ? undefined : 'pv-jourcase'} style={{
                                  position: 'relative', height: 34, border: 0, padding: 0, borderRadius: 'var(--crm-radius-md)', fontFamily: 'inherit',
                                  fontSize: 'var(--crm-text-md)', fontWeight: on || estAujourdhui ? 600 : 500, fontVariantNumeric: 'tabular-nums',
                                  cursor: passe ? 'default' : 'pointer',
                                  background: on ? vx.black : 'transparent', color: on ? vx.onAccent : passe ? vx.ghost : vx.ink,
                                  boxShadow: estAujourdhui && !on ? `inset 0 0 0 1px ${vx.ghost}` : 'none',
                                }}>
                                {d.getDate()}
                                {nb > 0 && (
                                  <span aria-hidden style={{ position: 'absolute', left: '50%', bottom: 'var(--crm-space-2xs)', width: 4, height: 4, transform: 'translateX(-50%)', borderRadius: 'var(--crm-radius-pill)', background: on ? vx.onAccent : vx.muted }} />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* ── Les heures ── */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', minHeight: 0 }}>
                        <input type="time" step={300} value={heure ?? ''} onChange={(e) => setHeure(e.target.value || null)}
                          aria-label={t('fiche.visite.quand.heurePrecise')} title={t('fiche.visite.quand.heurePrecise')}
                          style={{
                            height: 34, boxSizing: 'border-box', width: '100%', padding: '0 var(--crm-space-md)', border: 0, outline: 'none',
                            borderRadius: 'var(--crm-radius-md)', background: vx.cardSub, color: vx.ink, fontFamily: 'inherit',
                            fontSize: 'var(--crm-text-md)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', colorScheme: dark ? 'dark' : 'light',
                          }} />
                        <div ref={listeHeuresRef} className="pv-heures" role="group" aria-label={t('fiche.visite.quand.heure')} style={{ height: 250 }}>
                          {HEURES.map((h) => {
                            const occupe = conflitDe(h, 15)
                            const on = heure === h
                            const hPasse = passe(h)
                            return (
                              <button key={h} type="button" data-heure={h} disabled={hPasse} aria-pressed={on} onClick={() => setHeure(h)}
                                title={occupe ? t('fiche.visite.quand.dejaPris', { quoi: occupe.title }) : undefined}
                                className={on ? undefined : 'pv-heure'} style={{
                                  position: 'relative', flexShrink: 0, height: 32, border: 0, borderRadius: 'var(--crm-radius-md)', fontFamily: 'inherit',
                                  fontSize: 'var(--crm-text-md)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', cursor: hPasse ? 'default' : 'pointer',
                                  background: on ? vx.black : 'transparent', color: on ? vx.onAccent : hPasse ? vx.ghost : h.endsWith(':00') ? vx.ink : vx.inkSoft,
                                }}>
                                {h}
                                {occupe && !on && (
                                  <span aria-hidden style={{ position: 'absolute', top: '50%', right: 'var(--crm-space-md)', width: 5, height: 5, transform: 'translateY(-50%)', borderRadius: 'var(--crm-radius-pill)', background: vx.warn }} />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--crm-text-md)', color: vx.muted, fontWeight: 500 }}>{t('fiche.visite.quand.duree')}</span>
                      {DUREES.map((m) => (
                        <Puce key={m} vx={vx} on={duree === m} onClick={() => setDuree(m)}>{m < 60 ? t('fiche.visite.quand.minutes', { count: m }) : m === 60 ? t('fiche.visite.quand.uneHeure') : t('fiche.visite.quand.uneHeureTrente')}</Puce>
                      ))}
                    </div>

                    {pris.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', color: vx.muted }}>
                        <span style={{ fontWeight: 600 }}>{t('fiche.visite.quand.dejaCeJour', { count: pris.length })}</span>
                        {pris.slice(0, 4).map((v) => (
                          <span key={v.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtHeure(v.start)} – {fmtHeure(v.end)} · {v.title}
                          </span>
                        ))}
                      </div>
                    )}
                    {conflit && (
                      <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', alignItems: 'flex-start', padding: 'var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', background: vx.warnBg, color: vx.warn, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>
                        <MEIcon name="alert" size={14} />
                        <span>{t('fiche.visite.quand.conflit', { heure: fmtHeure(conflit.start) })}</span>
                      </div>
                    )}
                  </Section>

                  {/* ═══ 4. Préparer ═══ */}
                  <Section n={4} titre={t('fiche.visite.preparer.titre')} vx={vx}>
                    <button type="button" role="switch" aria-checked={bon} onClick={() => setBon((b) => !b)} className="pv-ligne" style={{ ...ligne(vx), alignItems: 'flex-start' }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: vx.ink }}>{t('fiche.visite.preparer.bon')}</span>
                        <span style={{ display: 'block', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', color: vx.muted, lineHeight: 1.45 }}>{t('fiche.visite.preparer.bonAide')}</span>
                      </span>
                      <span aria-hidden style={{ width: 36, height: 22, borderRadius: 'var(--crm-radius-pill)', background: bon ? vx.black : vx.ghost, position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
                        <span style={{ position: 'absolute', top: 3, left: bon ? 17 : 3, width: 16, height: 16, borderRadius: 'var(--crm-radius-pill)', background: vx.onAccent, transition: 'left .15s' }} />
                      </span>
                    </button>
                  </Section>
                </div>
              </div>
            </div>

            {/* ── Pied : le récapitulatif en une phrase, et l'action ── */}
            <footer style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-2xl) var(--crm-space-6xl)', borderTop: `1px solid ${vx.hairline}`, flexShrink: 0, flexWrap: 'wrap' }}>
              {/* Plus de récapitulatif ni d'invite (Julien, 16.09.2026) : les boutons seuls, à droite.
                  Seul un ÉCHEC d'enregistrement prend la place — il ne doit pas passer inaperçu. */}
              <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: vx.warn }}>
                {erreur}
              </div>
              <Puce vx={vx} onClick={onClose} style={{ height: 40, padding: '0 var(--crm-space-2xl)' }}>{t('cancel')}</Puce>
              <Puce vx={vx} on disabled={!pret || enCours} onClick={() => void planifier()} style={{ height: 40, padding: '0 var(--crm-space-2xl)', opacity: !pret || enCours ? 0.5 : 1 }}>
                {enCours ? t('fiche.visite.enCours') : t('fiche.visite.planifier')}
              </Puce>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

/** Flèche de mois — éteinte quand on reviendrait avant le mois courant. */
function navMois(vx: VxPalette, eteint: boolean): CSSProperties {
  return {
    width: 28, height: 28, border: 0, padding: 0, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center',
    background: 'transparent', color: eteint ? vx.ghost : vx.inkSoft, cursor: eteint ? 'default' : 'pointer',
  }
}

/** Ligne de choix (personne, interrupteur) — même gabarit partout dans le formulaire. */
function ligne(vx: VxPalette): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', width: '100%', boxSizing: 'border-box',
    padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', border: 0, textAlign: 'left',
    background: vx.cardSub, fontFamily: 'inherit', cursor: 'pointer', color: vx.ink,
  }
}
