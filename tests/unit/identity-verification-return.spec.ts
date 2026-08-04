// Le RETOUR du prestataire de vérification doit atterrir sur l'étape dont il revient.
//
// Ce qu'on éprouve ici est un accord entre DEUX RUNTIMES qui ne s'importent pas : l'edge
// function (Deno) construit le `return_url` vers lequel Stripe renvoie, et le wizard
// (bundle navigateur) doit reconnaître ce retour. Rien dans le typage ne les relie, et
// c'est exactement ainsi que le paramètre a pu vivre huit jours sans lecteur : l'edge
// posait `?verification=done`, personne ne le lisait, et le dirigeant qui venait de
// photographier sa pièce rouvrait le wizard à l'étape SIGNATAIRE — deux étapes avant
// celle qui lui aurait dit si sa vérification avait abouti.
//
// Trois invariants, aucun visible en lisant l'un des deux fichiers seul :
//
//  1. le nom ET la valeur du paramètre sont les mêmes des deux côtés ;
//  2. le chemin de retour est bien la route du gate d'identité — un autre chemin
//     renverrait sur une route que le gate expulserait aussitôt (boucle P0 c830f9a9) ;
//  3. l'index d'atterrissage désigne l'étape de vérification, quel que soit le nombre
//     d'étapes du parcours (il en a déjà perdu une le 3 août 2026).
//
// Ne teste PAS le rendu (ce dépôt n'a pas @testing-library/react) : la lecture du
// paramètre est une fonction pure exportée, testée directement.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isVerificationReturn,
  IDENTITY_VERIFICATION_STEP,
  VERIFICATION_RETURN_PARAM,
  VERIFICATION_RETURN_VALUE,
} from '@/components/crm-sugar-identity/IdentityShell'
import { SG_IDENTITY_STEPS } from '@/components/crm-sugar-identity/tokens'
import { IDENTITY_GATE_ROUTE } from '@/hooks/useIdentityGate'

/** Le `RETURN_PATH` littéral de l'edge, relu à la source plutôt que recopié ici. */
function edgeReturnPath(): string {
  const source = readFileSync(
    resolve(__dirname, '../../supabase/functions/kyb-identity-verify/index.ts'),
    'utf8',
  )
  const match = /const RETURN_PATH = '([^']+)'/.exec(source)
  if (!match) {
    throw new Error(
      "kyb-identity-verify n'expose plus un `const RETURN_PATH = '...'` — ce test ne peut "
      + 'plus vérifier que les deux runtimes parlent du même retour. Adapter la lecture, '
      + 'jamais recopier la valeur ici.',
    )
  }
  return match[1]
}

describe('isVerificationReturn — reconnaître le retour du prestataire', () => {
  it('reconnaît le paramètre que l\'edge pose réellement', () => {
    const url = new URL(`https://app.megga.ch${edgeReturnPath()}`)
    expect(isVerificationReturn(url.searchParams)).toBe(true)
  })

  it('une URL sans paramètre n\'est pas un retour', () => {
    // Le cas de tous les jours : le dirigeant ouvre /dashboard/identite depuis le gate.
    // Le prendre pour un retour ferait sauter à l'étape 3 quelqu'un qui n'a rien saisi.
    expect(isVerificationReturn(new URLSearchParams(''))).toBe(false)
  })

  it('une autre valeur du même paramètre n\'est pas un retour', () => {
    // Fail-closed : seul `done` compte. Un `?verification=cancel` qu'un futur flux
    // poserait ne doit pas ouvrir une attente de verdict qui n'arrivera jamais.
    expect(isVerificationReturn(new URLSearchParams('verification=pending'))).toBe(false)
    expect(isVerificationReturn(new URLSearchParams('verification='))).toBe(false)
  })

  it('un autre paramètre à la même valeur n\'est pas un retour', () => {
    expect(isVerificationReturn(new URLSearchParams('autre=done'))).toBe(false)
  })

  it('le retour reste reconnu au milieu d\'autres paramètres', () => {
    // Stripe n'en ajoute pas aujourd'hui, mais l'URL de retour est publique : un
    // paramètre de campagne collé derrière ne doit pas faire perdre le retour.
    expect(isVerificationReturn(new URLSearchParams('utm_source=mail&verification=done'))).toBe(true)
  })
})

describe('accord entre les deux runtimes — edge (Deno) et wizard (navigateur)', () => {
  it('le paramètre porte le même nom et la même valeur des deux côtés', () => {
    const url = new URL(`https://app.megga.ch${edgeReturnPath()}`)
    expect(url.searchParams.get(VERIFICATION_RETURN_PARAM)).toBe(VERIFICATION_RETURN_VALUE)
  })

  it('le retour vise la route du gate d\'identité, seule route exemptée de redirection', () => {
    // Toute autre cible serait expulsée par shouldRedirectToIdentityGate tant que
    // identity_submitted_at est nul — c'est-à-dire précisément au moment du retour.
    const url = new URL(`https://app.megga.ch${edgeReturnPath()}`)
    expect(url.pathname).toBe(IDENTITY_GATE_ROUTE)
  })
})

describe('IDENTITY_VERIFICATION_STEP — où atterrir', () => {
  it('désigne l\'étape de vérification, pas un index écrit en dur', () => {
    expect(SG_IDENTITY_STEPS[IDENTITY_VERIFICATION_STEP]?.id).toBe('pieceIdentite')
  })

  it('reste dans les bornes du parcours', () => {
    // findIndex rend -1 sur une étape disparue : un tel index passerait clampIdentityStep
    // et renverrait le dirigeant à l'étape 1, ce que ce chantier corrige justement.
    expect(IDENTITY_VERIFICATION_STEP).toBeGreaterThanOrEqual(0)
    expect(IDENTITY_VERIFICATION_STEP).toBeLessThan(SG_IDENTITY_STEPS.length)
  })
})
