/**
 * Carte KPI de la console super-admin — enveloppe de compatibilité sur `AdminStat`.
 *
 * Rendue par `AdminStat` du kit Sugar : bento séparé par l'ombre (plus de
 * `border border-theme-border`), chiffre en `tabular-nums`, signal porté par la
 * teinte de l'icône. La signature de props est conservée pour les surfaces qui
 * l'appellent encore (tableau de bord, facturation, marketplace) ; les autres
 * pages de la console composent `AdminStat` directement et n'ont plus besoin de
 * cette enveloppe.
 */
import type { LucideIcon } from 'lucide-react'
import { AdminStat } from '@/components/admin/kit/adminKit'
import type { AdminToneName } from '@/components/admin/kit/adminKitCore'

interface AdminKpiCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'danger' | 'success' | 'blue'
  /**
   * Acceptée pour les appelants existants, mais SANS effet : Sugar n'a qu'une
   * densité de KPI. Avant la migration, l'absence de `compact` rendait une carte
   * franchement différente — valeur 24 px, padding 20 px, libellé posé AU-DESSUS
   * de la valeur ; c'est de la variante dense (icône à gauche, valeur puis
   * libellé) que `AdminStat` est proche, pas de la haute. Une surface qui veut
   * retrouver la carte haute doit composer `AdminCard` elle-même.
   */
  compact?: boolean
}

/** `variant` → ton Sugar. `default` n'a pas de ton : l'icône reste en encre douce. */
const VARIANT_TONE: Record<NonNullable<AdminKpiCardProps['variant']>, AdminToneName | undefined> = {
  default: undefined,
  danger: 'err',
  success: 'ok',
  blue: 'info',
}

/** Indicateur : icône teintée par `variant`, valeur tabulaire et tendance +/−. */
export default function AdminKpiCard({ label, value, icon, trend, variant = 'default' }: AdminKpiCardProps) {
  // `AdminStat` n'affiche que la VALEUR de la tendance : son libellé (vide chez
  // tous les appelants actuels) est reversé dans le `hint` du bento plutôt que
  // perdu en silence. Un appelant qui veut un vrai sous-titre passe par
  // `AdminStat` et son `hint` — plus aucune surface ne le demandait ici.
  const hint = trend?.label || undefined

  return (
    <AdminStat
      label={label}
      value={value}
      icon={icon}
      tone={VARIANT_TONE[variant]}
      hint={hint}
      trend={trend?.value}
    />
  )
}
