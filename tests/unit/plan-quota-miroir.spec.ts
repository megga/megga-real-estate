/**
 * Le quota de biens actifs tenu en base (20260913170100, audit S15) est le MIROIR de
 * `PLAN_LIMITS` : si l'un bouge sans l'autre, l'écran annoncerait une limite que la base
 * n'applique pas — ou l'inverse. Et la règle naît INACTIVE, par décision du 13.09.2026 :
 * aucun rejeu ne doit pouvoir la rallumer ou l'éteindre à la place d'un humain.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLAN_LIMITS } from '@/lib/plans'

const SQL = readFileSync('supabase/migrations/20260913170100_plan_property_quota_guard.sql', 'utf8')
// Le corps exécutable, sans les commentaires (qui citent la commande d'activation).
const CODE = SQL.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')

describe('quota de biens — miroir de PLAN_LIMITS', () => {
  it('Starter : la base plafonne au même nombre que PLAN_LIMITS', () => {
    const m = CODE.match(/case v_plan when 'starter' then (\d+) else null end/)
    expect(m, 'CASE du plafond introuvable dans la migration').not.toBeNull()
    expect(Number(m![1])).toBe(PLAN_LIMITS.starter.maxProperties)
  })

  it('Pro et Entreprise : illimités des deux côtés (Infinity ↔ else null)', () => {
    expect(PLAN_LIMITS.pro.maxProperties).toBe(Infinity)
    expect(PLAN_LIMITS.entreprise.maxProperties).toBe(Infinity)
    // Contrôle : le CASE ne nomme AUCUN autre plan qui recevrait un plafond.
    expect(CODE.match(/when '(\w+)' then \d+/g)).toEqual(["when 'starter' then 10"])
  })
})

describe('quota de biens — interrupteur', () => {
  it('la clé naît à false et un rejeu ne la réécrit jamais', () => {
    expect(CODE).toMatch(/values \('plan_limits_enforced', 'false'\)\s*on conflict \(key\) do nothing/)
    // Contrôle positif : la migration ne contient AUCUNE écriture qui l'allumerait.
    expect(CODE).not.toMatch(/plan_limits_enforced'[^;]*'true'\)/)
    expect(CODE).not.toMatch(/do update set value/)
  })

  it('la règle ne s’applique que si la clé vaut exactement true', () => {
    expect(CODE).toMatch(/where c\.key = 'plan_limits_enforced'\), 'false'\) <> 'true' then\s*return new;/)
  })
})

describe('quota de biens — le refus se lit à l’écran', () => {
  it('le wizard traduit plan_property_limit au lieu d’afficher le code', () => {
    const wizard = readFileSync('src/components/crm-wizard/WizardShell.tsx', 'utf8')
    expect(wizard).toContain("message.includes('plan_property_limit') ? t('wizard.shell.planLimit')")
    for (const l of ['fr', 'de', 'en', 'it']) {
      const j = JSON.parse(readFileSync(`src/i18n/locales/${l}/listings.json`, 'utf8')) as {
        wizard: { shell: Record<string, string> }
      }
      expect(j.wizard.shell.planLimit, l).toBeTruthy()
    }
    // Contrôle : le code levé par la base est bien celui que le wizard attend.
    expect(CODE).toContain("raise exception 'plan_property_limit'")
  })
})
