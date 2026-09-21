/**
 * Le bloc CRÉDITS du menu de compte : ce qu'il reste, et de quoi recharger sans
 * traverser les Réglages.
 *
 * Deux gestes, deux lignes, la grammaire du menu (`Row`) — rien de neuf à apprendre :
 *   1. « Crédits Labs » + le solde → ouvre Réglages › Consommation (le détail y vit).
 *   2. « Recharger » → DÉPLIE les quatre packs, et un clic part chez Stripe.
 *
 * ⛔ Le prix est ÉCRIT sur chaque pack, et le dépliement n'est pas cosmétique : un
 * raccourci qui débiterait une carte en un clic sans annoncer le montant serait un
 * piège, pas un confort. Le pli garde le menu épuré ; le prix garde le geste honnête.
 *
 * ⚠ Rien n'est rendu si le plan n'ouvre pas le studio (`labsOuvertAuPlan`) : un solde
 * de 0 crédit sur un plan qui ne peut pas en dépenser est du bruit, pas une
 * information. La montée en plan se propose dans Facturation, pas ici.
 *
 * ⚠ Depuis un banc, on ne navigue pas et on n'achète pas — même règle que la barre
 * latérale (`CrmSidebar`, « LA BARRE NE NAVIGUE PAS DEPUIS UN BANC ») : une cible
 * `/dashboard/*` y enverrait en production.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '../tokens'
import MEIcon from '@/components/propertyx/MEIcon'
import { useCredits } from '@/hooks/useCredits'
import { CREDIT_PACKS, formatCredits, type CreditPack } from '@/lib/credits'
import { labsOuvertAuPlan } from '@/lib/labs'

const NUM = { fontVariantNumeric: 'tabular-nums' as const }

interface Props {
  sp: CrmPalette
  /** Ouvre Réglages › Consommation. Absent (console, banc) : la ligne ne navigue pas. */
  onVoirConsommation?: () => void
  /** Referme le menu — un départ vers Stripe quitte la page, le menu ne doit pas rester. */
  onClose?: () => void
}

export function CrmProfileCredits({ sp, onVoirConsommation, onClose }: Props) {
  const { t, i18n } = useTranslation('common')
  const lang = i18n.language.slice(0, 2)
  const credits = useCredits()
  const [deplie, setDeplie] = useState(false)

  const b = credits.balance
  // Tant que le solde n'est pas lu, le bloc n'existe pas : une ligne « — crédits »
  // qui se remplit sous l'œil est plus dérangeante qu'une ligne qui apparaît.
  if (!b || !labsOuvertAuPlan(b.plan)) return null

  const acheter = (pack: CreditPack) => {
    if (credits.enBanc) return
    onClose?.()
    // La redirection vers Stripe est portée par la mutation (`useCredits`), pas ici.
    void credits.acheter.mutateAsync(pack.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
      <Ligne
        sp={sp}
        icone="sparkle"
        libelle={t('profile.credits')}
        onClick={onVoirConsommation ? () => { onVoirConsommation(); onClose?.() } : undefined}
        fin={
          <span style={{ ...NUM, fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, letterSpacing: -0.2 }}>
            {formatCredits(b.total, lang)}
          </span>
        }
      />

      <Ligne
        sp={sp}
        icone={deplie ? 'chevron-up' : 'plus'}
        libelle={t('profile.topup')}
        onClick={() => setDeplie((v) => !v)}
        aria-expanded={deplie}
      />

      {deplie && (
        <div style={{ display: 'flex', flexDirection: 'column', animation: 'crm-fade-up 200ms cubic-bezier(.22,1,.36,1)' }}>
          {CREDIT_PACKS.map((pack) => (
            <Pack key={pack.id} sp={sp} pack={pack} lang={lang} onClick={() => acheter(pack)} disabled={credits.acheter.isPending || credits.enBanc} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Atomes ───────────────────────────────────────────────────────────────── */

/**
 * La même ligne que le reste du menu — icône à 20 px sans pastille, survol qui ne
 * colore QUE la ligne.
 *
 * ⚠️ Aucune `transition: background` : avec des nœuds réutilisés entre clair et sombre,
 * une transition de couleur de fond reste bloquée à mi-course et peint la teinte sombre
 * périmée (bug « pastilles noires », cf. l'en-tête de `CrmProfileDropdown`).
 */
function Ligne({
  sp, icone, libelle, fin, onClick, ...aria
}: {
  sp: CrmPalette
  icone: 'sparkle' | 'plus' | 'chevron-up'
  libelle: string
  fin?: React.ReactNode
  onClick?: () => void
  'aria-expanded'?: boolean
}) {
  const [survol, setSurvol] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
      {...aria}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
        width: '100%', padding: 'var(--crm-space-md) var(--crm-space-lg)',
        border: 0, background: survol && onClick ? sp.solidBgSub : 'transparent',
        cursor: onClick ? 'pointer' : 'default', textAlign: 'left',
        borderRadius: 'var(--crm-radius-xl)', fontFamily: 'inherit',
      }}
    >
      <div style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <MEIcon name={icone} size={20} color={sp.ink} strokeWidth={1.6} />
      </div>
      <span style={{ flex: 1, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, letterSpacing: -0.1 }}>{libelle}</span>
      {fin}
    </button>
  )
}

/** Un pack : les crédits à gauche, le prix à droite, aligné sous les libellés. */
function Pack({
  sp, pack, lang, onClick, disabled,
}: { sp: CrmPalette; pack: CreditPack; lang: string; onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation('common')
  const [survol, setSurvol] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
        // Aligné sur le LIBELLÉ des lignes, pas sur leur icône : 12 (padding) + 26 + 16.
        width: '100%', padding: 'var(--crm-space-sm) var(--crm-space-lg) var(--crm-space-sm) 54px',
        border: 0, background: survol && !disabled ? sp.solidBgSub : 'transparent',
        cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
        borderRadius: 'var(--crm-radius-xl)', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ ...NUM, flex: 1, fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.ink }}>
        {t('profile.creditsAmount', { n: formatCredits(pack.credits, lang) })}
      </span>
      <span style={{ ...NUM, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: survol && !disabled ? sp.accent : sp.sub, whiteSpace: 'nowrap' }}>
        {t('profile.creditsPrice', { chf: pack.chf })}
      </span>
    </button>
  )
}
