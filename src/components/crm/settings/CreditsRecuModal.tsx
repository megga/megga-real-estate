/**
 * LA CONFIRMATION D'ACHAT — ce que l'agent voit en revenant de Stripe.
 *
 * Elle ne se contente pas de dire « merci » : elle rend le REÇU lu chez Stripe par
 * `credits-checkout-status` — combien de crédits, combien payé, le NOUVEAU SOLDE, et le
 * lien de la facture. Un « paiement réussi » qui n'annonce pas le solde laisse l'agent
 * aller le vérifier ailleurs, ce qui est exactement le doute qu'une confirmation existe
 * pour lever.
 *
 * ⚠ Quatre états, pas un. Le paiement peut ne pas être abouti au moment de la
 * redirection (TWINT, 3-D Secure) : `enCours` le dit et se relit, il ne prétend pas.
 * Et si la lecture échoue, la modale ne dit PAS que le paiement a échoué — elle dit
 * qu'elle n'a pas pu lire, ce qui n'est pas la même information.
 *
 * ⚠ Portée dans `<body>` (`createPortal`), voile et flou comme les modales des
 * Réglages. Les keyframes (`setFadeIn`, `setScaleIn`, `setSpin`, `setCheckDraw`) sont
 * montées par `SettingsPage` — rendue isolément, inclure `SETTINGS_KEYFRAMES`.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { crmVoileEncre } from '@/components/crm/tokens'
import type { CrmPalette } from '../tokens'
import { useEcranActif } from '@/hooks/useEcranActif'
import { formatChf, formatCredits, type CreditRecu } from '@/lib/credits'
import type { PfColors } from './focus/pfKitCore'

const NUM = { fontVariantNumeric: 'tabular-nums' as const }

interface Props {
  c: PfColors
  sp: CrmPalette
  /** Le reçu, quand il est lu. `null` tant que la lecture n'a rien rendu. */
  recu: CreditRecu | null
  /** La lecture est en cours, ou le paiement est encore en validation chez Stripe. */
  enCours: boolean
  /** La lecture a échoué — le paiement, lui, n'est PAS démenti pour autant. */
  echec: boolean
  /** Le paiement traîne : on a cessé de redemander. */
  aAbandonne: boolean
  /** Fermer nettoie aussi `?session_id=` de l'URL : un rechargement ne rejoue pas la modale. */
  onClose: () => void
  /** « Réessayer » — ramène aux packs, dans la page derrière. */
  onRetry: () => void
}

export function CreditsRecuModal({ c, sp, recu, enCours, echec, aAbandonne, onClose, onRetry }: Props) {
  const { t, i18n } = useTranslation('settings')
  const lang = i18n.language.slice(0, 2)

  // Échap ferme, comme toute modale. Pas de piège de focus : la modale n'a qu'un bouton.
  //
  // ⛔ ET SEULEMENT DEPUIS L'ÉCRAN REGARDÉ. Les Réglages restent montés en arrière-plan
  // (`EcransVivants`) : sans cette garde, un reçu ouvert dans un onglet caché avalerait
  // l'Échap de l'onglet montré — et se refermerait sans que personne le voie.
  const ecranActif = useEcranActif()
  useEffect(() => {
    if (!ecranActif) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ecranActif, onClose])

  const paye = recu?.statut === 'paid'
  const attente = enCours || aAbandonne

  // Le titre et la phrase, par état. Un seul endroit : c'est la seule chose qui change
  // vraiment d'un cas à l'autre, le reste de la carte est commun.
  const { titre, phrase } = attente
    ? { titre: t('credits.receipt.pendingTitle'), phrase: aAbandonne ? t('credits.receipt.slowBody') : t('credits.receipt.pendingBody') }
    : paye
      ? { titre: t('credits.receipt.paidTitle'), phrase: t('credits.receipt.paidBody', { n: formatCredits(recu?.credits ?? 0, lang) }) }
      : echec
        ? { titre: t('credits.receipt.unknownTitle'), phrase: t('credits.receipt.unknownBody') }
        : recu?.statut === 'expired'
          ? { titre: t('credits.receipt.expiredTitle'), phrase: t('credits.receipt.expiredBody') }
          : { titre: t('credits.receipt.unpaidTitle'), phrase: t('credits.receipt.unpaidBody') }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: crmVoileEncre(false, 0.4),
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'grid', placeItems: 'center', padding: 'var(--crm-space-2xl)',
        animation: 'setFadeIn .2s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-xl)',
          padding: 'var(--crm-space-4xl) var(--crm-space-3xl) var(--crm-space-3xl)',
          // ⛔ BORDURE **ET** OMBRE, pas l'une ou l'autre. En sombre MEGGA X n'a qu'une
          // seule surface (`#16181c` partout) et `shadow` vaut `none` : sans filet, la
          // carte et le voile ne se distinguaient que par le flou de l'arrière-plan.
          background: c.solid, borderRadius: 'var(--crm-radius-4xl)',
          border: `1px solid ${c.hair}`, boxShadow: c.shadow,
          animation: 'setScaleIn .22s cubic-bezier(.22,1,.36,1) both',
          textAlign: 'center', color: c.ink,
        }}
      >
        <Glyphe c={c} sp={sp} etat={attente ? 'attente' : paye ? 'paye' : 'arret'} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: '-0.02em', color: c.ink }}>{titre}</h3>
          <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', color: c.sub, lineHeight: 1.5 }}>{phrase}</p>
        </div>

        {/* Le récapitulatif — seulement quand il y a quelque chose à récapituler. Un
            bloc vide à la place d'un solde inconnu vaudrait moins que rien. */}
        {paye && (
          // Même motif : mesuré au banc, `cardSub` sur `solid` rend ΔL* 0,00 en sombre —
          // le récapitulatif disparaissait en tant que bloc. C'est le filet qui le tient.
          <dl style={{ margin: 0, width: '100%', display: 'flex', flexDirection: 'column', background: c.cardSub, border: `1px solid ${c.hairSoft}`, borderRadius: 'var(--crm-radius-2xl)', padding: 'var(--crm-space-md) var(--crm-space-xl)' }}>
            {recu?.balance != null && (
              <Ligne c={c} libelle={t('credits.receipt.newBalance')} valeur={formatCredits(recu.balance, lang)} fort />
            )}
            <Ligne c={c} libelle={t('credits.receipt.paidAmount')} valeur={formatChf(recu?.chf ?? 0)} />
          </dl>
        )}

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', alignItems: 'center' }}>
          {/* L'affordance PRIMAIRE porte l'accent (règle du 10 août 2026). « Terminé »
              quand c'est payé, « Réessayer » quand il n'y a rien à garder. */}
          <button
            type="button"
            onClick={paye || attente ? onClose : onRetry}
            style={{
              width: '100%', height: 44, border: 0, borderRadius: 'var(--crm-radius-pill)',
              background: sp.accent, color: sp.accentInk,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {paye || attente ? t('credits.receipt.done') : t('credits.receipt.retry')}
          </button>

          {recu?.invoiceUrl && paye && (
            <a
              href={recu.invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: c.sub, textDecoration: 'none' }}
            >
              {t('credits.receipt.invoice')}
            </a>
          )}
          {!paye && !attente && (
            <button
              type="button"
              onClick={onClose}
              style={{ border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: c.sub, cursor: 'pointer' }}
            >
              {t('credits.receipt.close')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Atomes ───────────────────────────────────────────────────────────────── */

/**
 * Le disque d'état. Trois formes, et la coche se DESSINE — c'est le seul moment du
 * parcours où une petite fête est méritée, l'agent vient de payer.
 */
function Glyphe({ c, sp, etat }: { c: PfColors; sp: CrmPalette; etat: 'attente' | 'paye' | 'arret' }) {
  const taille = 56
  if (etat === 'attente') {
    return (
      <div
        aria-hidden="true"
        style={{
          width: taille, height: taille, borderRadius: 'var(--crm-radius-pill)',
          border: `2px solid ${c.hair}`, borderTopColor: sp.accent,
          animation: 'setSpin .7s linear infinite',
        }}
      />
    )
  }
  const remplissage = etat === 'paye' ? c.saved : { bg: c.cardSub, ink: c.sub }
  return (
    <div
      aria-hidden="true"
      style={{
        width: taille, height: taille, borderRadius: 'var(--crm-radius-pill)',
        background: remplissage.bg, color: remplissage.ink,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}
    >
      <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {etat === 'paye'
          ? <path d="m5 12.5 4.5 4.5L19 7.5" style={{ strokeDasharray: 48, animation: 'setCheckDraw .38s .1s cubic-bezier(.65,0,.35,1) both' }} />
          : <><path d="M12 7.5v6" /><path d="M12 17h.01" /></>}
      </svg>
    </div>
  )
}

function Ligne({ c, libelle, valeur, fort }: { c: PfColors; libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-md) 0' }}>
      <dt style={{ fontSize: 'var(--crm-text-md)', color: c.sub }}>{libelle}</dt>
      <dd
        style={{
          ...NUM, margin: 0, whiteSpace: 'nowrap', color: c.ink,
          fontSize: fort ? 'var(--crm-text-2xl)' : 'var(--crm-text-md)', fontWeight: 600,
          letterSpacing: fort ? '-0.02em' : undefined,
        }}
      >
        {valeur}
      </dd>
    </div>
  )
}
