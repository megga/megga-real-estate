// MEGGA CRM — Refonte « Aujourd'hui » · TOKENS (port fidèle du prototype)
// ----------------------------------------------------------------------------
// Port 1:1 de `today-redesign-kit.jsx` (handoff Claude Design, juin 2026).
// `TK` est un singleton muté EN PLACE par `applyTK(dark)` : sombre immersif
// (défaut) ↔ clair Sugar. Tous les composants lisent `TK` au rendu, donc
// basculer l'ambiance « allume » l'ensemble du cockpit (et la modale Détail
// du match), pas seulement la chrome.
//
// Le pager appelle `applyTK(dark)` en tête de render ; le sous-arbre se
// re-render sur le changement de `dark`, donc lire le singleton muté au render
// renvoie toujours l'ambiance courante (comportement identique au proto).

import { crmStep } from '@/components/crm-sugar/tokens'

export interface TkTone {
  bg: string
  fg: string
  dot: string
}

export interface Tk {
  bg: string
  bgGrad: string
  frame: string
  frameSolid: string
  frameHi: string
  border: string
  borderHi: string
  card: string
  cardHi: string
  cardBorder: string
  ink: string
  inkDim: string
  sub: string
  faint: string
  primary: string
  primarySoft: string
  shadow: string
  shadowLg: string
  ok: TkTone
  warn: TkTone
  danger: TkTone
  info: TkTone
  neutral: TkTone
  mode: 'dark' | 'light'
}

// Surfaces en GETTERS : `applyTK` les recopie par `Object.assign` à chaque
// rendu du cockpit, donc elles sont relues — la palette suit la teinte active
// sans figer sa valeur au chargement du module.
const TK_DARK: Omit<Tk, 'mode'> = {
  get bg() { return crmStep('s0', '#0A0B0D') },
  get bgGrad() { return crmStep('s0', '#0A0B0D') },
  get frame() { return crmStep('s1', '#15161A') },
  get frameSolid() { return crmStep('s1', '#17181C') },
  get frameHi() { return crmStep('s2', '#1B1C21') },
  border: 'rgba(255,255,255,0.08)',
  borderHi: 'rgba(255,255,255,0.14)',
  get card() { return crmStep('s2', 'rgba(255,255,255,0.035)') },
  get cardHi() { return crmStep('s3', 'rgba(255,255,255,0.06)') },
  cardBorder: 'rgba(255,255,255,0.07)',
  ink: '#ECEDF3',
  inkDim: '#B5B7C4',
  sub: '#797D90',
  faint: '#54576A',
  primary: '#6F8CFF',
  primarySoft: 'rgba(111,140,255,0.14)',
  shadow: '0 1px 2px rgba(0,0,0,.4), 0 18px 44px -16px rgba(0,0,0,.7)',
  shadowLg: '0 30px 70px -20px rgba(0,0,0,.75), 0 8px 22px -12px rgba(0,0,0,.6)',
  ok: { bg: '#15643F', fg: '#DBF4E6', dot: '#34C796' },
  warn: { bg: '#7A3F12', fg: '#F7DDBE', dot: '#F2B855' },
  danger: { bg: '#7E1C36', fg: '#F6CBD6', dot: '#F26B65' },
  info: { bg: '#1B3A6E', fg: '#C7D9F6', dot: '#6F8CFF' },
  neutral: { bg: '#23232F', fg: '#C8C9D2', dot: '#797D90' },
}

// Ambiance claire — Sugar Pure neutre (gris, aucun bleu de fond).
const TK_LIGHT: Omit<Tk, 'mode'> = {
  bg: '#EBEDF1',
  bgGrad: '#EBEDF1',
  frame: '#FFFFFF',
  frameSolid: '#FFFFFF',
  frameHi: '#F5F6F8',
  border: 'rgba(15,23,42,0.09)',
  borderHi: 'rgba(15,23,42,0.16)',
  card: 'rgba(15,23,42,0.028)',
  cardHi: 'rgba(15,23,42,0.055)',
  cardBorder: 'rgba(15,23,42,0.08)',
  ink: '#0B0C0E',
  inkDim: '#3A3D44',
  sub: '#6B7079',
  faint: '#9CA1AB',
  primary: '#2A2D34',
  primarySoft: 'rgba(42,45,52,0.10)',
  shadow: '0 1px 2px rgba(15,23,42,.05), 0 14px 36px -18px rgba(15,23,42,.18)',
  shadowLg: '0 30px 70px -24px rgba(15,23,42,.30), 0 8px 22px -14px rgba(15,23,42,.16)',
  ok: { bg: '#DBF2E6', fg: '#15643F', dot: '#15923F' },
  warn: { bg: '#FBE8D0', fg: '#8A4B12', dot: '#D98A2B' },
  danger: { bg: '#FADBE2', fg: '#8E1F3D', dot: '#D7475F' },
  info: { bg: '#DEE8FA', fg: '#1E4B8E', dot: '#3A6FD0' },
  neutral: { bg: '#E9EBEF', fg: '#3A3D44', dot: '#6B7079' },
}

// Palette vivante : démarre en sombre, mutée en place par applyTK.
export const TK: Tk = { ...TK_DARK, mode: 'dark' }

export function applyTK(dark: boolean): void {
  Object.assign(TK, dark === false ? TK_LIGHT : TK_DARK)
  TK.mode = dark === false ? 'light' : 'dark'
}

// Phases pipeline (couleurs de reconnaissance). `labelKey` = clé i18n stable
// (namespace dashboard) ; le libellé est traduit chez le consommateur (cf. §5
// des conventions i18n — module pur, pas de hook ici).
export const TK_STAGE: Record<string, { labelKey: string; color: string }> = {
  recherche: { labelKey: 'today.pipeline.stages.searching', color: '#6F8CFF' },
  visite: { labelKey: 'today.pipeline.stages.visit', color: '#39B7C9' },
  offre: { labelKey: 'today.pipeline.stages.offer', color: '#E08A45' },
  compromis: { labelKey: 'today.pipeline.stages.compromis', color: '#34C796' },
}

export type TkToneName = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
