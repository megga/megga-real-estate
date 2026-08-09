/**
 * Liste des pays pour les champs d'identité LBA (nationalité, pays de résidence).
 *
 * Les libellés français sont repris VERBATIM du bundle design « Contacts Beta v1 »
 * (constante NCB_PAYS) pour que les selects se lisent exactement comme dessinés.
 * Le code ISO 3166-1 alpha-2 est ce qui part en base : c'est le format déjà utilisé
 * par kyc_cases.contact_nationality et par les listes GAFI/FATF de constants.ts,
 * donc la seule représentation qui permette au pays de nourrir le scoring de risque.
 *
 * ⚠ Les codes périmés (SU, YU, FX, UK, HV, DY, TP…) sont volontairement exclus : Intl
 * leur attribue le même libellé français que le code officiel, et retenir « SU » pour
 * la Russie ou « HV » pour le Burkina Faso sortirait ces pays des listes FATF, qui sont
 * indexées sur RU et BF. Un code périmé ici = un contrôle de risque pays qui ne se
 * déclenche jamais.
 *
 * « Suisse » est en tête (défaut métier), le reste suit l'ordre alphabétique français.
 */

export interface Country {
  /** ISO 3166-1 alpha-2, majuscules — la valeur stockée en base. */
  code: string
  /** Libellé français affiché dans les selects. */
  name: string
}

export const COUNTRIES: readonly Country[] = [
  { code: 'CH', name: "Suisse" },
  { code: 'AF', name: "Afghanistan" },
  { code: 'ZA', name: "Afrique du Sud" },
  { code: 'AL', name: "Albanie" },
  { code: 'DZ', name: "Algérie" },
  { code: 'DE', name: "Allemagne" },
  { code: 'AD', name: "Andorre" },
  { code: 'AO', name: "Angola" },
  { code: 'SA', name: "Arabie saoudite" },
  { code: 'AR', name: "Argentine" },
  { code: 'AM', name: "Arménie" },
  { code: 'AU', name: "Australie" },
  { code: 'AT', name: "Autriche" },
  { code: 'AZ', name: "Azerbaïdjan" },
  { code: 'BS', name: "Bahamas" },
  { code: 'BH', name: "Bahreïn" },
  { code: 'BD', name: "Bangladesh" },
  { code: 'BB', name: "Barbade" },
  { code: 'BY', name: "Bélarus" },
  { code: 'BE', name: "Belgique" },
  { code: 'BZ', name: "Belize" },
  { code: 'BJ', name: "Bénin" },
  { code: 'BT', name: "Bhoutan" },
  { code: 'BO', name: "Bolivie" },
  { code: 'BA', name: "Bosnie-Herzégovine" },
  { code: 'BW', name: "Botswana" },
  { code: 'BR', name: "Brésil" },
  { code: 'BN', name: "Brunei" },
  { code: 'BG', name: "Bulgarie" },
  { code: 'BF', name: "Burkina Faso" },
  { code: 'BI', name: "Burundi" },
  { code: 'KH', name: "Cambodge" },
  { code: 'CM', name: "Cameroun" },
  { code: 'CA', name: "Canada" },
  { code: 'CV', name: "Cap-Vert" },
  { code: 'CL', name: "Chili" },
  { code: 'CN', name: "Chine" },
  { code: 'CY', name: "Chypre" },
  { code: 'CO', name: "Colombie" },
  { code: 'KM', name: "Comores" },
  { code: 'CG', name: "Congo" },
  { code: 'KP', name: "Corée du Nord" },
  { code: 'KR', name: "Corée du Sud" },
  { code: 'CR', name: "Costa Rica" },
  { code: 'CI', name: "Côte d’Ivoire" },
  { code: 'HR', name: "Croatie" },
  { code: 'CU', name: "Cuba" },
  { code: 'DK', name: "Danemark" },
  { code: 'DJ', name: "Djibouti" },
  { code: 'DM', name: "Dominique" },
  { code: 'EG', name: "Égypte" },
  { code: 'AE', name: "Émirats arabes unis" },
  { code: 'EC', name: "Équateur" },
  { code: 'ER', name: "Érythrée" },
  { code: 'ES', name: "Espagne" },
  { code: 'EE', name: "Estonie" },
  { code: 'SZ', name: "Eswatini" },
  { code: 'US', name: "États-Unis" },
  { code: 'ET', name: "Éthiopie" },
  { code: 'FJ', name: "Fidji" },
  { code: 'FI', name: "Finlande" },
  { code: 'FR', name: "France" },
  { code: 'GA', name: "Gabon" },
  { code: 'GM', name: "Gambie" },
  { code: 'GE', name: "Géorgie" },
  { code: 'GH', name: "Ghana" },
  { code: 'GR', name: "Grèce" },
  { code: 'GD', name: "Grenade" },
  { code: 'GT', name: "Guatemala" },
  { code: 'GN', name: "Guinée" },
  { code: 'GW', name: "Guinée-Bissau" },
  { code: 'GQ', name: "Guinée équatoriale" },
  { code: 'GY', name: "Guyana" },
  { code: 'HT', name: "Haïti" },
  { code: 'HN', name: "Honduras" },
  { code: 'HU', name: "Hongrie" },
  { code: 'MH', name: "Îles Marshall" },
  { code: 'SB', name: "Îles Salomon" },
  { code: 'IN', name: "Inde" },
  { code: 'ID', name: "Indonésie" },
  { code: 'IQ', name: "Irak" },
  { code: 'IR', name: "Iran" },
  { code: 'IE', name: "Irlande" },
  { code: 'IS', name: "Islande" },
  { code: 'IL', name: "Israël" },
  { code: 'IT', name: "Italie" },
  { code: 'JM', name: "Jamaïque" },
  { code: 'JP', name: "Japon" },
  { code: 'JO', name: "Jordanie" },
  { code: 'KZ', name: "Kazakhstan" },
  { code: 'KE', name: "Kenya" },
  { code: 'KG', name: "Kirghizistan" },
  { code: 'KI', name: "Kiribati" },
  { code: 'XK', name: "Kosovo" },
  { code: 'KW', name: "Koweït" },
  { code: 'LA', name: "Laos" },
  { code: 'LS', name: "Lesotho" },
  { code: 'LV', name: "Lettonie" },
  { code: 'LB', name: "Liban" },
  { code: 'LR', name: "Liberia" },
  { code: 'LY', name: "Libye" },
  { code: 'LI', name: "Liechtenstein" },
  { code: 'LT', name: "Lituanie" },
  { code: 'LU', name: "Luxembourg" },
  { code: 'MK', name: "Macédoine du Nord" },
  { code: 'MG', name: "Madagascar" },
  { code: 'MY', name: "Malaisie" },
  { code: 'MW', name: "Malawi" },
  { code: 'MV', name: "Maldives" },
  { code: 'ML', name: "Mali" },
  { code: 'MT', name: "Malte" },
  { code: 'MA', name: "Maroc" },
  { code: 'MU', name: "Maurice" },
  { code: 'MR', name: "Mauritanie" },
  { code: 'MX', name: "Mexique" },
  { code: 'FM', name: "Micronésie" },
  { code: 'MD', name: "Moldavie" },
  { code: 'MC', name: "Monaco" },
  { code: 'MN', name: "Mongolie" },
  { code: 'ME', name: "Monténégro" },
  { code: 'MZ', name: "Mozambique" },
  { code: 'MM', name: "Myanmar" },
  { code: 'NA', name: "Namibie" },
  { code: 'NR', name: "Nauru" },
  { code: 'NP', name: "Népal" },
  { code: 'NI', name: "Nicaragua" },
  { code: 'NE', name: "Niger" },
  { code: 'NG', name: "Nigeria" },
  { code: 'NO', name: "Norvège" },
  { code: 'NZ', name: "Nouvelle-Zélande" },
  { code: 'OM', name: "Oman" },
  { code: 'UG', name: "Ouganda" },
  { code: 'UZ', name: "Ouzbékistan" },
  { code: 'PK', name: "Pakistan" },
  { code: 'PW', name: "Palaos" },
  { code: 'PS', name: "Palestine" },
  { code: 'PA', name: "Panama" },
  { code: 'PG', name: "Papouasie-Nouvelle-Guinée" },
  { code: 'PY', name: "Paraguay" },
  { code: 'NL', name: "Pays-Bas" },
  { code: 'PE', name: "Pérou" },
  { code: 'PH', name: "Philippines" },
  { code: 'PL', name: "Pologne" },
  { code: 'PT', name: "Portugal" },
  { code: 'QA', name: "Qatar" },
  { code: 'CF', name: "République centrafricaine" },
  { code: 'CD', name: "République démocratique du Congo" },
  { code: 'DO', name: "République dominicaine" },
  { code: 'CZ', name: "République tchèque" },
  { code: 'RO', name: "Roumanie" },
  { code: 'GB', name: "Royaume-Uni" },
  { code: 'RU', name: "Russie" },
  { code: 'RW', name: "Rwanda" },
  { code: 'KN', name: "Saint-Kitts-et-Nevis" },
  { code: 'SM', name: "Saint-Marin" },
  { code: 'VC', name: "Saint-Vincent-et-les-Grenadines" },
  { code: 'LC', name: "Sainte-Lucie" },
  { code: 'SV', name: "Salvador" },
  { code: 'WS', name: "Samoa" },
  { code: 'ST', name: "São Tomé-et-Principe" },
  { code: 'SN', name: "Sénégal" },
  { code: 'RS', name: "Serbie" },
  { code: 'SC', name: "Seychelles" },
  { code: 'SL', name: "Sierra Leone" },
  { code: 'SG', name: "Singapour" },
  { code: 'SK', name: "Slovaquie" },
  { code: 'SI', name: "Slovénie" },
  { code: 'SO', name: "Somalie" },
  { code: 'SD', name: "Soudan" },
  { code: 'SS', name: "Soudan du Sud" },
  { code: 'LK', name: "Sri Lanka" },
  { code: 'SE', name: "Suède" },
  { code: 'SR', name: "Suriname" },
  { code: 'SY', name: "Syrie" },
  { code: 'TJ', name: "Tadjikistan" },
  { code: 'TZ', name: "Tanzanie" },
  { code: 'TD', name: "Tchad" },
  { code: 'TH', name: "Thaïlande" },
  { code: 'TL', name: "Timor oriental" },
  { code: 'TG', name: "Togo" },
  { code: 'TO', name: "Tonga" },
  { code: 'TT', name: "Trinité-et-Tobago" },
  { code: 'TN', name: "Tunisie" },
  { code: 'TM', name: "Turkménistan" },
  { code: 'TR', name: "Turquie" },
  { code: 'TV', name: "Tuvalu" },
  { code: 'UA', name: "Ukraine" },
  { code: 'UY', name: "Uruguay" },
  { code: 'VU', name: "Vanuatu" },
  { code: 'VA', name: "Vatican" },
  { code: 'VE', name: "Venezuela" },
  { code: 'VN', name: "Vietnam" },
  { code: 'YE', name: "Yémen" },
  { code: 'ZM', name: "Zambie" },
  { code: 'ZW', name: "Zimbabwe" },
] as const

/**
 * Libellé d'un code ISO dans la LANGUE demandée, ou le code brut s'il est inconnu.
 *
 * Le français vient de la liste ci-dessus, verbatim du bundle design ; les trois
 * autres langues viennent d'`Intl.DisplayNames`, c'est-à-dire de CLDR, livré par le
 * navigateur. Recopier 195 pays × 3 langues dans les fichiers de traduction aurait
 * produit 585 chaînes à maintenir à la main pour une donnée que la plateforme connaît
 * déjà, et que personne chez MEGGA n'est mieux placé pour écrire.
 *
 * ⚠ Le FRANÇAIS ne passe PAS par Intl, et c'est le point : ses libellés sont ceux du
 * design (« Corée du Sud », « États-Unis »), pas ceux de CLDR, qui diffèrent sur
 * plusieurs entrées. Les changer ferait dériver l'écran de sa maquette.
 *
 * Repli en cascade : Intl absent ou muet -> libellé français -> code brut. Un nom de
 * pays n'est jamais rendu vide ni en « undefined ».
 */
export function countryName(code: string | null | undefined, language?: string): string {
  if (!code) return ''
  const fr = COUNTRIES.find((c) => c.code === code)?.name
  const lang = (language ?? 'fr').slice(0, 2)
  if (lang === 'fr') return fr ?? code
  try {
    // `Intl.DisplayNames` rend le CODE lui-même quand il ne connaît pas la région :
    // on retombe alors sur le français plutôt que d'afficher « XK » à l'écran.
    const traduit = new Intl.DisplayNames([lang], { type: 'region' }).of(code)
    return traduit && traduit !== code ? traduit : (fr ?? code)
  } catch {
    return fr ?? code
  }
}

/**
 * La liste des pays TRIÉE et TRADUITE pour une langue : Suisse en tête (défaut
 * métier, comme dans COUNTRIES), le reste par ordre alphabétique DE CETTE LANGUE.
 *
 * Le tri est refait ici parce que l'ordre de COUNTRIES est alphabétique FRANÇAIS :
 * laissé tel quel en allemand, « Deutschland » se serait retrouvé entre « Danemark »
 * et « Algérie » selon la place que le français donne à « Allemagne ». `localeCompare`
 * avec la locale explicite range les accents et les caractères composés comme le
 * lecteur les attend.
 */
export function countriesInLanguage(language: string): Country[] {
  const lang = language.slice(0, 2)
  const traduits = COUNTRIES.map((c) => ({ code: c.code, name: countryName(c.code, lang) }))
  const suisse = traduits.filter((c) => c.code === 'CH')
  const reste = traduits
    .filter((c) => c.code !== 'CH')
    .sort((a, b) => a.name.localeCompare(b.name, lang))
  return [...suisse, ...reste]
}

/**
 * Indicatif téléphonique international par pays, sans le `+`.
 *
 * Une table SÉPARÉE et non un champ de plus sur `Country` : la liste ci-dessus sert
 * d'abord aux champs d'identité LBA (nationalité, pays de résidence), où l'indicatif
 * n'a rien à faire. Les deux se joignent par le code ISO là où c'est utile — le seul
 * appelant aujourd'hui est le champ WhatsApp de la réservation d'appel d'accueil.
 *
 * ⚠ Codes PARTAGÉS assumés : +1 couvre les États-Unis, le Canada et les Caraïbes
 * (BS, BB, DM, GD, JM, KN, LC, VC, TT), +7 la Russie et le Kazakhstan, +39 l'Italie et
 * le Vatican. Un numéro ne détermine donc pas le pays, et l'inverse non plus — cette
 * table sert à COMPOSER un numéro, jamais à en déduire une nationalité.
 *
 * ⚠ Le Kosovo (XK, code ISO de facto) porte +383, attribué par l'UIT en 2016.
 */
export const COUNTRY_DIAL_CODES: Readonly<Record<string, string>> = {
  CH: '41', AF: '93', ZA: '27', AL: '355', DZ: '213', DE: '49', AD: '376', AO: '244',
  SA: '966', AR: '54', AM: '374', AU: '61', AT: '43', AZ: '994', BS: '1', BH: '973',
  BD: '880', BB: '1', BY: '375', BE: '32', BZ: '501', BJ: '229', BT: '975', BO: '591',
  BA: '387', BW: '267', BR: '55', BN: '673', BG: '359', BF: '226', BI: '257', KH: '855',
  CM: '237', CA: '1', CV: '238', CL: '56', CN: '86', CY: '357', CO: '57', KM: '269',
  CG: '242', KP: '850', KR: '82', CR: '506', CI: '225', HR: '385', CU: '53', DK: '45',
  DJ: '253', DM: '1', EG: '20', AE: '971', EC: '593', ER: '291', ES: '34', EE: '372',
  SZ: '268', US: '1', ET: '251', FJ: '679', FI: '358', FR: '33', GA: '241', GM: '220',
  GE: '995', GH: '233', GR: '30', GD: '1', GT: '502', GN: '224', GW: '245', GQ: '240',
  GY: '592', HT: '509', HN: '504', HU: '36', MH: '692', SB: '677', IN: '91', ID: '62',
  IQ: '964', IR: '98', IE: '353', IS: '354', IL: '972', IT: '39', JM: '1', JP: '81',
  JO: '962', KZ: '7', KE: '254', KG: '996', KI: '686', XK: '383', KW: '965', LA: '856',
  LS: '266', LV: '371', LB: '961', LR: '231', LY: '218', LI: '423', LT: '370', LU: '352',
  MK: '389', MG: '261', MY: '60', MW: '265', MV: '960', ML: '223', MT: '356', MA: '212',
  MU: '230', MR: '222', MX: '52', FM: '691', MD: '373', MC: '377', MN: '976', ME: '382',
  MZ: '258', MM: '95', NA: '264', NR: '674', NP: '977', NI: '505', NE: '227', NG: '234',
  NO: '47', NZ: '64', OM: '968', UG: '256', UZ: '998', PK: '92', PW: '680', PS: '970',
  PA: '507', PG: '675', PY: '595', NL: '31', PE: '51', PH: '63', PL: '48', PT: '351',
  QA: '974', CF: '236', CD: '243', DO: '1', CZ: '420', RO: '40', GB: '44', RU: '7',
  RW: '250', KN: '1', SM: '378', VC: '1', LC: '1', SV: '503', WS: '685', ST: '239',
  SN: '221', RS: '381', SC: '248', SL: '232', SG: '65', SK: '421', SI: '386', SO: '252',
  SD: '249', SS: '211', LK: '94', SE: '46', SR: '597', SY: '963', TJ: '992', TZ: '255',
  TD: '235', TH: '66', TL: '670', TG: '228', TO: '676', TT: '1', TN: '216', TM: '993',
  TR: '90', TV: '688', UA: '380', UY: '598', VU: '678', VA: '39', VE: '58', VN: '84',
  YE: '967', ZM: '260', ZW: '263',
}

/**
 * Exemple de numéro LOCAL, groupé comme le pays l'écrit.
 *
 * Le groupement EST l'information : un Suisse lit « 79 874 94 84 », un Français
 * « 6 12 34 56 78 », un Allemand « 151 23456789 ». Montrer partout le format suisse
 * apprend un découpage faux à tous les autres.
 *
 * ⛔ COUVERTURE PARTIELLE, et c'est délibéré. Il n'y a ici que les pays dont le format
 * a été vérifié — Suisse et ses voisins, Europe de l'Ouest et du Nord, et les
 * juridictions d'où viennent réellement des dirigeants d'agence à Genève. Pour tous
 * les autres, l'exemple est VIDE : un format inventé serait pire que pas d'exemple,
 * puisqu'il enseignerait une ponctuation fausse avec l'autorité d'un placeholder.
 * Ajouter un pays ici demande de vérifier son groupement, pas de le deviner.
 *
 * Numéros de la plage réservée aux exemples quand le pays en publie une (UK 07400,
 * US 555-01xx) ; ailleurs, un préfixe mobile réel suivi de chiffres neutres.
 */
export const PHONE_EXAMPLES: Readonly<Record<string, string>> = {
  CH: '79 874 94 84', FR: '6 12 34 56 78', DE: '151 23456789', IT: '312 345 6789',
  AT: '664 123456', LI: '660 234 567', BE: '470 12 34 56', LU: '621 123 456',
  NL: '6 12345678', ES: '612 34 56 78', PT: '912 345 678', GB: '7400 123456',
  IE: '85 012 3456', DK: '32 12 34 56', SE: '70 123 45 67', NO: '406 12 345',
  FI: '41 2345678', IS: '611 1234', PL: '512 345 678', CZ: '601 123 456',
  SK: '912 123 456', HU: '20 123 4567', RO: '712 034 567', BG: '48 123 456',
  GR: '691 234 5678', HR: '91 234 5678', SI: '31 234 567', RS: '60 1234567',
  TR: '501 234 56 78', RU: '912 345 67 89', UA: '50 123 4567', US: '201 555 0123',
  CA: '506 234 5678', BR: '11 91234 5678', MX: '222 123 4567', AR: '11 2345 6789',
  MA: '650 123456', TN: '20 123 456', DZ: '551 23 45 67', EG: '100 123 4567',
  IL: '50 123 4567', AE: '50 123 4567', SA: '51 234 5678', QA: '3312 3456',
  IN: '81234 56789', CN: '131 2345 6789', JP: '90 1234 5678', KR: '10 2000 0000',
  SG: '8123 4567', AU: '412 345 678', NZ: '21 123 4567',
  ZA: '71 123 4567', SN: '70 123 45 67', CI: '01 23 45 67 89',
}

/**
 * Options du sélecteur d'indicatif, dans l'ordre des pays (Suisse en tête, puis
 * alphabétique français) : le dirigeant cherche son pays par son NOM.
 *
 * ⚠ La valeur est le code ISO, PAS l'indicatif. Dix pays partagent `+1`, l'Italie et
 * le Vatican `+39`, la Russie et le Kazakhstan `+7` : un `<select>` dont deux options
 * portent la même valeur sélectionne toujours la PREMIÈRE — choisir « Canada » aurait
 * affiché « Bahamas » au rendu suivant. L'ISO est aussi ce qui permet de retrouver le
 * bon exemple de numéro, que l'indicatif seul ne saurait pas désigner.
 */
export function dialCodeOptions(language: string): { value: string; label: string }[] {
  return countriesInLanguage(language)
    .filter((c) => COUNTRY_DIAL_CODES[c.code])
    .map((c) => ({ value: c.code, label: `${c.name} +${COUNTRY_DIAL_CODES[c.code]}` }))
}

/**
 * Sépare un numéro international en indicatif + reste. L'indicatif le PLUS LONG
 * gagne : +1 est un préfixe de rien, mais +37 le serait de +376 (Andorre) si on
 * comparait dans l'autre sens, et un Andorran se verrait attribuer un autre pays.
 * Rien ne matche -> tout part dans la partie locale, à l'utilisateur de choisir.
 */
export function splitDialCode(value: string): { dial: string; local: string } {
  const compact = value.replace(/[^\d+]/g, '')
  if (!compact.startsWith('+')) return { dial: '', local: compact }
  const codes = [...new Set(Object.values(COUNTRY_DIAL_CODES))].sort((a, b) => b.length - a.length)
  const found = codes.find((c) => compact.startsWith(`+${c}`))
  return found ? { dial: `+${found}`, local: compact.slice(found.length + 1) } : { dial: '', local: compact }
}

/**
 * Premier pays portant cet indicatif — pour repositionner le sélecteur (dont la
 * valeur est un ISO) après avoir décomposé un numéro déjà saisi, qui ne porte que
 * l'indicatif. Sur un indicatif partagé, « premier » veut dire premier dans l'ordre
 * de COUNTRIES : on ne peut pas mieux, un `+1` ne dit pas s'il est américain.
 */
export function countryForDialCode(dial: string): string | null {
  const nu = dial.replace('+', '')
  return COUNTRIES.find((c) => COUNTRY_DIAL_CODES[c.code] === nu)?.code ?? null
}
