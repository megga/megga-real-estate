#!/usr/bin/env node
// Gate CI — une clé de traduction appelée mais inexistante.
//
// POURQUOI CE GATE. Quand `t()` reçoit une clé absente des dictionnaires,
// i18next affiche LA CLÉ, telle quelle, et n'avertit pas. Le défaut est donc
// invisible partout sauf à l'écran, et aucun gate existant ne le voyait :
//   · `lint:i18n` cherche du texte FR EN DUR, pas des clés fantômes ;
//   · `i18n:parity:ci` compare les langues ENTRE ELLES — deux langues peuvent
//     être en parité parfaite sur une clé que personne n'appelle, et une clé
//     appelée qui n'existe nulle part passe sous les deux radars ;
//   · `tsc` ne type pas les clés (elles sont des chaînes libres).
// Cas réel (2 août 2026) : `t('common:logout')` — la clé racine n'existe pas, le
// vrai chemin est `common:nav.logout`. Les deux écrans d'entrée d'un NOUVEL
// agent affichaient donc le mot « logout » en clair, dans les quatre langues,
// et personne ne l'a vu passer.
//
// CE QUI EST VÉRIFIÉ. Les clés littérales, sous deux formes :
//   1. préfixées      `t('common:nav.logout')`, `i18nKey="kyc:report.title"`
//   2. non préfixées  `t('wizard.footer.exit')`, résolues contre le namespace du
//      fichier — UNIQUEMENT si celui-ci n'appelle `useTranslation('<ns>')` qu'une
//      seule fois, avec un littéral. Dès qu'il y a un tableau, une variable ou
//      deux namespaces, le fichier est ignoré : mieux vaut une lacune qu'un gate
//      qui crie faux.
//
// CE QUI N'EST PAS VÉRIFIABLE, et pourquoi : les clés composées à l'exécution
// (`t('kyc:report.check.' + code)`), dont le littéral n'est qu'un préfixe.
//
// Référence = le FRANÇAIS seul. C'est la langue source, et `i18n:parity:ci`
// garantit déjà que les trois autres la couvrent : contrôler les quatre ici
// dédoublerait ce gate et ferait échouer deux fois le même défaut.
//
// ⚠ TROIS PIÈGES qui ont rendu la première version de ce contrôle MENTEUSE
// (216 échecs annoncés, tous faux) :
//
//  1. CLÉS PLATES CONTENANT DES POINTS. `admin.json` porte `"common.adminBadge"`
//     à plat, pas en objet imbriqué ; i18next teste l'accès DIRECT avant de
//     découper sur le séparateur, donc ça résout. D'où la règle : la résolution
//     est déléguée au vrai i18next (`exists()`), jamais réimplémentée à la main.
//  2. PLURIELS. `aiHint.daysAgo` n'existe QUE sous `daysAgo_one` / `daysAgo_other` ;
//     `exists()` sur la clé nue rend faux alors que `t(clé, { count })` marche.
//  3. COMMENTAIRES. Un `t('errors.generic')` cité dans un commentaire explicatif
//     n'est pas un appel. Les commentaires sont blanchis avant analyse.
//
// Et un quatrième, qui n'est pas un piège mais une intention : `defaultValue`.
// `t('x.y', { defaultValue: 'Rapport' })` affiche « Rapport », pas la clé — c'est
// un échappatoire délibéré d'i18next, pas le défaut que ce gate traque.

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createInstance } from 'i18next'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOCALES = join(RACINE, 'src/i18n/locales/fr')

// ── Dictionnaires de référence ───────────────────────────────────────────────
const NAMESPACES = []
const resources = { fr: {} }
for (const fichier of readdirSync(LOCALES)) {
  if (!fichier.endsWith('.json')) continue
  const nom = fichier.replace(/\.json$/, '')
  NAMESPACES.push(nom)
  resources.fr[nom] = JSON.parse(readFileSync(join(LOCALES, fichier), 'utf8'))
}

const i18n = createInstance()
await i18n.init({
  lng: 'fr',
  fallbackLng: 'fr',
  ns: NAMESPACES,
  defaultNS: 'common',
  resources,
  interpolation: { escapeValue: false },
})

/** Vrai si la clé résout, formes plurielles comprises (cf. piège 2). */
function resout(cle) {
  return i18n.exists(cle) || i18n.exists(`${cle}_other`) || i18n.exists(`${cle}_one`)
}

// ── Blanchiment des commentaires (piège 3) ───────────────────────────────────
/**
 * Remplace le contenu des commentaires par des espaces, en gardant les
 * positions et les sauts de ligne intacts — les numéros de ligne rapportés
 * restent donc ceux du fichier réel.
 *
 * Un simple `replace(/\/\/.*$/)` ne suffirait pas : `'https://…'` porte deux
 * barres obliques à l'intérieur d'une chaîne. Il faut suivre l'état.
 */
function blanchirCommentaires(source) {
  const sortie = Array.from(source)
  let etat = 'code'
  let delimiteur = ''
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    const suivant = source[i + 1]
    if (etat === 'code') {
      if (c === '/' && suivant === '/') { etat = 'ligne'; sortie[i] = ' ' }
      else if (c === '/' && suivant === '*') { etat = 'bloc'; sortie[i] = ' ' }
      else if (c === "'" || c === '"' || c === '`') { etat = 'chaine'; delimiteur = c }
    } else if (etat === 'chaine') {
      if (c === '\\') { i++; continue }
      if (c === delimiteur) etat = 'code'
    } else if (etat === 'ligne') {
      if (c === '\n') etat = 'code'
      else sortie[i] = ' '
    } else if (etat === 'bloc') {
      if (c === '*' && suivant === '/') { sortie[i] = ' '; sortie[i + 1] = ' '; i++; etat = 'code' }
      else if (c !== '\n') sortie[i] = ' '
    }
  }
  return sortie.join('')
}

/** Arguments de l'appel `t(` ouvert à `debut`, jusqu'à sa parenthèse fermante. */
function argumentsDeLAppel(source, debut) {
  let profondeur = 0
  for (let i = debut; i < source.length && i < debut + 4000; i++) {
    if (source[i] === '(') profondeur++
    else if (source[i] === ')') {
      profondeur--
      if (profondeur === 0) return source.slice(debut, i + 1)
    }
  }
  return source.slice(debut, debut + 400)
}

// ── Collecte ─────────────────────────────────────────────────────────────────
const fichiers = execSync(
  `grep -rlE "useTranslation|i18nKey=|i18n\\.t\\(" ${JSON.stringify(join(RACINE, 'src'))} --include=*.ts --include=*.tsx`,
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
).trim().split('\n').filter(Boolean)

const APPEL_PREFIXE = /(?:\bt\(\s*|i18nKey=)['"]([a-z][a-zA-Z]*):([A-Za-z0-9_.]+)['"]/g
const APPEL_SIMPLE = /\bt\(\s*['"]([A-Za-z][A-Za-z0-9_.]*)['"]/g
const NS_LITTERAL = /useTranslation\(\s*['"]([a-z][a-zA-Z]*)['"]\s*\)/g

const manquantes = []
let verifiees = 0
let dynamiques = 0
let fichiersAvecDefaut = 0

for (const chemin of fichiers) {
  const brut = readFileSync(chemin, 'utf8')
  const source = blanchirCommentaires(brut)
  const lignes = source.split('\n')
  const affiche = relative(RACINE, chemin)

  // Décalage caractère -> numéro de ligne, calculé une fois par fichier.
  const debutDeLigne = [0]
  for (let i = 0; i < lignes.length; i++) debutDeLigne.push(debutDeLigne[i] + lignes[i].length + 1)
  const ligneDe = (index) => {
    let bas = 0, haut = debutDeLigne.length - 1
    while (bas < haut) {
      const milieu = (bas + haut + 1) >> 1
      if (debutDeLigne[milieu] <= index) bas = milieu
      else haut = milieu - 1
    }
    return bas + 1
  }

  /** Un appel dont l'auteur a fourni un repli n'affichera jamais la clé. */
  const aUnRepli = (index) => argumentsDeLAppel(source, source.indexOf('(', index)).includes('defaultValue')
  /** `t('prefixe.' + variable)` : le littéral n'est qu'un morceau. */
  const estCompose = (fin) => /^\s*\+/.test(source.slice(fin))

  for (const m of source.matchAll(APPEL_PREFIXE)) {
    const [brutMatch, namespace, cle] = m
    if (!NAMESPACES.includes(namespace)) continue // pas un namespace (ex. `https:`)
    if (cle.endsWith('.') || estCompose(m.index + brutMatch.length)) { dynamiques++; continue }
    if (brutMatch.startsWith('t(') && aUnRepli(m.index)) continue
    verifiees++
    if (!resout(`${namespace}:${cle}`)) manquantes.push(`${affiche}:${ligneDe(m.index)}  ${namespace}:${cle}`)
  }

  // Clés non préfixées : seulement si le namespace du fichier est sans ambiguïté.
  const declares = [...new Set([...source.matchAll(NS_LITTERAL)].map((m) => m[1]))]
  const ambigu = declares.length !== 1
    || /useTranslation\(\s*\[/.test(source)
    || /useTranslation\(\s*[A-Za-z_$]/.test(source)
  if (ambigu) { fichiersAvecDefaut++; continue }
  const namespace = declares[0]
  if (!NAMESPACES.includes(namespace)) { fichiersAvecDefaut++; continue }

  for (const m of source.matchAll(APPEL_SIMPLE)) {
    const cle = m[1]
    if (cle.includes(':')) continue // déjà traité au-dessus
    if (cle.endsWith('.') || estCompose(m.index + m[0].length)) { dynamiques++; continue }
    if (aUnRepli(m.index)) continue
    verifiees++
    if (!resout(`${namespace}:${cle}`)) manquantes.push(`${affiche}:${ligneDe(m.index)}  [${namespace}] ${cle}`)
  }
}

// ── Verdict ──────────────────────────────────────────────────────────────────
if (manquantes.length === 0) {
  console.log(
    `✓ Clés i18n OK — ${verifiees} clés littérales résolvent dans ${fichiers.length} fichiers`
    + ` (${dynamiques} composées à l'exécution, ${fichiersAvecDefaut} fichiers à namespace ambigu : non vérifiables).`
  )
  process.exit(0)
}

console.error(`✗ ${manquantes.length} clé(s) i18n appelée(s) mais INEXISTANTE(s) — i18next affichera la clé en clair :\n`)
for (const ligne of manquantes) console.error('   ' + ligne)
console.error(
  `\nRéférence : src/i18n/locales/fr/. Corriger le chemin, ou ajouter la clé dans les 4 langues`
  + ` (skill i18n-sync, puis npm run i18n:parity:ci).`
)
process.exit(1)
