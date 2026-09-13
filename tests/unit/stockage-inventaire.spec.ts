/**
 * Inventaire du stockage navigateur — la porte qui garde le registre de
 * src/lib/stockageParCompte.ts VRAI (audit S11).
 *
 * POURQUOI. Une clé qu'aucun registre ne liste est une clé qu'aucune purge ne
 * vide : c'est exactement ainsi que la pile d'onglets, la vue impersonée et la
 * photo de l'agent passaient d'un compte au suivant. Toute écriture ou
 * suppression de stockage dans src/ (y compris via une variable : `storage?.setItem`)
 * doit donc appartenir à un fichier classé ici :
 *   • `appareil` — préférence ou drapeau du navigateur, sans donnée d'un compte ;
 *   • `compte`   — donnée d'un utilisateur : le fichier passe par le registre ;
 *   • `auth`     — la session d'auth-js elle-même.
 * Un nouveau fichier qui écrit du stockage fait rougir ce test tant qu'on n'a pas
 * DÉCIDÉ de quelle classe il relève.
 */
import { describe, it, expect } from 'vitest'
import { scanRoots, readFileSafely, rel, emptyRoots } from './helpers/fs-scan'
import { STOCKAGE_PAR_COMPTE } from '@/lib/stockageParCompte'

type Classe = 'appareil' | 'compte' | 'auth'

const INVENTAIRE: Record<string, { classe: Classe; motif: string }> = {
  'src/components/auth-bento/AuthBentoApp.tsx': { classe: 'appareil', motif: 'cookie de thème de l’écran d’auth' },
  'src/components/auth-bento/useCooldown.ts': { classe: 'appareil', motif: 'délai anti-rafale d’un formulaire, par onglet' },
  'src/components/crm-mobile/matching/MmMatchingSettings.tsx': { classe: 'appareil', motif: 'mode d’affichage du matching mobile' },
  'src/components/crm/biens/pager/BpTopGallery.tsx': { classe: 'appareil', motif: 'vue galerie/liste des biens' },
  'src/components/crm/settings/IntegrationsSection.tsx': { classe: 'appareil', motif: 'préférences de synchronisation d’agenda (booléens, aucun nom)' },
  'src/components/layout/LabGuardBanner.tsx': { classe: 'appareil', motif: 'bandeau LAB fermé (identifiant d’agence, aucun nom)' },
  'src/components/layout/StaleBundleDetector.tsx': { classe: 'appareil', motif: 'drapeau de rechargement après déploiement' },
  'src/components/matching-recherche/MatchingRechercheHybride.tsx': { classe: 'appareil', motif: 'vue de la recherche' },
  'src/hooks/useAgentNotifications.ts': { classe: 'compte', motif: 'état de lecture de la cloche, par uid' },
  'src/hooks/useAuth.tsx': { classe: 'compte', motif: 'clé de passage OAuth (megga_oauth_role) et purges de fin de session' },
  'src/hooks/useAvatar.ts': { classe: 'compte', motif: 'photo de l’agent, par uid' },
  'src/hooks/useCrmTabs.ts': { classe: 'compte', motif: 'miroir de la pile d’onglets, par uid:agence' },
  'src/hooks/useExternalListingActions.ts': { classe: 'compte', motif: 'notes sur annonces externes, par uid' },
  'src/hooks/useFavorites.ts': { classe: 'appareil', motif: 'invite de favoris déjà vue' },
  'src/hooks/useImpersonate.ts': { classe: 'compte', motif: 'vue impersonée, par uid de l’admin' },
  'src/hooks/useOnboardingCall.ts': { classe: 'appareil', motif: 'rappel d’accueil reporté (identifiants d’agence, aucun nom)' },
  'src/hooks/useTheme.tsx': { classe: 'appareil', motif: 'thème clair/sombre' },
  'src/i18n/index.ts': { classe: 'appareil', motif: 'langue de l’interface' },
  'src/lib/adminEntry.ts': { classe: 'appareil', motif: 'dernière page de console (chemin filtré, aucun nom)' },
  'src/lib/authStorage.ts': { classe: 'auth', motif: 'adaptateur de session d’auth-js' },
  'src/lib/crmDark.ts': { classe: 'appareil', motif: 'mode sombre du CRM' },
  'src/lib/crmSidebar.ts': { classe: 'appareil', motif: 'barre latérale repliée' },
  'src/lib/kycOnboarding.ts': { classe: 'appareil', motif: 'tutoriel KYC déjà vu' },
  'src/lib/staleChunkRecovery.ts': { classe: 'appareil', motif: 'drapeau de récupération d’un chunk périmé' },
  'src/lib/stockageParCompte.ts': { classe: 'compte', motif: 'le registre et ses purges' },
  'src/lib/supabase.ts': { classe: 'auth', motif: 'purge des jetons d’auth-js' },
  'src/pages/agent/CalendarPage.tsx': { classe: 'appareil', motif: 'invitation à connecter l’agenda déjà écartée' },
  'src/pages/agent/ImportLeadPage.tsx': { classe: 'compte', motif: 'brouillon d’import (clé exacte du registre)' },
  'src/pages/agent/ListingDetailPage.tsx': { classe: 'appareil', motif: 'prochaine visite d’un bien (date, heure, identifiant de contact — aucun nom)' },
  'src/pages/dev/bancSession.ts': { classe: 'auth', motif: 'banc : session de démonstration (absent du bundle de production)' },
  'src/pages/public/AuthCallbackPage.tsx': { classe: 'compte', motif: 'consomme la clé de passage OAuth (megga_oauth_role)' },
}

/** Les écritures et suppressions de stockage d'un source — littérales OU via une variable. */
function ecrituresDeStockage(code: string): string[] {
  return [...code.matchAll(/\.(setItem|removeItem)\s*\(|document\.cookie\s*=(?!=)/g)].map((m) => m[0])
}

const scan = scanRoots([{ root: 'src', keep: (n) => /\.(ts|tsx)$/.test(n) && !n.endsWith('.d.ts') }])
const sources = new Map<string, string>()
for (const abs of scan.files) {
  const lu = readFileSafely(abs)
  if (lu.status === 'ok') sources.set(rel(abs), lu.value)
}
const ecrivains = [...sources].filter(([, code]) => ecrituresDeStockage(code).length > 0).map(([f]) => f).sort()

describe('inventaire du stockage navigateur', () => {
  it('le balayage a lu l’arbre (contrôles positifs)', () => {
    expect(emptyRoots(scan)).toEqual([])
    expect(scan.unreadable).toEqual([])
    expect(ecrivains).toContain('src/hooks/useCrmTabs.ts')
  })

  it('le détecteur voit une écriture via une variable (contrôle du matcher)', () => {
    expect(ecrituresDeStockage("const storage = x; storage?.setItem('k', v)")).toHaveLength(1)
    expect(ecrituresDeStockage("localStorage.removeItem('k')")).toHaveLength(1)
    expect(ecrituresDeStockage('document.cookie = `a=b`')).toHaveLength(1)
    expect(ecrituresDeStockage("if (document.cookie == '') {}")).toHaveLength(0)
  })

  it('tout fichier qui écrit du stockage est classé, et tout classement vise un écrivain vivant', () => {
    const nonClasses = ecrivains.filter((f) => !(f in INVENTAIRE))
    const perimes = Object.keys(INVENTAIRE).filter((f) => !ecrivains.includes(f))
    expect({ nonClasses, perimes }).toEqual({ nonClasses: [], perimes: [] })
  })

  it('un fichier « compte » passe par le registre, ou y a sa clé littérale', () => {
    const bases = STOCKAGE_PAR_COMPTE.map((e) => e.base)
    const hors = Object.entries(INVENTAIRE)
      .filter(([, v]) => v.classe === 'compte')
      .filter(([f]) => {
        const code = sources.get(f) ?? ''
        return !code.includes("from '@/lib/stockageParCompte'") && f !== 'src/lib/stockageParCompte.ts'
          && !bases.some((b) => code.includes(`'${b}'`))
      })
      .map(([f]) => f)
    expect(hors).toEqual([])
  })

  it('ImportLeadPage garde la clé EXACTE que le registre purge (un renommage ne dé-purge pas en silence)', () => {
    const code = sources.get('src/pages/agent/ImportLeadPage.tsx') ?? ''
    const m = code.match(/const STORAGE_KEY\s*=\s*'([^']+)'/)
    expect(m?.[1]).toBe('megga.import-lead.state.v1')
    expect(STOCKAGE_PAR_COMPTE.some((e) => e.base === m?.[1] && e.forme === 'exacte' && e.sensible)).toBe(true)
  })

  it('le miroir d’onglets ne se lit plus sous sa clé fixe', () => {
    const code = sources.get('src/hooks/useCrmTabs.ts') ?? ''
    expect(code).not.toMatch(/getItem\(\s*CLE_MIROIR\s*\)/)
    expect(code).toMatch(/cleDuCompte\(CLE_MIROIR, user\.id, agenceDeLaPile\)/)
  })

  it('useAuth purge le stockage du compte à la déconnexion et au changement de compte', () => {
    const code = sources.get('src/hooks/useAuth.tsx') ?? ''
    expect(code).toMatch(/purgerStockageDesComptes\(stockagesNavigateur\(\), \{ mode: 'deconnexion' \}\)/)
    expect(code).toMatch(/purgerStockageDesComptes\(stockagesNavigateur\(\), \{ mode: 'changement', garder: uid \}\)/)
  })
})
