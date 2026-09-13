/**
 * Passage vitrine → app, avec une authentification RÉELLE (Supabase local).
 *
 * La vitrine (sites/megga-vitrine/js/megga-auth.js, `goToCrm`) remet la session à
 * l'app par un fragment `#access_token=…&refresh_token=…&expires_in=…&token_type=…`
 * posé sur `/auth/callback`. Ce contrat relie deux runtimes que rien d'autre ne
 * teste ensemble : ce fichier fabrique le fragment EXACTEMENT comme goToCrm (mêmes
 * clés, même ordre), avec de VRAIS jetons émis par le GoTrue local.
 *
 * Deuxième preuve (audit S12) : au retour d'une liaison d'agenda, les jetons du
 * fournisseur n'atterrissent JAMAIS dans le stockage du navigateur, et atteignent
 * pourtant l'edge — une seule fois. Le contrôle positif est l'envoi lui-même : un
 * dépôt qui ne transmettrait rien passerait l'assertion « rien dans le stockage »
 * pour une mauvaise raison.
 *
 * Sous playwright.kyb.config.ts, le seul config sans VITE_DEV_BYPASS_AUTH.
 */
import { test, expect, type Page } from '@playwright/test'
import { anonClient, serviceRoleClient } from '../backend/helpers/supabase'

const PW = 'Test-Password-123!'
// Cf. onboarding-identite.spec.ts : sans consentement enregistré à cette version,
// ConsentGate prend l'écran — hors sujet ici.
const CURRENT_CONSENT_VERSION = '2026-07'

interface Agent { id: string; email: string; agencyId: string }
interface Jetons { access_token: string; refresh_token: string; expires_in?: number; token_type?: string }

/** Inscription réelle d'un agent (agence solo provisionnée par handle_new_user), consentement pré-enregistré. */
async function creerAgent(): Promise<Agent> {
  const svc = serviceRoleClient()
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const email = `handoff-e2e-${stamp}@megga-test.local`
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
    user_metadata: { full_name: `Agent passage ${stamp}`, role: 'agent' },
  })
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`)
  const id = data.user.id
  const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
  if (!prof?.agency_id) throw new Error('provisioning : aucune agence solo créée')
  const { error: consentErr } = await svc.from('user_consents').insert([
    { user_id: id, consent_type: 'terms', version: CURRENT_CONSENT_VERSION },
    { user_id: id, consent_type: 'privacy', version: CURRENT_CONSENT_VERSION },
  ])
  if (consentErr) throw new Error(`user_consents : ${consentErr.message}`)
  return { id, email, agencyId: prof.agency_id as string }
}

async function supprimerAgent(agent: Agent): Promise<void> {
  const svc = serviceRoleClient()
  await svc.auth.admin.deleteUser(agent.id).then(() => {}, () => {})
  await svc.from('agencies').delete().eq('id', agent.agencyId).then(() => {}, () => {})
}

/** De VRAIS jetons, émis par le GoTrue local — ce que la vitrine obtient en production. */
async function vraisJetons(email: string): Promise<Jetons> {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password: PW })
  if (error || !data.session) throw new Error(`signInWithPassword : ${error?.message}`)
  return data.session
}

/** Le fragment tel que goToCrm le construit : mêmes clés, même ordre, même encodage. */
function fragmentVitrine(s: Jetons): string {
  return [
    'access_token=' + encodeURIComponent(s.access_token),
    'refresh_token=' + encodeURIComponent(s.refresh_token),
    'expires_in=' + (s.expires_in || 3600),
    'token_type=' + (s.token_type || 'bearer'),
  ].join('&')
}

async function contenuStockage(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))
}

test.describe('Passage vitrine → app (fragment d’auth)', () => {
  test('le fragment de goToCrm ouvre une vraie session, puis quitte l’URL', async ({ page }) => {
    const agent = await creerAgent()
    try {
      const s = await vraisJetons(agent.email)
      await page.goto(`/auth/callback?lang=fr#${fragmentVitrine(s)}`)
      await expect(page).toHaveURL(/\/dashboard/)
      expect(page.url()).not.toContain('access_token')
      // La session est bien rangée (sinon l'agent serait renvoyé au login).
      expect(await contenuStockage(page)).toContain('refresh_token')
    } finally {
      await supprimerAgent(agent)
    }
  })

  test('retour de liaison Google : les jetons du fournisseur partent UNE fois à l’edge, jamais dans le stockage', async ({ page }) => {
    const agent = await creerAgent()
    const envois: Array<Record<string, unknown>> = []
    // Une expression, pas une glob : l'appel porte `?forceFunctionRegion=…` (région épinglée,
    // src/lib/supabase.ts), et une glob Playwright est ancrée sur l'URL ENTIÈRE, query comprise.
    await page.route(/\/functions\/v1\/google-calendar-sync(?:\?|$)/, async (route) => {
      const req = route.request()
      const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
      // Seuls les POST comptent : un pré-vol CORS n'est pas un enregistrement.
      if (req.method() !== 'POST') {
        await route.fulfill({ status: 204, headers: cors })
        return
      }
      envois.push(req.postDataJSON() as Record<string, unknown>)
      await route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) })
    })
    try {
      const s = await vraisJetons(agent.email)
      await page.goto(`/auth/callback?gcal=1#${fragmentVitrine(s)}&provider_token=E2E_PT&provider_refresh_token=E2E_PRT`)
      await expect(page).toHaveURL(/\/dashboard/)
      // CONTRÔLE POSITIF : le jeton de rafraîchissement du fournisseur atteint bien l'edge.
      await expect.poll(() => envois.length).toBe(1)
      expect(envois[0].action).toBe('save_tokens')
      expect(envois[0].refresh_token).toBe('E2E_PRT')
      // Laisse aux deux déclencheurs de la page le temps de se croiser : un second
      // envoi (dépôt relu à vide, ou double enregistrement) apparaîtrait ici.
      await page.waitForTimeout(1500)
      expect(envois).toHaveLength(1)
      const stockage = await contenuStockage(page)
      expect(stockage).toContain('refresh_token') // la session CRM, elle, est rangée
      expect(stockage).not.toContain('E2E_PRT')
      expect(stockage).not.toContain('E2E_PT')
    } finally {
      await supprimerAgent(agent)
    }
  })
})
