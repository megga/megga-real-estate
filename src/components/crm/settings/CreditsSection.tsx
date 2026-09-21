/**
 * Réglages › « Consommation » — les crédits du studio Labs.
 *
 * Cinq blocs, dans l'ordre où l'agent se pose les questions :
 *   1. SOLDE — combien il reste, d'où ça vient (inclus ce mois / achetés), et le geste
 *      qui compte : « Recharger ».
 *   2. CE MOIS-CI — ce qu'il a produit (images, vidéos), ce qu'il a dépensé, ce qui
 *      lui a été rendu sur des échecs. Puis WHATSAPP (21.09.2026) : les messages que
 *      MEGGA a envoyés ce mois, à l'équipe et aux clients — des volumes, pas un prix.
 *   3. RECHARGER — quatre packs, prix au crédit et remise, un clic vers Stripe.
 *   4. RECHARGE AUTOMATIQUE — un interrupteur, un seuil, un pack, la carte enregistrée.
 *   5. CE QUE COÛTE UNE PRODUCTION, puis l'HISTORIQUE — le grand livre, ligne par ligne.
 *
 * ⛔ PAS UN FRANC DE COÛT FOURNISSEUR ICI, ni de marge : l'écran ne connaît que le
 * TARIF en crédits et le PRIX des packs (`src/lib/credits.ts`). C'est la règle du
 * produit — on vend des crédits — et une garde l'impose à tout `src/`.
 *
 * ⚠ Le modèle est celui de Higgsfield (relevé le 20.09.2026) : un solde unique en
 * crédits, une dotation mensuelle qui ne se reporte pas, des recharges qui ne périment
 * pas, le prix de chaque production annoncé avant de générer. Rien d'inventé : c'est
 * ce que les agents qui viennent d'un autre studio savent déjà lire.
 *
 * ⚠ Section « Focus » (`sp`, `surf`, `dark`), comme Profil et Préférences — pas la
 * palette `SET_PALETTE` mutée des sections héritées. Séparée de « Facturation », qui
 * est l'ABONNEMENT : on n'y achète pas de crédits, on n'y lit pas ce qu'on a dépensé.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/Toast'
import { MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'
import { useCredits, useCreditRecu } from '@/hooks/useCredits'
import { useWhatsAppUsage } from '@/hooks/useWhatsAppUsage'
import {
  AUTO_TOPUP_SEUILS, CREDIT_PACKS, CREDITS_IMAGE, CREDITS_VIDEO_PAR_SECONDE, CREDITS_VOIX_OFF,
  chfParCredit, consommationDuMois, creditsPourVideo, formatChf, formatCredits, remisePack,
  type AutoTopupSeuil, type CreditLedgerEntry, type CreditPack, type CreditPackId,
} from '@/lib/credits'
import { labsOuvertAuPlan } from '@/lib/labs'
import { pfColors, type FocusSectionProps, type PfColors } from './focus/pfKitCore'
import { CreditsRecuModal } from './CreditsRecuModal'

const NUM = { fontVariantNumeric: 'tabular-nums' as const }

export function CreditsSection({ sp, surf, dark, onGoToSection }: FocusSectionProps) {
  const { t, i18n } = useTranslation('settings')
  const lang = i18n.language.slice(0, 2)
  const c: PfColors = pfColors(sp, surf, dark)
  const toast = useToast()
  const credits = useCredits()
  const whatsapp = useWhatsAppUsage()
  const [params, setParams] = useSearchParams()
  const canceled = params.get('canceled') === 'true'

  // ─── Le retour de Stripe ───────────────────────────────────────────────────
  // ⛔ L'identifiant de session est CAPTURÉ AU MONTAGE et gardé : fermer la modale
  // nettoie l'URL, et une modale qui lirait `params` disparaîtrait au milieu de sa
  // propre animation de sortie — ou, pire, se remonterait à chaque rendu.
  const [sessionId] = useState(() => params.get('session_id'))
  const [recuFerme, setRecuFerme] = useState(false)
  const recu = useCreditRecu(sessionId)

  // L'abandon se DIT en passant, pas en modale : l'agent n'a rien payé, il n'y a rien
  // à confirmer — seulement à ne pas laisser croire que le geste a abouti.
  useEffect(() => {
    if (canceled) toast.info(t('credits.canceled'))
    // Au montage seulement : le paramètre ne change plus ensuite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Referme le reçu ET retire ses paramètres, pour qu'un rechargement ne le rejoue pas. */
  const fermerRecu = () => {
    setRecuFerme(true)
    const p = new URLSearchParams(params)
    p.delete('session_id')
    p.delete('success')
    setParams(p, { replace: true })
  }

  const b = credits.balance
  const mois = useMemo(() => consommationDuMois(credits.ledger), [credits.ledger])
  const ouvert = b ? labsOuvertAuPlan(b.plan) : true
  const danger = dark ? MXC_SYSTEM.red400 : STATUT_CLAIR.errInk

  // ─── Recharge automatique : un brouillon local, enregistré à chaque changement ──
  const [auto, setAuto] = useState<{ enabled: boolean; threshold: AutoTopupSeuil; pack: CreditPackId } | null>(null)
  useEffect(() => {
    if (b) setAuto({ enabled: b.autoTopupEnabled, threshold: b.autoTopupThreshold, pack: b.autoTopupPack })
  }, [b])
  const [saved, setSaved] = useState(false)
  const regler = async (next: { enabled: boolean; threshold: AutoTopupSeuil; pack: CreditPackId }) => {
    setAuto(next)
    const r = await credits.reglerAutoRecharge.mutateAsync(next)
    if (!r.ok) {
      toast.error(r.error === 'no_card' ? t('credits.auto.noCard') : t('credits.auto.saveError'))
      if (b) setAuto({ enabled: b.autoTopupEnabled, threshold: b.autoTopupThreshold, pack: b.autoTopupPack })
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  const acheter = async (pack: CreditPack) => {
    if (credits.enBanc) { toast.info(t('credits.packs.bench')); return }
    const r = await credits.acheter.mutateAsync(pack.id)
    if (r.error) toast.error(r.error === 'upgrade_required' ? t('credits.balance.noPlan') : t('credits.packs.error'))
  }

  const meilleur = useMemo(() => [...CREDIT_PACKS].sort((a, z) => chfParCredit(a) - chfParCredit(z))[0].id, [])

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)', color: c.ink }}>
      <header>
        <h2 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 600, letterSpacing: '-0.02em', color: c.ink }}>{t('credits.title')}</h2>
        <p style={{ margin: 'var(--crm-space-sm) 0 0', fontSize: 'var(--crm-text-lg)', color: c.sub, lineHeight: 1.5, maxWidth: 640 }}>{t('credits.subtitle')}</p>
      </header>

      {/* 1 + 2 — le solde et le mois, côte à côte */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 'var(--crm-space-2xl)' }}>
        <Carte c={c} kicker={t('credits.balance.title')}>
          {credits.isError ? (
            <p style={{ margin: 0, color: danger, fontSize: 'var(--crm-text-md)' }}>{t('billing.unknownError')}</p>
          ) : !b ? (
            <Squelette c={c} />
          ) : !ouvert ? (
            <>
              <p style={{ margin: 0, fontSize: 'var(--crm-text-lg)', color: c.ink, lineHeight: 1.5 }}>{t('credits.balance.noPlan')}</p>
              <Bouton c={c} sp={sp} onClick={() => onGoToSection?.('billing')}>{t('credits.balance.goPlan')}</Bouton>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
                <span style={{ ...NUM, fontSize: 'var(--crm-text-9xl)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: c.ink }}>{formatCredits(b.total, lang)}</span>
                <span style={{ fontSize: 'var(--crm-text-lg)', color: c.sub }}>{t('labs:credits.amount', { count: b.total, n: '' }).trim()}</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', flexWrap: 'wrap', fontSize: 'var(--crm-text-md)', color: c.sub, ...NUM }}>
                <span>{t('credits.balance.included', { n: formatCredits(b.included, lang) })}</span>
                <span aria-hidden="true">·</span>
                <span>{t('credits.balance.purchased', { n: formatCredits(b.purchased, lang) })}</span>
              </div>
              {b.monthlyAllowance > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
                  <Jauge c={c} sp={sp} valeur={b.included} max={b.monthlyAllowance} />
                  <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: c.soft, lineHeight: 1.45 }}>{t('credits.balance.allowance', { n: formatCredits(b.monthlyAllowance, lang) })}</p>
                </div>
              )}
              <div>
                <Bouton c={c} sp={sp} onClick={() => document.getElementById('credits-packs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  {t('credits.balance.topup')}
                </Bouton>
              </div>
            </>
          )}
        </Carte>

        <Carte c={c} kicker={t('credits.month.title')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2xl) var(--crm-space-lg)' }}>
            <Chiffre c={c} valeur={mois.images} libelle={t('credits.month.images')} lang={lang} />
            <Chiffre c={c} valeur={mois.videos} libelle={t('credits.month.videos')} lang={lang} />
            <Chiffre c={c} valeur={mois.credits} libelle={t('credits.month.spent')} lang={lang} />
          </div>
          {mois.rendus > 0 && (
            <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: c.soft }}>{t('credits.month.refunded', { n: formatCredits(mois.rendus, lang) })}</p>
          )}
        </Carte>
      </div>

      {/* 2bis — WhatsApp. Des VOLUMES, jamais ce que Meta facture (cf. `lib/whatsappUsage`) :
          c'est le compteur sur lequel un quota par plan s'appuiera un jour, montré à
          l'agence avant d'en fixer un — un plafond qu'on découvre en l'atteignant se vit
          comme une coupure. */}
      <Carte c={c} kicker={t('credits.whatsapp.title')} sous={t('credits.whatsapp.body')}>
        {whatsapp.isError ? (
          <p style={{ margin: 0, color: danger, fontSize: 'var(--crm-text-md)' }}>{t('credits.whatsapp.error')}</p>
        ) : !whatsapp.data ? (
          <Squelette c={c} />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--crm-space-2xl) var(--crm-space-lg)' }}>
              <Chiffre c={c} valeur={whatsapp.data.agent} libelle={t('credits.whatsapp.agent')} lang={lang} />
              <Chiffre c={c} valeur={whatsapp.data.client} libelle={t('credits.whatsapp.client')} lang={lang} />
            </div>
            {/* Zéro par construction — mais dit s'il ne l'est pas : un total qui ne boucle
                pas se remarque, un chiffre avalé non. */}
            {whatsapp.data.unclassified > 0 && (
              <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: c.soft }}>{t('credits.whatsapp.unclassified', { n: formatCredits(whatsapp.data.unclassified, lang) })}</p>
            )}
          </>
        )}
      </Carte>

      {/* 3 — recharger */}
      <Carte c={c} kicker={t('credits.packs.title')} id="credits-packs" sous={t('credits.packs.body')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--crm-space-lg)' }}>
          {CREDIT_PACKS.map((pack) => {
            const remise = remisePack(pack)
            const top = pack.id === meilleur
            return (
              <div
                key={pack.id}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-2xl)',
                  borderRadius: 'var(--crm-radius-2xl)', background: c.cardSub, border: `1px solid ${top ? sp.accent : c.hair}`,
                }}
              >
                {/* ⚠ Le badge est DANS LE FLUX, et chaque carte lui réserve la même ligne :
                    posé en absolu, il chevauchait « 3 000 crédits » dès que la grille passait
                    sur deux rangées (mesuré au banc à 1280 px). Une ligne vide sur les trois
                    autres cartes coûte 22 px ; un titre illisible coûte le pack. */}
                <span style={{ height: 22, display: 'flex', alignItems: 'center' }}>
                  {top && (
                    <span style={{ padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk, fontSize: 'var(--crm-text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {t('credits.packs.best')}
                    </span>
                  )}
                </span>
                <span style={{ ...NUM, fontSize: 'var(--crm-text-4xl)', fontWeight: 600, letterSpacing: '-0.02em', color: c.ink }}>{t('credits.packs.credits', { n: formatCredits(pack.credits, lang) })}</span>
                <span style={{ ...NUM, fontSize: 'var(--crm-text-2xl)', fontWeight: 500, color: c.ink }}>{t('credits.packs.price', { chf: pack.chf })}</span>
                <span style={{ ...NUM, fontSize: 'var(--crm-text-sm)', color: c.soft, display: 'flex', gap: 'var(--crm-space-sm)', alignItems: 'center' }}>
                  {t('credits.packs.perCredit', { chf: (chfParCredit(pack) * 100).toFixed(1) })}
                  {remise > 0 && (
                    <span style={{ padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', background: c.saved.bg, color: c.saved.ink, fontWeight: 600 }}>
                      {t('credits.packs.discount', { n: remise })}
                    </span>
                  )}
                </span>
                <Bouton c={c} sp={sp} onClick={() => { void acheter(pack) }} disabled={!ouvert || credits.acheter.isPending} ghost={!top}>
                  {credits.acheter.isPending ? t('credits.packs.opening') : t('credits.packs.buy')}
                </Bouton>
              </div>
            )
          })}
        </div>
      </Carte>

      {/* 4 — recharge automatique */}
      <Carte c={c} kicker={t('credits.auto.title')} sous={t('credits.auto.body')}>
        {b && auto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', flexWrap: 'wrap' }}>
              <Interrupteur c={c} sp={sp} on={auto.enabled} onClick={() => { void regler({ ...auto, enabled: !auto.enabled }) }} disabled={!b.hasCard && !auto.enabled} />
              <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: c.ink }}>{auto.enabled ? t('credits.auto.enabled') : t('credits.auto.disabled')}</span>
              {saved && <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: c.green }}>{t('credits.auto.saved')}</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap', fontSize: 'var(--crm-text-lg)', color: c.ink }}>
              <span>{t('credits.auto.threshold')}</span>
              <Choix c={c} value={String(auto.threshold)} onChange={(v) => { void regler({ ...auto, threshold: Number(v) as AutoTopupSeuil }) }}
                options={AUTO_TOPUP_SEUILS.map((s) => ({ id: String(s), label: t('labs:credits.amount', { count: s, n: formatCredits(s, lang) }) }))} />
              <span>{t('credits.auto.pack')}</span>
              <Choix c={c} value={auto.pack} onChange={(v) => { void regler({ ...auto, pack: v as CreditPackId }) }}
                options={CREDIT_PACKS.map((p) => ({ id: p.id, label: `${t('credits.packs.credits', { n: formatCredits(p.credits, lang) })} · ${t('credits.packs.price', { chf: p.chf })}` }))} />
            </div>

            <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: b.hasCard ? c.soft : c.sub, lineHeight: 1.45 }}>
              {b.hasCard ? t('credits.auto.card', { brand: capitale(b.cardBrand ?? ''), last4: b.cardLast4 ?? '' }) : t('credits.auto.noCard')}
            </p>
            {b.autoTopupLastError && (
              <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: danger, fontWeight: 500, lineHeight: 1.45 }}>{t('credits.auto.lastError', { error: b.autoTopupLastError })}</p>
            )}
          </div>
        )}
      </Carte>

      {/* 5 — le tarif */}
      <Carte c={c} kicker={t('credits.tariff.title')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--crm-space-md) var(--crm-space-2xl)' }}>
          <Tarif c={c} libelle={t('credits.tariff.image')} n={CREDITS_IMAGE['2K']} lang={lang} t={t} />
          <Tarif c={c} libelle={t('credits.tariff.image1k')} n={CREDITS_IMAGE['1K']} lang={lang} t={t} />
          <Tarif c={c} libelle={t('credits.tariff.video720')} n={CREDITS_VIDEO_PAR_SECONDE['720p']} lang={lang} t={t} />
          <Tarif c={c} libelle={t('credits.tariff.video1080')} n={CREDITS_VIDEO_PAR_SECONDE['1080p']} lang={lang} t={t} />
          <Tarif c={c} libelle={t('credits.tariff.voiceover')} n={CREDITS_VOIX_OFF} lang={lang} t={t} />
        </div>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: c.soft }}>{t('credits.tariff.example', { n: formatCredits(creditsPourVideo('720p', 8, true), lang) })}</p>
      </Carte>

      {/* Le reçu, par-dessus tout le reste — porté dans `<body>`. */}
      {sessionId && !recuFerme && (
        <CreditsRecuModal
          c={c}
          sp={sp}
          recu={recu.recu}
          enCours={recu.enCours}
          echec={recu.echec}
          aAbandonne={recu.aAbandonne}
          onClose={fermerRecu}
          onRetry={() => {
            fermerRecu()
            document.getElementById('credits-packs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      )}

      {/* 6 — l'historique */}
      <Carte c={c} kicker={t('credits.ledger.title')}>
        {credits.ledger.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', color: c.soft }}>{credits.ledgerLoading ? '…' : t('credits.ledger.empty')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {credits.ledger.map((e) => (
              <Ligne key={e.id} c={c} e={e} lang={lang} libelle={libelleMouvement(e, t, lang)} />
            ))}
          </ul>
        )}
      </Carte>
    </div>
  )
}

/* ── Lectures ─────────────────────────────────────────────────────────────── */

function capitale(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function libelleMouvement(e: CreditLedgerEntry, t: (k: string, o?: Record<string, unknown>) => string, lang: string): string {
  const n = formatCredits(Math.abs(e.amount), lang)
  switch (e.kind) {
    case 'grant_monthly': return t('credits.ledger.kinds.grant_monthly')
    case 'purchase': return t('credits.ledger.kinds.purchase', { n })
    case 'auto_topup': return t('credits.ledger.kinds.auto_topup', { n })
    case 'refund': return t('credits.ledger.kinds.refund')
    case 'adjustment': return t('credits.ledger.kinds.adjustment')
    case 'debit': {
      if (e.metadata.kind === 'video') {
        const res = String(e.metadata.resolution ?? '')
        const s = Number(e.metadata.duration_s ?? 0)
        return t(e.metadata.voiceover ? 'credits.ledger.kinds.debit_video_vo' : 'credits.ledger.kinds.debit_video', { res, s })
      }
      return t('credits.ledger.kinds.debit_image')
    }
  }
}

/* ── Atomes ───────────────────────────────────────────────────────────────── */

function Carte(p: { c: PfColors; kicker: string; sous?: string; id?: string; children: ReactNode }) {
  return (
    <section
      id={p.id}
      style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-3xl)',
        background: p.c.card, borderRadius: 'var(--crm-radius-3xl)', boxShadow: p.c.shadow,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: p.c.soft }}>{p.kicker}</span>
        {p.sous && <span style={{ fontSize: 'var(--crm-text-md)', color: p.c.sub, lineHeight: 1.5 }}>{p.sous}</span>}
      </div>
      {p.children}
    </section>
  )
}

function Chiffre(p: { c: PfColors; valeur: number; libelle: string; lang: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
      <span style={{ ...NUM, fontSize: 'var(--crm-text-6xl)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1, color: p.c.ink }}>{formatCredits(p.valeur, p.lang)}</span>
      <span style={{ fontSize: 'var(--crm-text-sm)', color: p.c.soft }}>{p.libelle}</span>
    </div>
  )
}

function Tarif(p: { c: PfColors; libelle: string; n: number; lang: string; t: (k: string, o?: Record<string, unknown>) => string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md) 0', borderBottom: `1px solid ${p.c.hairSoft}` }}>
      <span style={{ fontSize: 'var(--crm-text-md)', color: p.c.ink }}>{p.libelle}</span>
      <span style={{ ...NUM, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: p.c.ink, whiteSpace: 'nowrap' }}>{p.t('credits.tariff.unit', { count: p.n, n: formatCredits(p.n, p.lang) })}</span>
    </div>
  )
}

function Jauge(p: { c: PfColors; sp: FocusSectionProps['sp']; valeur: number; max: number }) {
  const pct = p.max > 0 ? Math.max(0, Math.min(100, (p.valeur / p.max) * 100)) : 0
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={p.max} aria-valuenow={p.valeur} style={{ height: 6, borderRadius: 'var(--crm-radius-pill)', background: p.c.hair, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: p.sp.accent, borderRadius: 'var(--crm-radius-pill)', transition: 'width .3s ease' }} />
    </div>
  )
}

function Squelette({ c }: { c: PfColors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
      <div style={{ width: 180, height: 40, borderRadius: 'var(--crm-radius-md)', background: c.cardSub }} />
      <div style={{ width: 260, height: 14, borderRadius: 'var(--crm-radius-sm)', background: c.cardSub }} />
    </div>
  )
}

function Bouton(p: { c: PfColors; sp: FocusSectionProps['sp']; onClick: () => void; disabled?: boolean; ghost?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 40, padding: '0 var(--crm-space-4xl)',
        border: p.ghost ? `1px solid ${p.c.hair}` : 0, borderRadius: 'var(--crm-radius-pill)',
        background: p.ghost ? 'transparent' : p.sp.accent, color: p.ghost ? p.c.ink : p.sp.accentInk,
        fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: p.disabled ? 'not-allowed' : 'pointer',
        opacity: p.disabled ? 0.5 : 1, transition: 'background .12s, opacity .12s',
      }}
    >
      {p.children}
    </button>
  )
}

function Interrupteur(p: { c: PfColors; sp: FocusSectionProps['sp']; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={p.on}
      onClick={p.onClick}
      disabled={p.disabled}
      style={{
        width: 44, height: 26, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: p.disabled ? 'not-allowed' : 'pointer', flexShrink: 0, padding: 0,
        background: p.on ? p.sp.accent : p.c.ghost, position: 'relative', transition: 'background .22s ease', opacity: p.disabled ? 0.5 : 1,
      }}
    >
      <span style={{ position: 'absolute', top: 3, left: p.on ? 21 : 3, width: 20, height: 20, borderRadius: 'var(--crm-radius-pill)', background: p.on ? p.sp.accentInk : p.c.card, transition: 'left .22s cubic-bezier(.2,.8,.2,1)', boxShadow: p.c.shadowSm }} />
    </button>
  )
}

function Choix(p: { c: PfColors; value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <select
      value={p.value}
      onChange={(e) => p.onChange(e.target.value)}
      style={{
        height: 36, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${p.c.hair}`,
        background: p.c.inputBg, color: p.c.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 500, cursor: 'pointer',
      }}
    >
      {p.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

function Ligne(p: { c: PfColors; e: CreditLedgerEntry; lang: string; libelle: string }) {
  const { t } = useTranslation('settings')
  const positif = p.e.amount > 0
  const date = new Date(p.e.createdAt).toLocaleString(p.lang, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-lg) 0', borderBottom: `1px solid ${p.c.hairSoft}` }}>
      <span style={{ ...NUM, fontSize: 'var(--crm-text-sm)', color: p.c.soft, width: 96, flexShrink: 0 }}>{date}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', color: p.c.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.libelle}
        {p.e.amountChf != null && <span style={{ color: p.c.soft }}>{` · ${formatChf(p.e.amountChf)}`}</span>}
      </span>
      <span style={{ ...NUM, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: positif ? p.c.green : p.c.ink, whiteSpace: 'nowrap' }}>
        {positif ? '+' : '−'}{formatCredits(Math.abs(p.e.amount), p.lang)}
      </span>
      <span style={{ ...NUM, fontSize: 'var(--crm-text-sm)', color: p.c.soft, width: 110, textAlign: 'right', flexShrink: 0 }}>
        {t('credits.ledger.balanceAfter', { n: formatCredits(p.e.includedAfter + p.e.purchasedAfter, p.lang) })}
      </span>
    </li>
  )
}
