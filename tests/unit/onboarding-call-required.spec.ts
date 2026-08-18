/**
 * Garde-fou : la prise de rendez-vous DIT ce qui manque.
 *
 * ⛔ CE QUI S'EST PASSÉ, le 18 août 2026. Un dirigeant choisit son créneau d'appel
 * d'accueil, répond aux quatre questions, clique « Retenir ce créneau » — et rien. Le
 * bouton était `disabled` parce qu'il avait oublié le TÉLÉPHONE, et l'écran ne le disait
 * nulle part : ni marque rouge, ni phrase, ni champ signalé. Ses mots : « c'est trompeur
 * car j'ai pas eu d'indication rouge ».
 *
 * Le commentaire du formulaire l'annonçait pourtant depuis le 9 août : « le gate reste
 * identiteComplete [...] mais l'écran ne l'annonce nulle part ». C'était vrai, et c'était
 * le défaut — un bouton grisé dit « non », il ne dit jamais « pourquoi ».
 *
 * ⚠ EN PRATIQUE LE TÉLÉPHONE EST LE SEUL PIÈGE POSSIBLE : prénom, nom et e-mail sont
 * préremplis ET verrouillés dès que l'identité du signataire est vérifiée. La règle les
 * couvre quand même — le verrou dépend d'un statut, et un statut change.
 */
import { describe, it, expect } from 'vitest'
import { champsRequisManquants, CHAMPS_REQUIS } from '@/components/onboarding-call/OcBooking'

const COMPLET = { firstName: 'Gregory', lastName: 'Lyonnet', email: 'g@megga.ch', phone: '791234567' }

describe('champsRequisManquants', () => {
  it('ne signale rien quand tout est rempli', () => {
    expect(champsRequisManquants(COMPLET)).toEqual([])
  })

  it('LE CAS RÉEL : tout sauf le téléphone', () => {
    expect(champsRequisManquants({ ...COMPLET, phone: '' })).toEqual(['phone'])
  })

  it('signale chaque champ vide, un par un', () => {
    for (const cle of CHAMPS_REQUIS) {
      expect(champsRequisManquants({ ...COMPLET, [cle]: '' })).toEqual([cle])
    }
  })

  it('rend les manquants dans l\'ordre de LECTURE du formulaire', () => {
    // C'est cet ordre qui décide où va le focus : le premier champ vide doit être le
    // premier qu'on rencontre en lisant, pas un autre.
    expect(champsRequisManquants({ firstName: '', lastName: '', email: '', phone: '' }))
      .toEqual(['firstName', 'lastName', 'email', 'phone'])
  })

  it('⚠ un champ qui ne contient que des ESPACES est vide', () => {
    // Sans le trim, « Retenir ce créneau » partirait avec un nom fait d'espaces, et
    // l'edge poserait une réservation au nom de personne.
    expect(champsRequisManquants({ ...COMPLET, lastName: '   ' })).toEqual(['lastName'])
    expect(champsRequisManquants({ ...COMPLET, phone: '\t \n' })).toEqual(['phone'])
  })

  it('les quatre champs exigés, et pas un de plus', () => {
    // Les quatre questions et la note restent LIBRES : les exiger transformerait un
    // questionnaire de préparation en formulaire barrage.
    expect(CHAMPS_REQUIS).toEqual(['firstName', 'lastName', 'email', 'phone'])
  })
})
