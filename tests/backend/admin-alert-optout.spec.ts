// Découplage diffusion ↔ identité — opt-out des mails admin/cron
// (migration 20260718152100_admin_alert_optout)
//
//  Les mails admin/cron (alerting admin-monitoring, rapport weekly-report)
//  sont adressés à admin_alert_recipients() = super_admin_allowlist() MOINS
//  app_config.admin_alert_optout. Ce découplage permet à un email allowlisté
//  de sortir des mails SANS perdre son identité super-admin.
//
//  Ce spec verrouille l'invariant central : hello@juarts.com (dans l'opt-out
//  seedé par la migration) est EXCLU des destinataires, mais reste super-admin
//  (super_admin_allowlist + super_admin_allowlist_match inchangés).
//
//  Toutes les RPC sont GRANT EXECUTE TO service_role → serviceRoleClient.
//  Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const OPTED_OUT = 'hello@juarts.com'
const STILL_IN = 'ttaillefer.dev@gmail.com'

describe.skipIf(!HAS_KEYS)('admin_alert_recipients — diffusion découplée de l\'identité', () => {
  it('exclut l\'email opt-out des destinataires mais garde son accès super-admin', async () => {
    const service = serviceRoleClient()

    // ── Identité super-admin INTACTE (source unique, non modifiée) ──
    const { data: allowlist, error: allowErr } = await service.rpc('super_admin_allowlist')
    if (allowErr) throw new Error(`super_admin_allowlist: ${allowErr.message}`)
    expect(allowlist).toContain(OPTED_OUT)
    expect(allowlist).toContain(STILL_IN)

    const { data: stillAdmin, error: matchErr } = await service.rpc('super_admin_allowlist_match', {
      p_email: OPTED_OUT,
    })
    if (matchErr) throw new Error(`super_admin_allowlist_match: ${matchErr.message}`)
    expect(stillAdmin, 'l\'opt-out mail NE retire PAS l\'identité super-admin').toBe(true)

    // ── Diffusion : l'email opt-out sort des destinataires… ──
    const { data: recipients, error: recErr } = await service.rpc('admin_alert_recipients')
    if (recErr) throw new Error(`admin_alert_recipients: ${recErr.message}`)
    expect(Array.isArray(recipients)).toBe(true)
    expect(recipients).not.toContain(OPTED_OUT)
    // …tandis que les autres allowlistés restent destinataires.
    expect(recipients).toContain(STILL_IN)
  })
})
