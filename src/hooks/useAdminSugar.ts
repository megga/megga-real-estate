/**
 * Palette Sugar de la console super-admin, dérivée du thème admin.
 *
 * Les Paramètres du CRM (`SettingsSugarV2Page`) calculent leur palette au
 * render — `sugarThemeTokens(dark)` → `crmSugarPalette(...)` → `galSurfaces(...)`
 * — puis la font descendre en props. La console, elle, a 17 pages et 27
 * composants : enfiler `sp`/`surf`/`dark` partout serait un carnage d'imports.
 *
 * Ce hook lit le thème sur `AdminThemeProvider` (déjà branché sur la clé Sugar
 * `megga.sugar.dark`) et rend la MÊME palette que les Paramètres. Les atomes du
 * kit l'appellent eux-mêmes : les pages n'ont donc aucune prop de thème à
 * porter, et pourtant les valeurs viennent de `tokens.ts`, pas d'une copie.
 */
import { useMemo } from 'react'
import { useAdminTheme } from '@/components/admin/AdminThemeProvider'
import { crmSugarPalette, sugarThemeTokens, SUGAR_DARK_TONE, type SugarPalette } from '@/components/crm-sugar/tokens'

/**
 * Surfaces Sugar Pure : blanc opaque en clair, verre subtil en sombre.
 *
 * Valeurs recopiées de `galSurfaces` (crm-sugar/biens/gallery/galHelpers.ts).
 * La duplication est VOLONTAIRE : `galHelpers` importe `@/i18n` pour ses
 * libellés de statut, et comme le kit admin est importé par les 42 surfaces de
 * la console, passer par lui traînait tout le bundle i18n dans le chunk partagé
 * du kit (mesuré : 570 kB, chaînes de locale incluses). `galSurfaces` ignore de
 * toute façon son argument de palette — c'est une table de constantes indexée
 * sur `dark`, donc rien de vivant n'est perdu ici. `tokens.ts`, lui, n'importe
 * rien : la palette continue de venir de la source de vérité.
 */
interface AdminSurfaces {
  card: string
  cardSub: string
  hairline: string
  shadow: string
  shadowHov: string
}

function adminSurfaces(dark: boolean): AdminSurfaces {
  return {
    card: dark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    cardSub: dark ? 'rgba(255,255,255,0.04)' : '#F4F6F9',
    hairline: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.05)',
    shadow: dark
      ? '0 1px 2px rgba(0,0,0,.4), 0 10px 28px -12px rgba(0,0,0,.6)'
      : '0 1px 2px rgba(15,23,42,.04), 0 12px 34px -14px rgba(40,55,90,.20)',
    shadowHov: dark
      ? '0 1px 2px rgba(0,0,0,.5), 0 24px 50px -16px rgba(0,0,0,.7)'
      : '0 2px 6px rgba(15,23,42,.05), 0 26px 52px -18px rgba(40,55,90,.32)',
  }
}

/** Couleurs fonctionnelles de la console (mêmes tons que `pfColors` des Réglages). */
export interface AdminTones {
  ok: string
  warn: string
  err: string
  info: string
  cyan: string
  /** Accent de la plateforme (violet). Lu sur la variable CSS pour rester unique. */
  accent: string
  /** Surface d'une pilule neutre (pas de signal). */
  neutralBg: string
  neutralInk: string
}

export interface AdminSugar {
  sp: SugarPalette
  surf: AdminSurfaces
  dark: boolean
  tones: AdminTones
  /** Texte posé sur une pilule pleine — blanc, jamais `#fff` codé en dur ailleurs. */
  onTone: string
}

/**
 * Palette + surfaces + tons de la console, mémorisés sur `dark`.
 *
 * Les tons clair/sombre suivent la convention `pfColors` : on assombrit en clair
 * pour tenir le contraste sur fond blanc, on éclaircit en sombre. Ne pas les
 * remplacer par les `text-*-500` de Tailwind — c'est précisément l'écart que
 * l'alignement corrige.
 */
export function useAdminSugar(): AdminSugar {
  const { dark } = useAdminTheme()

  return useMemo(() => {
    const t = sugarThemeTokens(dark)
    const sp = crmSugarPalette(t, dark, SUGAR_DARK_TONE)
    const surf = adminSurfaces(dark)

    const tones: AdminTones = {
      ok: dark ? '#12A574' : '#059669',
      warn: dark ? '#E08A2E' : '#C45A00',
      err: dark ? '#F26B65' : '#DC2626',
      info: dark ? '#4C86E8' : '#1E5BC6',
      cyan: dark ? '#22B8CF' : '#0891B2',
      accent: 'rgb(var(--color-admin-accent))',
      neutralBg: surf.cardSub,
      neutralInk: sp.soft,
    }

    return { sp, surf, dark, tones, onTone: '#FFFFFF' }
  }, [dark])
}
