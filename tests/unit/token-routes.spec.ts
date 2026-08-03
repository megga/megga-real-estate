/**
 * Routes porteuses d'un capability token — la liste vit en DEUX exemplaires, dans
 * deux runtimes qui ne peuvent pas s'importer : la garde inline d'`index.html`
 * (évaluée dans <head>, avant React, pour que les mouchards ne soient même pas
 * téléchargés) et `isTokenBearingPath` (module TS, consommé par Sentry).
 *
 * Le duplicat échoue OUVERT : étendre l'une sans l'autre laisse GTM et GA4 recevoir
 * l'URL complète — token compris — sur la route oubliée, sans que rien ne rougisse.
 * Ce fichier est la seule chose qui lie les deux sources ; il compare le comportement
 * plutôt que le texte, pour qu'une réécriture équivalente de l'expression reste verte.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isTokenBearingPath, scrubSecretUrl } from '@/lib/sentry'

/** Extrait l'expression de la garde d'`index.html` telle qu'elle est réellement publiée. */
function gardeDeIndexHtml(): RegExp {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
  const m = html.match(/MEGGA_ROUTE_TOKENISEE\s*=\s*(\/.+?\/[a-z]*)\.test\(/s)
  if (!m) throw new Error("garde MEGGA_ROUTE_TOKENISEE introuvable dans index.html — le test ne prouve plus rien")
  const [, litteral] = m
  const dernierSlash = litteral.lastIndexOf('/')
  return new RegExp(litteral.slice(1, dernierSlash), litteral.slice(dernierSlash + 1))
}

/** Chemins réellement servis par le routeur (src/App.tsx) qui portent un secret. */
const TOKENISEES = [
  '/kyc/abc123',
  '/kyc-report/abc123',
  '/reception/abc123',
  '/accept-invite/abc123',
  '/rendez-vous/abc123', // gestion de RDV KYC — jeton dans le CHEMIN (appointment-book)
  '/visit/9c2/edit',
  '/visit/9c2/feedback',
  '/visite/9c2/modifier', // alias FR : redirigé au bord, mais servi par le SPA en dev
  '/visite/9c2/feedback',
  '/auth/callback', // flux implicite Supabase ⇒ #access_token & refresh_token
  '/auth/forgot-password/reset',
]

/** Routes ordinaires : les bloquer coûterait toute la mesure d'audience du CRM. */
const ORDINAIRES = [
  '/',
  '/dashboard',
  '/dashboard/admin',
  '/dashboard/contacts',
  '/login',
  '/kycology', // piège : préfixe qui n'est pas un segment
  '/visitors',
  '/authentique',
]

describe('routes tokenisées — les deux gardes disent la même chose', () => {
  const garde = gardeDeIndexHtml()

  it.each(TOKENISEES)('%s est reconnue par les deux sources', (chemin) => {
    expect(isTokenBearingPath(chemin)).toBe(true)
    expect(garde.test(chemin)).toBe(true)
  })

  it.each(ORDINAIRES)('%s reste mesurable par les deux sources', (chemin) => {
    expect(isTokenBearingPath(chemin)).toBe(false)
    expect(garde.test(chemin)).toBe(false)
  })
})

describe('scrubSecretUrl', () => {
  it('caviarde le token quand il est dans le CHEMIN', () => {
    expect(scrubSecretUrl('https://app.megga.ch/kyc/eyJpZCI6.c2ln')).toBe('https://app.megga.ch/kyc/[redacted]')
    expect(scrubSecretUrl('https://app.megga.ch/reception/eyJpZCI6.c2ln')).toBe('https://app.megga.ch/reception/[redacted]')
    expect(scrubSecretUrl('https://app.megga.ch/accept-invite/9c2f')).toBe('https://app.megga.ch/accept-invite/[redacted]')
  })

  it("ne se laisse pas avoir par `kyc-report`, que la branche `kyc` seule ne couvre pas", () => {
    expect(scrubSecretUrl('https://app.megga.ch/kyc-report/9c2f')).toBe('https://app.megga.ch/kyc-report/[redacted]')
  })

  it('coupe la query ET le fragment — c\'est ce qui couvre les pages de visite et /auth/callback', () => {
    expect(scrubSecretUrl('https://app.megga.ch/visit/9c2/edit?token=9c2f')).toBe('https://app.megga.ch/visit/9c2/edit')
    expect(scrubSecretUrl('https://app.megga.ch/auth/callback#access_token=eyJ&refresh_token=v1')).toBe('https://app.megga.ch/auth/callback')
  })
})
