/**
 * La garde « aucun bien dans un message au client » (`message-sans-bien.ts`), éprouvée dans les deux
 * sens : ce qu'elle refuse ET ce qu'elle laisse passer. Une garde qui ne refuse rien ne protège pas ;
 * une garde qui refuse un rappel de visite se fait débrancher.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bienDansMessage, PORTAILS_ANNONCES, refusBienDansMessage } from './message-sans-bien.ts'

describe('bienDansMessage — ce qui est refusé', () => {
  it.each([
    ['https://www.homegate.ch/louer/4001234567', 'lien_annonce'],
    ['Regardez celui-ci : homegate.ch/acheter/4001234567 !', 'lien_annonce'],
    ['flatfox.ch/fr/flat/1234/', 'lien_annonce'],
    ['https://fr.comparis.ch/immobilien/marktplatz/details/show/12345', 'lien_annonce'],
    ['HTTPS://WWW.IMMOSCOUT24.CH/fr/d/appartement-louer-geneve/8123456', 'lien_annonce'],
    ['https://www.immobilier.ch/fr/louer/appartement/geneve/1234', 'lien_annonce'],
    ['https://app.getmegga.com/dashboard/listings/0f8fad5b-d9cb-469f-a165-70867728950e', 'fiche_megga'],
    ['https://app.getmegga.com/dashboard/market/0f8fad5b-d9cb-469f-a165-70867728950e', 'fiche_megga'],
    ['getmegga.com/propriete/0f8fad5b', 'fiche_megga'],
    ['Je vous propose le MG-IN-3F2A1C, idéal pour vous.', 'reference_bien'],
    ['réf. mg-fl-123456', 'reference_bien'],
    ['Le bien MG-MK-99887 correspond', 'reference_bien'],
  ])('%s → %s', (texte, motif) => {
    expect(bienDansMessage(texte)).toBe(motif)
  })

  it('lit TOUS les textes donnés : un bien dans l’objet seul suffit', () => {
    expect(bienDansMessage('Votre bien MG-IN-ABC123', 'Bonjour, à bientôt.')).toBe('reference_bien')
    expect(bienDansMessage(null, undefined, 'https://newhome.ch/fr/louer/immobilier/123')).toBe('lien_annonce')
  })
})

describe('bienDansMessage — ce qui passe', () => {
  it.each([
    // Le cas qui justifie la garde fine : une visite déjà fixée, sans lien ni référence.
    'Bonjour Madame Morand, je vous confirme notre visite de jeudi 25.09 à 14h, rue de Carouge 12. À jeudi !',
    'Suite à notre visite de l’appartement de Champel, avez-vous eu le temps d’y réfléchir ?',
    // Un portail NOMMÉ, sans lien vers une annonce (au vendeur, typiquement).
    'Votre bien sera publié sur homegate.ch et immobilier.ch dès lundi.',
    'https://www.homegate.ch/',
    // Une adresse e-mail sur le domaine d’un portail.
    'Écrivez à contact@immoscout24.ch pour la réclamation.',
    // Les liens MEGGA qui ne sont pas des biens.
    'Votre lien KYC : https://app.getmegga.com/kyc/eyJhbGciOi.abc',
    'Pour déplacer la visite : https://app.getmegga.com/visite/0f8fad5b/modifier',
    // Un montant : budget ou prix, la garde ne peut pas le dire (règle des prompts).
    'Votre budget de CHF 1’200’000 reste cohérent avec le marché.',
    // Un domaine qui IMITE un portail n’en est pas un.
    'https://attacker-flatfox.ch/fr/flat/1234',
    '',
  ])('%s', (texte) => {
    expect(bienDansMessage(texte)).toBeNull()
  })
})

describe('les portails', () => {
  it('contiennent TOUS ceux dont extract-property-url importe une annonce', () => {
    const source = readFileSync(join(process.cwd(), 'supabase/functions/extract-property-url/index.ts'), 'utf8')
    const bloc = source.match(/const ALLOWED_DOMAINS = \[([\s\S]*?)\]/)
    expect(bloc, 'ALLOWED_DOMAINS introuvable : la spec lit une liste qui a changé de forme').not.toBeNull()
    const domaines = [...bloc![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(domaines.length).toBeGreaterThan(5)
    for (const d of domaines) expect(PORTAILS_ANNONCES, d).toContain(d)
  })
})

describe('refusBienDansMessage', () => {
  it('dit que rien n’est parti et quoi faire à la place, en français comme en anglais', () => {
    expect(refusBienDansMessage('fr')).toMatch(/Rien n'est parti.*Je l'ai proposé/s)
    expect(refusBienDansMessage('en')).toMatch(/Nothing was sent.*I proposed it/s)
    expect(refusBienDansMessage(undefined)).toBe(refusBienDansMessage('fr'))
  })
})
