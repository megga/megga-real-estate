/**
 * Garde-fou CI : tout fichier de `.github/workflows/` doit être un YAML valide.
 *
 * Pourquoi un test : `deploy.yml` ne se déclenche QUE sur un push vers `main`.
 * Sa syntaxe n'est donc jamais éprouvée par la CI d'une PR — un fichier invalide
 * passe tous les checks au vert, puis GitHub refuse de le parser au merge et le
 * déploiement (migrations + edge functions) ne tourne plus du tout. C'est arrivé
 * le 25 juil. 2026 : une chaîne shell multi-lignes dont le guillemet fermant
 * retombait en colonne 1 refermait le scalaire de bloc `run: |`.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

const DIR = '.github/workflows'

describe('workflows GitHub Actions', () => {
  const files = readdirSync(DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))

  it('le dossier contient bien des workflows (sinon le test ne prouve rien)', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  /**
   * Corps `run:` de toutes les étapes, lignes de commentaire shell retirées.
   *
   * Le retrait n'est pas cosmétique : un `#` fait partie du scalaire `run:`, et les
   * commentaires qui expliquent les garde-fous ci-dessous CITENT les noms qu'ils
   * interdisent. Sans ce filtre, les tests rougiraient sur l'énoncé de leur propre raison
   * d'être. Règle volontairement simple (ligne dont le premier caractère non blanc est
   * `#`) : un nom de conteneur vit dans une commande, pas en fin de ligne après un dièse.
   */
  function scriptsShell() {
    const sorties: Array<{ ou: string; corps: string }> = []
    for (const f of files) {
      const doc = parse(readFileSync(join(DIR, f), 'utf-8')) as {
        jobs?: Record<string, { steps?: Array<{ name?: string; run?: string }> }>
      }
      for (const [job, corps] of Object.entries(doc.jobs ?? {})) {
        for (const step of corps.steps ?? []) {
          if (typeof step.run !== 'string') continue
          sorties.push({
            ou: `${f} › ${job} › ${step.name ?? 'étape sans nom'}`,
            corps: step.run.split('\n').filter(l => !/^\s*#/.test(l)).join('\n'),
          })
        }
      }
    }
    return sorties
  }

  /**
   * `supabase start` nomme ses conteneurs `supabase_<service>_<project_id>`, où `project_id`
   * est celui de `supabase/config.toml` — `zealous-faraday-34b2f5`, PAS le nom du dépôt.
   *
   * backend.yml et e2e.yml appelaient `docker logs supabase_db_megga-real-estate`, un nom
   * qui n'a jamais existé. Le `|| true` de fin de ligne avalait le « No such container », si
   * bien que l'étape « Print Supabase logs on failure » n'imprimait RIEN : la CI perdait les
   * logs Postgres au moment précis où elle cassait, c'est-à-dire quand on venait les lire.
   * Une panne muette ne se signale pas d'elle-même — d'où ce contrôle.
   */
  it('aucun nom de conteneur Supabase n’est figé dans un script shell', () => {
    // Seules formes légitimes : le PRÉFIXE d'un filtre (`--filter name=supabase_db_`, qui
    // s'arrête au tiret bas, donc ne matche pas ici) et une expansion de variable. Tout
    // suffixe littéral est un nom gravé, qui se périmera au prochain `project_id`.
    const NOM_FIGE = /supabase_[a-z]+_[A-Za-z0-9][\w.-]*/g
    // Sentinelles de repli : inexistantes EXPRÈS. Leur seul rôle est de faire dire
    // « No such container: … » à docker plutôt que de lui passer un argument vide.
    const SENTINELLES = new Set(['supabase_db_introuvable', 'supabase_auth_introuvable'])

    const fautifs: string[] = []
    for (const { ou, corps } of scriptsShell()) {
      for (const nom of corps.match(NOM_FIGE) ?? []) {
        if (!SENTINELLES.has(nom)) fautifs.push(`${ou} : ${nom}`)
      }
    }

    expect(
      fautifs,
      `nom(s) de conteneur figé(s) :\n  ${fautifs.join('\n  ')}\n` +
        'Le nom dérive du `project_id` de supabase/config.toml, pas du nom du dépôt. Le dériver :\n' +
        "  CONTENEUR=$(docker ps -a --filter name=supabase_db_ --format '{{.Names}}' | head -1)",
    ).toEqual([])
  })

  /**
   * Contrôle complémentaire du précédent, et c'est le plus utile des deux : il ne cherche
   * pas un nom fautif connu, il exige la bonne FORME. Un `docker logs` sur un littéral —
   * fût-il exact aujourd'hui — redeviendra muet le jour où le `project_id` changera.
   */
  it('chaque `docker logs` vise un conteneur dérivé, pas un littéral', () => {
    const appels = scriptsShell().flatMap(({ ou, corps }) =>
      corps
        .split('\n')
        .filter(l => /docker\s+logs/.test(l))
        .map(l => ({ ou, ligne: l.trim() })),
    )
    const fautifs = appels.filter(({ ligne }) => !/docker\s+logs\s+"?\$/.test(ligne))

    // Garde anti-contrôle creux : si les étapes de diagnostic disparaissaient, ce test
    // passerait au vert sans rien vérifier. 4 = deux workflows qui démarrent Supabase
    // (backend, e2e) × deux conteneurs lus (db, auth).
    expect(
      appels.length,
      'moins de 4 appels `docker logs` — étape de diagnostic supprimée, ou ce contrôle ne couvre plus rien',
    ).toBeGreaterThanOrEqual(4)
    expect(
      fautifs.map(({ ou, ligne }) => `${ou} : ${ligne}`),
      'ces `docker logs` visent un nom littéral. Ils se terminent par `|| true` : un nom mort ' +
        'n’y échoue pas, il se TAIT. Viser une variable dérivée — `docker logs "${CONTENEUR_DB:-…}"`.',
    ).toEqual([])
  })

  for (const f of files) {
    it(`${f} est un YAML valide`, () => {
      const raw = readFileSync(join(DIR, f), 'utf-8')
      const doc = parse(raw)
      expect(doc, `${f} : document vide`).toBeTruthy()
      expect(doc.jobs, `${f} : aucune clé « jobs » — le fichier a probablement été tronqué par un scalaire de bloc mal fermé`).toBeTruthy()
    })
  }

  /**
   * `supabase/setup-cli` avec `version: latest` résout la dernière release par un appel
   * NON authentifié à l'API GitHub. Sous charge, l'IP partagée des runners atteint la limite
   * et le job meurt AVANT tout travail utile — trois fois le 02.08.2026, dont un déploiement
   * de production. L'action n'accepte pas de `token`, et `supabase` n'est pas une dépendance
   * du dépôt (omettre `version` retomberait donc sur `latest`) : l'épinglage est la seule
   * parade, et rien ne la protégeait.
   *
   * ⚠ Ce test lit l'ARBRE des workflows, pas leur texte : une occurrence dans un commentaire
   * (il y en a une au-dessus de chaque étape, qui explique pourquoi) ne doit pas le faire
   * rougir, et un `latest` réintroduit dans une étape doit le faire rougir même si un
   * commentaire voisin dit le contraire.
   */
  it('aucune étape setup-cli ne résout la version par le réseau', () => {
    const fautifs: string[] = []
    let etapes = 0

    for (const f of files) {
      const doc = parse(readFileSync(join(DIR, f), 'utf-8')) as {
        jobs?: Record<string, { steps?: Array<{ uses?: string; with?: Record<string, unknown> }> }>
      }
      for (const [job, corps] of Object.entries(doc.jobs ?? {})) {
        for (const step of corps.steps ?? []) {
          if (!step.uses?.startsWith('supabase/setup-cli')) continue
          etapes++
          const v = step.with?.version
          if (typeof v !== 'string' || !/^\d+\.\d+\.\d+$/.test(v)) {
            fautifs.push(`${f} › ${job} : version=${JSON.stringify(v)}`)
          }
        }
      }
    }

    // Garde anti-contrôle creux : si plus aucune étape n'utilise l'action, ce test
    // passerait sans rien vérifier — le motif du vert sans assertion.
    expect(etapes, 'aucune étape supabase/setup-cli trouvée — ce contrôle ne prouve plus rien').toBeGreaterThanOrEqual(4)
    expect(
      fautifs,
      `version non épinglée sur ${fautifs.length} étape(s) :\n  ${fautifs.join('\n  ')}\n` +
        'Poser une version fixe (x.y.z) : `latest` résout par un appel API non authentifié qui ' +
        'tombe en rate limit sous charge et tue le job avant le premier test.',
    ).toEqual([])
  })
})
