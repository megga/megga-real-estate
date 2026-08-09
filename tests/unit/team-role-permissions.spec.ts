// Les quatre rôles d'agence n'ont qu'UNE description, et elle dit la bonne chose.
//
// Deux surfaces montrent la même taxonomie : la carte de choix de l'étape 1 du wizard
// KYB (StepSignataire, où le rôle se DÉCLARE) et Réglages › Équipe (où il se change).
// Jusqu'au 09.08.2026 chacune portait sa propre copie — huit fichiers de traduction pour
// une seule taxonomie —, et les deux avaient déjà divergé : le rôle `agent` s'appelait
// « Agent » à l'onboarding et « Makler » dans les Réglages allemands. Depuis, `settings`
// est la source unique et l'onboarding la LIT (`useTranslation(['onboarding', 'settings'])`).
//
// Ce que ce fichier éprouve, dans l'ordre de ce qui casse le plus discrètement :
//
//  1. LA SOURCE UNIQUE TIENT. i18next affiche la CLÉ quand elle manque : réintroduire
//     `wizard.signataire.agencyRole.adminHint` d'un côté, ou retirer
//     `team.roleDescriptions` de l'autre, ne lève aucune erreur — ça écrit
//     « settings:team.roleDescriptions.admin » en toutes lettres au milieu du parcours
//     d'inscription, dans les quatre langues à la fois.
//
//  2. LE CUMUL EST ÉCRIT. Les descriptions sont rédigées en escalier (« tous les droits
//     Manager, plus… ») : elles ne se suffisent que si chaque niveau NOMME celui qu'il
//     reprend. La vérification se fait contre `team.roles.*` et non contre une chaîne
//     en dur, donc elle vaut dans les quatre langues sans les épeler — c'est ce qui
//     attrape « Makler » là où l'allemand aurait recopié « Agent ».
//
//  3. LES DEUX DÉCISIONS PRODUIT DU 09.08.2026 SONT AU BON ÉTAGE. La facturation
//     (abonnement, factures, moyens de paiement) DESCEND au Manager ; l'IBAN et les
//     coordonnées bancaires RESTENT à l'Admin seul. Ces deux-là ne se déduisent d'aucun
//     code — rien ne les applique encore côté RLS — donc rien d'autre ne les retiendrait :
//     une relecture de confort qui remonterait la facturation « pour faire propre »
//     passerait tous les autres gates.
//
// ⚠ Ce fichier n'éprouve PAS le rendu (ce dépôt n'a pas @testing-library/react) : il
// éprouve l'accord entre le composant, la liste des rôles et les quatre traductions.

import { describe, it, expect } from 'vitest'
import { AGENCY_DECLARED_ROLES } from '@/hooks/useAgencyIdentity'
// Préfixés `l` : `it` nu entrerait en collision avec le `it` de vitest — le fichier
// compile alors en apparence et casse au transform, pas à la lecture.
import sFr from '@/i18n/locales/fr/settings.json'
import sDe from '@/i18n/locales/de/settings.json'
import sEn from '@/i18n/locales/en/settings.json'
import sIt from '@/i18n/locales/it/settings.json'
import oFr from '@/i18n/locales/fr/onboarding.json'
import oDe from '@/i18n/locales/de/onboarding.json'
import oEn from '@/i18n/locales/en/onboarding.json'
import oIt from '@/i18n/locales/it/onboarding.json'

interface TeamRoleCopy {
  roles: Record<string, string>
  roleDescriptions: Record<string, string>
  roleHierarchy: string
  permissions: Record<string, string[]>
}

const REGLAGES = { fr: sFr, de: sDe, en: sEn, it: sIt } as unknown as Record<string, { team: TeamRoleCopy }>
const ONBOARDING = { fr: oFr, de: oDe, en: oEn, it: oIt } as unknown as Record<
  string,
  { wizard: { signataire: { agencyRole: Record<string, unknown> } } }
>
const LANGUES = ['fr', 'de', 'en', 'it']

/** Le bloc que StepSignataire et Réglages › Équipe lisent tous les deux. */
const equipe = (langue: string): TeamRoleCopy => REGLAGES[langue].team

describe('source unique — la taxonomie vit dans `settings`, pas en double', () => {
  it.each(LANGUES)('%s : les quatre rôles ont un libellé et une description', (langue) => {
    for (const role of AGENCY_DECLARED_ROLES) {
      expect(equipe(langue).roles[role], `roles.${role}`).toBeTruthy()
      expect(equipe(langue).roleDescriptions[role], `roleDescriptions.${role}`).toBeTruthy()
    }
    expect(equipe(langue).roleHierarchy).toBeTruthy()
  })

  it.each(LANGUES)('%s : l\'onboarding ne réintroduit pas sa propre copie', (langue) => {
    const agencyRole = ONBOARDING[langue].wizard.signataire.agencyRole
    // `lastAdminNotice` est la SEULE clé qui appartient encore à l'onboarding : elle
    // porte le garde-fou « dernier administrateur », qui n'a de sens qu'à la déclaration.
    expect(Object.keys(agencyRole)).toEqual(['lastAdminNotice'])
  })
})

describe('cumul — chaque niveau nomme celui dont il reprend les droits', () => {
  it.each(LANGUES)('%s : Admin reprend Manager, Manager reprend Agent', (langue) => {
    const { roles, permissions } = equipe(langue)
    expect(permissions.admin.join(' ')).toContain(roles.manager)
    expect(permissions.manager.join(' ')).toContain(roles.agent)
  })

  it.each(LANGUES)('%s : la règle de cumul cite les quatre rôles', (langue) => {
    const { roles, roleHierarchy } = equipe(langue)
    for (const role of AGENCY_DECLARED_ROLES) {
      expect(roleHierarchy, `roleHierarchy ne cite pas ${role}`).toContain(roles[role])
    }
  })
})

describe('étages — décisions produit du 09.08.2026', () => {
  // L'IBAN se dit « IBAN » dans les quatre langues ; la facturation, non — d'où
  // l'alternative, qui couvre abonnement/Abonnement/subscription/abbonamento.
  const FACTURATION = /abonnement|abbonamento|subscription/i

  it.each(LANGUES)('%s : l\'IBAN est chez l\'Admin, et nulle part en dessous', (langue) => {
    const { permissions } = equipe(langue)
    expect(permissions.admin.join(' ')).toMatch(/IBAN/)
    for (const role of ['manager', 'agent', 'assistant'] as const) {
      expect(permissions[role].join(' '), `IBAN ne doit pas descendre au rôle ${role}`).not.toMatch(/IBAN/)
    }
  })

  it.each(LANGUES)('%s : la facturation est au Manager, pas dupliquée chez l\'Admin', (langue) => {
    const { permissions } = equipe(langue)
    expect(permissions.manager.join(' ')).toMatch(FACTURATION)
    // Pas une omission : l'Admin l'a par le cumul, que la ligne « tous les droits du
    // rôle Manager » énonce déjà. La répéter ferait lire deux étages pour un seul droit.
    expect(permissions.admin.join(' ')).not.toMatch(FACTURATION)
    for (const role of ['agent', 'assistant'] as const) {
      expect(permissions[role].join(' '), `la facturation ne descend pas au rôle ${role}`).not.toMatch(FACTURATION)
    }
  })
})
