/**
 * Garde-fou : `execSql` vise la base du DÉPÔT, jamais celle d'un autre projet Supabase.
 *
 * Le helper sélectionnait le PREMIER conteneur `supabase_db_*` rendu par `docker ps`.
 * Or `docker ps` trie par date de création décroissante : dès qu'une seconde instance
 * locale tourne (autre projet, autre worktree), elle passe devant et `execSql` sème
 * dans la mauvaise base. Symptôme observé le 03.08.2026 : `relation "public.admin_log"
 * does not exist`, alors que la table existait bien côté megga — un échec sans rapport
 * avec le code testé, et impossible à relier à sa cause.
 *
 * Les deux fonctions de décision sont pures (elles reçoivent la sortie de `docker ps`
 * plutôt que de l'appeler) : ce spec les couvre sans Docker, donc il tourne partout et
 * ne peut pas passer à vide.
 */
import { describe, it, expect } from 'vitest'
import {
  pickDbContainer,
  assertUrlMatchesContainer,
  readProjectId,
} from '../backend/helpers/local-sql'

const MEGGA = 'supabase_db_zealous-faraday-34b2f5'
const AUTRE = 'supabase_db_leon-website'

describe('pickDbContainer', () => {
  it('retient le conteneur du project_id même si un autre projet est listé avant', () => {
    // L'ordre exact observé le 03.08.2026 : l'instance créée en dernier passe devant.
    expect(pickDbContainer({ running: [AUTRE, MEGGA], projectId: 'zealous-faraday-34b2f5' }))
      .toBe(MEGGA)
  })

  it('honore SUPABASE_TEST_DB_CONTAINER, qui l’emporte sur le project_id', () => {
    expect(pickDbContainer({ running: [AUTRE, MEGGA], projectId: 'zealous-faraday-34b2f5', override: AUTRE }))
      .toBe(AUTRE)
  })

  it('lève si le conteneur imposé par l’override ne tourne pas', () => {
    expect(() => pickDbContainer({ running: [MEGGA], projectId: null, override: 'supabase_db_fantome' }))
      .toThrow(/supabase_db_fantome/)
  })

  it('lève en nommant le projet quand SON conteneur ne tourne pas, plutôt que d’en prendre un autre', () => {
    // Le cas le plus insidieux : une seule instance tourne, mais ce n'est pas la nôtre.
    // Le repli « premier de la liste » y produisait un succès silencieux sur la mauvaise base.
    expect(() => pickDbContainer({ running: [AUTRE], projectId: 'zealous-faraday-34b2f5' }))
      .toThrow(/supabase_db_zealous-faraday-34b2f5/)
  })

  it('ne confond pas deux projets dont l’un préfixe l’autre', () => {
    // `docker ps --filter name=` matche par sous-chaîne : la sélection exacte se fait ici.
    expect(pickDbContainer({ running: ['supabase_db_megga-bis', 'supabase_db_megga'], projectId: 'megga' }))
      .toBe('supabase_db_megga')
  })

  it('replie sur l’unique conteneur quand le project_id est illisible', () => {
    expect(pickDbContainer({ running: [MEGGA], projectId: null })).toBe(MEGGA)
  })

  it('lève en nommant les candidats quand le project_id est illisible et que plusieurs tournent', () => {
    let message = ''
    try {
      pickDbContainer({ running: [AUTRE, MEGGA], projectId: null })
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain(AUTRE)
    expect(message).toContain(MEGGA)
    // Le message doit dire comment trancher, pas seulement constater l'ambiguïté.
    expect(message).toContain('SUPABASE_TEST_DB_CONTAINER')
  })

  it('lève quand aucun conteneur supabase_db_* ne tourne', () => {
    expect(() => pickDbContainer({ running: [], projectId: 'zealous-faraday-34b2f5' }))
      .toThrow(/supabase start/)
  })
})

describe('assertUrlMatchesContainer', () => {
  const kongMegga = 'supabase_kong_zealous-faraday-34b2f5\t8001/tcp, 8443-8444/tcp, 0.0.0.0:54321->8000/tcp, [::]:54321->8000/tcp'
  const kongAutre = 'supabase_kong_leon-website\t8001/tcp, 8443-8444/tcp, 0.0.0.0:54421->8000/tcp, [::]:54421->8000/tcp'

  it('accepte quand le port de SUPABASE_TEST_URL est publié par le kong du même projet', () => {
    expect(() => assertUrlMatchesContainer({
      container: MEGGA,
      testUrl: 'http://127.0.0.1:54321',
      kongRows: [kongAutre, kongMegga],
    })).not.toThrow()
  })

  it('lève quand SUPABASE_TEST_URL désigne l’instance d’un AUTRE projet', () => {
    // Le désaccord exact à rendre impossible : les specs lisent via PostgREST sur 54421
    // pendant qu'execSql sème dans la base de megga.
    let message = ''
    try {
      assertUrlMatchesContainer({ container: MEGGA, testUrl: 'http://127.0.0.1:54421', kongRows: [kongAutre, kongMegga] })
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain('54421')
    expect(message).toContain('54321')
    expect(message).toContain(MEGGA)
  })

  it('lève quand SUPABASE_TEST_URL n’est pas locale', () => {
    expect(() => assertUrlMatchesContainer({
      container: MEGGA,
      testUrl: 'https://eayczugyrvmtqnnmvjod.supabase.co',
      kongRows: [kongMegga],
    })).toThrow(/local/i)
  })

  it('ne juge pas quand le kong du projet n’est pas listé', () => {
    // `supabase start -x kong` reste possible : on ne fabrique pas un verdict sans preuve.
    expect(() => assertUrlMatchesContainer({
      container: MEGGA,
      testUrl: 'http://127.0.0.1:54321',
      kongRows: [kongAutre],
    })).not.toThrow()
  })
})

describe('readProjectId', () => {
  it('lit le project_id du supabase/config.toml du dépôt', () => {
    // Si ce parse casse (fichier déplacé, format changé), la sélection se replierait
    // silencieusement sur « premier de la liste » — c'est-à-dire sur le bug d'origine.
    expect(readProjectId()).toMatch(/^[a-z0-9][a-z0-9-]*$/)
  })
})
