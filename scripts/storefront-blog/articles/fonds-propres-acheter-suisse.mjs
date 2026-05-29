import { MEGGA_EDITORIAL } from '../authors.mjs'

const article = {
  slug: 'fonds-propres-acheter-suisse',
  category: 'articles',
  categoryLabel: 'Financement',
  title: 'Combien de fonds propres pour acheter en Suisse ?',
  excerpt:
    "En Suisse, comptez au moins 20 % de fonds propres pour votre résidence principale, dont la moitié hors 2e pilier. Voici comment les réunir et calculer votre budget.",
  date: '2026-04-21',
  coverImage: '/images/sections/single-property/hero-3-kitchen.jpg',
  coverAlt: "Cuisine équipée d'un appartement en Suisse",
  author: MEGGA_EDITORIAL,
  body: [
    {
      type: 'paragraph',
      text: "Vous avez repéré l'appartement. La banque, elle, regarde d'abord une chose : combien vous mettez de votre poche. En Suisse, la règle de base est simple à énoncer et plus subtile à appliquer. Il faut au moins **20 % de fonds propres** pour acheter sa résidence principale. Mais tous les fonds propres ne se valent pas aux yeux du prêteur, et le montant que vous apportez ne fait que la moitié de l'équation. L'autre moitié, c'est votre capacité à porter la dette dans la durée.",
    },
    {
      type: 'callout',
      variant: 'info',
      title: "L'essentiel",
      text: "• Minimum **20 % de fonds propres** pour une résidence principale.\n• Au moins **10 %** doivent être des fonds propres « durs », c'est-à-dire venir d'ailleurs que du 2e pilier.\n• Les charges théoriques (calculées à un taux d'intérêt imputé d'environ **5 %**) ne doivent pas dépasser **un tiers** de votre revenu brut.\n• Le 2e pilier peut être retiré ou nanti : deux logiques opposées pour votre prévoyance.",
    },
    { type: 'heading', level: 2, text: 'Fonds propres durs ou souples : la distinction qui change tout' },
    {
      type: 'paragraph',
      text: "Les 20 % exigés se divisent en deux moitiés que la banque ne traite pas de la même manière. La première moitié, soit **au moins 10 % du prix d'achat**, doit être constituée de fonds propres dits « durs ». Ces fonds doivent provenir d'une source autre que votre caisse de pension. On y trouve votre épargne, votre 3e pilier 3a, une donation, ou encore des titres.",
    },
    {
      type: 'paragraph',
      text: "La seconde moitié, les **10 % restants**, peut venir de votre 2e pilier (LPP). Toute la nuance est là : votre avoir de prévoyance professionnelle est accepté, mais il ne peut jamais couvrir à lui seul l'apport. Le régulateur protège ainsi votre retraite. On ne vous laisse pas financer un achat uniquement avec l'argent censé vous faire vivre une fois le travail terminé.",
    },
    {
      type: 'callout',
      variant: 'tip',
      title: 'À retenir',
      text: "Sur un bien à CHF 1'000'000, les 20 % représentent CHF 200'000. De ce montant, CHF 100'000 au minimum doivent être des fonds propres durs, hors 2e pilier.",
    },
    { type: 'heading', level: 2, text: "D'où peuvent venir vos fonds propres" },
    {
      type: 'paragraph',
      text: "Réunir l'apport passe rarement par une seule source. La plupart des acquéreurs combinent plusieurs leviers. Voici ceux qui sont reconnus :",
    },
    {
      type: 'list',
      items: [
        '**Épargne** sur vos comptes (compte courant, compte épargne).',
        '**3e pilier** (3a lié ou 3b libre), un classique de la constitution d\'apport.',
        '**2e pilier** (LPP), dans la limite des 10 % « souples » évoqués plus haut.',
        '**Donation ou avancement d\'hoirie** : un coup de pouce familial, fréquent chez les primo-accédants.',
        '**Titres** (actions, obligations, fonds) que vous pouvez liquider.',
        '**Valeur d\'un autre bien** immobilier que vous possédez déjà.',
      ],
    },
    {
      type: 'paragraph',
      text: "Un mot sur la donation. Reçue d'un parent, elle compte comme fonds propres durs, au même titre que votre épargne. Pour beaucoup de jeunes ménages, c'est elle qui fait passer le dossier de « refusé » à « accepté ».",
    },
    { type: 'heading', level: 2, text: 'Le taux d\'effort : la règle du tiers' },
    {
      type: 'paragraph',
      text: "Avoir l'apport ne suffit pas. La banque vérifie ensuite que vous pouvez assumer le crédit sur le long terme. Elle calcule pour cela des charges théoriques, et c'est ici que les futurs acheteurs tombent souvent de haut.",
    },
    {
      type: 'paragraph',
      text: "Le prêteur n'utilise pas le taux d'intérêt réel du marché, qui peut être bas. Il applique un **taux d'intérêt imputé d'environ 5 %**. Ce taux prudent sert de coussin de sécurité : si les taux remontent un jour, votre dossier doit déjà tenir à ce niveau. À cet intérêt théorique, on ajoute l'amortissement de la dette, puis environ **1 %** de la valeur du bien pour l'entretien et les charges courantes.",
    },
    {
      type: 'paragraph',
      text: "La somme de ces trois postes ne doit pas dépasser **un tiers de votre revenu brut annuel**. C'est ce qu'on appelle la règle du tiers. Si vos charges théoriques franchissent ce seuil, la banque refuse le financement, même si vos fonds propres sont au rendez-vous et même si vous pourriez payer les mensualités réelles sans difficulté.",
    },
    {
      type: 'callout',
      variant: 'warning',
      title: 'Le piège du taux imputé',
      text: "Beaucoup de candidats raisonnent avec le taux hypothécaire actuel et concluent qu'ils ont les moyens. La banque, elle, calcule à environ 5 %. Un bien parfaitement payable au taux du jour peut devenir inaccessible une fois ce taux prudent appliqué.",
    },
    { type: 'heading', level: 2, text: 'Un exemple chiffré' },
    {
      type: 'paragraph',
      text: "Prenons un bien affiché à **CHF 1'000'000**. Voici comment se décompose l'apport minimal exigé.",
    },
    {
      type: 'table',
      columns: ['Poste', 'Pourcentage', 'Montant'],
      rows: [
        ['Prix du bien', '100 %', "CHF 1'000'000"],
        ['Fonds propres totaux', '20 %', "CHF 200'000"],
        ['dont fonds propres durs (hors 2e pilier)', '10 % minimum', "CHF 100'000"],
        ['dont part possible du 2e pilier', '10 % maximum', "CHF 100'000"],
        ['Hypothèque (dette)', '80 %', "CHF 800'000"],
      ],
      caption: "Répartition de l'apport pour un bien à CHF 1'000'000.",
    },
    {
      type: 'paragraph',
      text: "Dans ce cas de figure, vous devez donc réunir CHF 200'000, dont CHF 100'000 venant impérativement de votre épargne, d'un 3e pilier, d'une donation ou de titres. Les CHF 100'000 restants peuvent sortir de votre caisse de pension. La banque finance le solde, soit CHF 800'000.",
    },
    { type: 'heading', level: 2, text: 'L\'amortissement : direct ou indirect' },
    {
      type: 'paragraph',
      text: "Quand vous empruntez 80 %, la banque ne vous demande pas de tout rembourser. Elle exige en revanche que la dette redescende à environ **deux tiers de la valeur du bien**, soit près de **65 %**. Ce remboursement doit s'étaler sur **15 ans au maximum**, ou être achevé au plus tard à l'âge de la retraite si celle-ci arrive plus tôt.",
    },
    {
      type: 'paragraph',
      text: "Deux méthodes existent pour y parvenir, et le choix a des conséquences fiscales :",
    },
    {
      type: 'list',
      items: [
        '**Amortissement direct** : vous remboursez la banque par versements réguliers. La dette baisse, donc les intérêts aussi. En contrepartie, vos déductions fiscales liées aux intérêts diminuent au même rythme.',
        '**Amortissement indirect** : au lieu de rembourser la banque, vous versez sur un 3e pilier 3a nanti en faveur du prêteur. La dette reste stable, mais vous capitalisez en parallèle, et les versements 3a sont déductibles du revenu imposable. C\'est l\'option souvent privilégiée pour son avantage fiscal.',
      ],
    },
    { type: 'heading', level: 2, text: '2e pilier : faut-il retirer ou nantir ?' },
    {
      type: 'paragraph',
      text: "Si vous mobilisez votre LPP pour l'apport, vous avez deux portes. Le retrait et le nantissement répondent à des philosophies inverses. L'un sort l'argent de votre prévoyance, l'autre l'y laisse travailler.",
    },
    {
      type: 'table',
      columns: ['Critère', 'Retrait (versement anticipé)', 'Nantissement (mise en gage)'],
      rows: [
        ['Capital de prévoyance', 'Réduit', 'Reste investi et continue de produire des intérêts'],
        ['Effet sur la dette', 'La dette diminue', 'La dette reste élevée (donc plus d\'intérêts)'],
        ['Fiscalité immédiate', 'Impôt sur le versement en capital', 'Pas d\'impôt sur un retrait'],
        ['Prestations futures (rente, risque)', 'Diminuées, à reconstituer', 'Préservées'],
        ['Rôle dans le financement', 'Apport direct', 'Garantie apportée à la banque'],
      ],
      caption: 'Retrait contre nantissement du 2e pilier.',
    },
    {
      type: 'paragraph',
      text: "Le retrait allège votre dette et donc vos intérêts, mais il ampute votre capital retraite, déclenche un impôt sur le capital, et réduit votre couverture en cas de décès ou d'invalidité. Il faudra ensuite reconstituer cet avoir. Le nantissement, lui, laisse votre 2e pilier intact et investi. Vous gardez votre prévoyance, mais votre dette reste plus haute, ce qui pèse sur le calcul du taux d'effort.",
    },
    {
      type: 'callout',
      variant: 'warning',
      title: 'Information générale, à arbitrer avec un conseiller',
      text: "Toucher à son 2e pilier engage votre retraite, votre fiscalité et votre couverture risque pour des décennies. Le bon choix dépend de votre âge, de votre situation familiale et de vos revenus. Cet article donne des repères généraux : faites valider votre arbitrage par un conseiller financier ou en prévoyance avant toute décision.",
    },
    {
      type: 'paragraph',
      size: 14,
      text: "Au fond, acheter en Suisse se joue sur deux fronts en même temps. Réunir l'apport, et prouver que vous tiendrez la distance face au taux imputé. Maîtriser la règle des 20 % et celle du tiers avant même de visiter, c'est éviter de tomber amoureux d'un bien que la banque vous refusera.",
    },
  ],
  faq: [
    {
      q: 'Combien de fonds propres faut-il au minimum pour acheter en Suisse ?',
      a: "Au moins 20 % du prix d'achat pour une résidence principale. Sur ces 20 %, au moins la moitié (10 % du prix) doit être constituée de fonds propres « durs » provenant d'ailleurs que du 2e pilier.",
    },
    {
      q: "Qu'est-ce que la règle du tiers ?",
      a: "Vos charges théoriques annuelles ne doivent pas dépasser environ un tiers de votre revenu brut. Ces charges sont calculées avec un taux d'intérêt imputé d'environ 5 % (et non le taux réel), plus l'amortissement, plus environ 1 % pour l'entretien et les charges.",
    },
    {
      q: 'Vaut-il mieux retirer ou nantir son 2e pilier ?',
      a: "Le retrait réduit votre dette mais ampute votre capital retraite, génère un impôt sur le versement et diminue vos prestations futures. Le nantissement laisse l'avoir investi et préserve la prévoyance, mais maintient une dette plus élevée. Le choix dépend de votre situation et mérite un avis professionnel.",
    },
    {
      q: 'Quelle est la différence entre amortissement direct et indirect ?',
      a: "L'amortissement direct rembourse la banque, ce qui fait baisser la dette et les intérêts. L'amortissement indirect verse sur un 3e pilier 3a nanti : la dette reste stable, mais les versements sont déductibles fiscalement. La dette doit dans tous les cas descendre à environ deux tiers de la valeur du bien sous 15 ans.",
    },
    {
      q: 'Une donation familiale compte-t-elle comme fonds propres ?',
      a: "Oui. Une donation ou un avancement d'hoirie est considéré comme des fonds propres durs, au même titre que votre épargne ou votre 3e pilier. Elle peut donc servir à couvrir la part de 10 % qui ne peut pas venir du 2e pilier.",
    },
  ],
  sources: [
    { label: 'UBS — Guide hypothèque et fonds propres', url: 'https://www.ubs.com/ch/fr/private/mortgages/information/down-payment.html' },
    { label: 'Raiffeisen — Financement immobilier et fonds propres', url: 'https://www.raiffeisen.ch/fr/clients-prives/hypotheques.html' },
    { label: "Comparis — Fonds propres pour l'achat d'un logement", url: 'https://www.comparis.ch/hypotheken/info/eigenkapital' },
    { label: 'moneyland.ch — Hypothèques : ce qu\'il faut savoir', url: 'https://www.moneyland.ch/fr/hypotheque-suisse-guide' },
    { label: 'admin.ch — Encouragement à la propriété du logement (EPL)', url: 'https://www.bsv.admin.ch/bsv/fr/home/assurances-sociales/bv/grundlagen-und-gesetze/grundlagen/wef.html' },
  ],
}

export default article
