/**
 * Le banc des rôles multiples (étape 3, 22.09.2026) : ses fixtures disent-elles ce que
 * l'écran montrera ?
 *
 * ⛔ UN BANC QUI MENT COÛTE PLUS QU'UN BANC ABSENT. `/dev/crm` n'a AUCUN déclencheur : en
 * base, `contacts_roles_sync` tient `roles` et `type` d'accord dans les deux sens ; ici,
 * rien. C'est donc cette spec qui rejoue la règle sur chaque ligne — sans elle, un
 * `type: 'seller'` resté sur des rôles d'acheteur se regarderait sans rougir, et on
 * corrigerait l'écran pour une faute de la fixture.
 *
 * ⚠ LES IDENTIFIANTS NE SONT PAS CEUX DU PLAN, et c'est mesuré. Le plan nommait « c3
 * (vendeur) », « c9 (lead) » et « c7 (both) » : ces trois-là sont aujourd'hui deux
 * acheteuses (Salomé Perret, Julie Morand) et une investisseuse (Emma Schneider) — le fil
 * de matchs et le lot C ont rempli le banc depuis. Ce sont les CAS de la conception qui
 * font foi, pas les identifiants : ils sont donc portés par les contacts qui SONT déjà ce
 * qu'ils éprouvent.
 */
import { describe, expect, it } from 'vitest'
import { CONTACTS } from '@/pages/dev/crmFixtures'
import { rolesOrdonnes, typeDeRoles } from '@/lib/contactRoles'

/** Les rôles d'une fixture, passés au même filtre que ceux d'une ligne de la base. */
const rolesDe = (id: string) => rolesOrdonnes(CONTACTS.find((c) => c.id === id)?.roles)

describe('les contacts du banc', () => {
  it('chaque contact porte des rôles connus, ordonnés', () => {
    for (const c of CONTACTS) {
      // `rolesOrdonnes` jette l'inconnu et range le reste : l'égalité échoue donc sur une
      // faute de frappe comme sur un ordre inventé, les deux cas qu'un banc sans base laisse passer.
      expect(rolesOrdonnes(c.roles), c.id).toEqual(c.roles)
    }
  })

  it('le type de chaque fixture est celui que le déclencheur poserait', () => {
    for (const c of CONTACTS) {
      expect(typeDeRoles(rolesOrdonnes(c.roles)), c.id).toBe(c.type)
    }
  })

  it('le banc porte les quatre cas de l’étape 3', () => {
    expect(rolesDe('c2')).toEqual(['seller', 'referrer', 'trustee']) // Théo Baumgartner : trois rôles
    expect(rolesDe('c8')).toEqual([]) // Léa Martin : aucun rôle, donc `lead`
    expect(rolesDe('c6')).toEqual(['buyer', 'seller']) // Olivier Mottier : l'acquéreur-vendeur
    expect(rolesDe('c14')).toEqual(['private_banker']) // Jean-Marc Dupraz : le réseau pur
  })
})
