// Correspondance code postal suisse (NPA) → canton.
//
// POURQUOI CE MODULE EXISTE
// -----------------------------------------------------------------------------
// realadvisor-sync et flatfox-sync portaient chacun leur COPIE d'une table de 66
// plages calées sur des blocs de 100 NPA. Les frontières cantonales suisses ne
// suivent pas les centaines : cette approximation attribuait le mauvais canton à
// 519 des 3 177 NPA réels (16,3 %), soit 19 541 annonces en base rangées ailleurs
// qu'où elles sont. Elle avait trois défauts structurels :
//
//   1. Quatre cantons n'étaient JAMAIS émis — GL, NW, OW, UR. Un cinquième, AI,
//      n'était émis que par [9700,9799], une plage MORTE : le NPA suisse le plus
//      haut est 9658 (Wildhaus). Ces 5 cantons affichaient donc 0 bien en base
//      alors que RealAdvisor en sert 422 : Altdorf (6460) partait en SZ, Sarnen
//      (6060) en LU, Stans (6370) en ZG, Glaris (8750) en TG, Appenzell (9050)
//      en SG. Deux autres plages étaient mortes aussi : [9800,9899]→GR (GR
//      s'arrête à 7748) et [9900,9999]→SG.
//   2. Des blocs entiers volés au canton voisin, bien au-delà des 5 cantons
//      invisibles : tout le district de Nyon (1260-1279, VD) comptait en GE, ce
//      qui tirait la médiane genevoise du prix au m² d'environ 29 % vers le bas.
//   3. Le repli sur le libellé de canton de la source était du CODE MORT : les
//      66 plages pavaient 1000-9999 sans trou, donc la boucle retournait toujours
//      avant de l'atteindre. La source pouvait dire « Uri » en toutes lettres, on
//      écrivait quand même SZ.
//
// La table ci-dessous est dérivée du registre officiel des localités de swisstopo
// (« Amtliches Ortschaftenverzeichnis mit PLZ und Perimeter », art. 24 ONgeo) :
// https://data.geo.admin.ch/ch.swisstopo-vd.ortschaftenverzeichnis_plz/
// Pour chaque NPA, canton dominant en part d'adresses, puis fusion des NPA
// consécutifs de même canton. Vérifiée à 0 erreur sur les 3 177 NPA du registre.
//
// ⚠ 251 entrées, et c'est le prix de l'exactitude : il n'existe AUCUNE table de
//   66 lignes qui soit juste. Ne pas « simplifier » ceci en regroupant par blocs.
// ⚠ Les plages s'arrêtent à 9658. Au-delà, on retombe volontairement sur
//   STATE_MAP — c'est le seul moyen de traiter un code postal étranger.

export const NPA_RANGES: Array<[number, number, string]> = [
  [1000, 1197, 'VD'], [1198, 1258, 'GE'], [1259, 1279, 'VD'], [1280, 1290, 'GE'],
  [1291, 1291, 'VD'], [1292, 1294, 'GE'], [1295, 1297, 'VD'], [1298, 1298, 'GE'],
  [1299, 1464, 'VD'], [1465, 1489, 'FR'], [1490, 1526, 'VD'], [1527, 1529, 'FR'],
  [1530, 1530, 'VD'], [1531, 1534, 'FR'], [1535, 1538, 'VD'], [1539, 1542, 'FR'],
  [1543, 1543, 'VD'], [1544, 1544, 'FR'], [1545, 1552, 'VD'], [1553, 1553, 'FR'],
  [1554, 1562, 'VD'], [1563, 1564, 'FR'], [1565, 1565, 'VD'], [1566, 1568, 'FR'],
  [1569, 1580, 'VD'], [1581, 1583, 'FR'], [1584, 1608, 'VD'], [1609, 1609, 'FR'],
  [1610, 1610, 'VD'], [1611, 1611, 'FR'], [1612, 1613, 'VD'], [1614, 1656, 'FR'],
  [1657, 1657, 'BE'], [1658, 1660, 'VD'], [1661, 1681, 'FR'], [1682, 1683, 'VD'],
  [1684, 1737, 'FR'], [1738, 1738, 'BE'], [1739, 1796, 'FR'], [1797, 1797, 'BE'],
  [1798, 1867, 'VD'], [1868, 1875, 'VS'], [1876, 1885, 'VD'], [1886, 1891, 'VS'],
  [1892, 1892, 'VD'], [1893, 1997, 'VS'], [1998, 2325, 'NE'], [2326, 2333, 'BE'],
  [2334, 2364, 'JU'], [2365, 2416, 'NE'], [2417, 2520, 'BE'], [2521, 2525, 'NE'],
  [2526, 2538, 'BE'], [2539, 2540, 'SO'], [2541, 2543, 'BE'], [2544, 2545, 'SO'],
  [2546, 2713, 'BE'], [2714, 2714, 'JU'], [2715, 2717, 'BE'], [2718, 2718, 'JU'],
  [2719, 2738, 'BE'], [2739, 2740, 'JU'], [2741, 2762, 'BE'], [2763, 2813, 'JU'],
  [2814, 2814, 'BL'], [2815, 2954, 'JU'], [2955, 3174, 'BE'], [3175, 3175, 'FR'],
  [3176, 3177, 'BE'], [3178, 3178, 'FR'], [3179, 3179, 'BE'], [3180, 3182, 'FR'],
  [3183, 3183, 'BE'], [3184, 3186, 'FR'], [3187, 3208, 'BE'], [3209, 3216, 'FR'],
  [3217, 3252, 'BE'], [3253, 3254, 'SO'], [3255, 3274, 'BE'], [3275, 3280, 'FR'],
  [3281, 3283, 'BE'], [3284, 3286, 'FR'], [3287, 3306, 'BE'], [3307, 3307, 'SO'],
  [3308, 3800, 'BE'], [3801, 3801, 'VS'], [3802, 3864, 'BE'], [3865, 3999, 'VS'],
  [4000, 4059, 'BS'], [4060, 4107, 'BL'], [4108, 4116, 'SO'], [4117, 4117, 'BL'],
  [4118, 4118, 'SO'], [4119, 4124, 'BL'], [4125, 4126, 'BS'], [4127, 4142, 'BL'],
  [4143, 4143, 'SO'], [4144, 4144, 'BL'], [4145, 4146, 'SO'], [4147, 4203, 'BL'],
  [4204, 4206, 'SO'], [4207, 4207, 'BL'], [4208, 4208, 'SO'], [4209, 4225, 'BL'],
  [4226, 4234, 'SO'], [4235, 4244, 'BL'], [4245, 4245, 'SO'], [4246, 4246, 'BL'],
  [4247, 4252, 'SO'], [4253, 4302, 'BL'], [4303, 4303, 'AG'], [4304, 4304, 'BL'],
  [4305, 4334, 'AG'], [4335, 4411, 'BL'], [4412, 4413, 'SO'], [4414, 4419, 'BL'],
  [4420, 4421, 'SO'], [4422, 4467, 'BL'], [4468, 4468, 'SO'], [4469, 4497, 'BL'],
  [4498, 4535, 'SO'], [4536, 4539, 'BE'], [4540, 4658, 'SO'], [4659, 4665, 'AG'],
  [4666, 4703, 'SO'], [4704, 4704, 'BE'], [4705, 4719, 'SO'], [4720, 4805, 'AG'],
  [4806, 4806, 'LU'], [4807, 4856, 'AG'], [4857, 4914, 'BE'], [4915, 4915, 'LU'],
  [4916, 4955, 'BE'], [4956, 5004, 'AG'], [5005, 5015, 'SO'], [5016, 5734, 'AG'],
  [5735, 5735, 'LU'], [5736, 5745, 'AG'], [5746, 5746, 'SO'], [5747, 6039, 'LU'],
  [6040, 6042, 'AG'], [6043, 6048, 'LU'], [6049, 6052, 'NW'], [6053, 6078, 'OW'],
  [6079, 6086, 'BE'], [6087, 6196, 'LU'], [6197, 6197, 'BE'], [6198, 6295, 'LU'],
  [6296, 6343, 'ZG'], [6344, 6344, 'LU'], [6345, 6345, 'ZG'], [6346, 6356, 'LU'],
  [6357, 6376, 'NW'], [6377, 6377, 'UR'], [6378, 6388, 'NW'], [6389, 6390, 'OW'],
  [6391, 6403, 'SZ'], [6404, 6404, 'LU'], [6405, 6440, 'SZ'], [6441, 6441, 'UR'],
  [6442, 6443, 'SZ'], [6444, 6493, 'UR'], [6494, 6533, 'TI'], [6534, 6565, 'GR'],
  [6566, 6999, 'TI'], [7000, 7307, 'GR'], [7308, 7326, 'SG'], [7327, 7748, 'GR'],
  [7749, 8108, 'ZH'], [8109, 8109, 'AG'], [8110, 8197, 'ZH'], [8198, 8243, 'SH'],
  [8244, 8248, 'ZH'], [8249, 8259, 'TG'], [8260, 8263, 'SH'], [8264, 8280, 'TG'],
  [8281, 8354, 'ZH'], [8355, 8376, 'TG'], [8377, 8453, 'ZH'], [8454, 8455, 'SH'],
  [8456, 8499, 'ZH'], [8500, 8522, 'TG'], [8523, 8523, 'ZH'], [8524, 8537, 'TG'],
  [8538, 8545, 'ZH'], [8546, 8547, 'TG'], [8548, 8548, 'ZH'], [8549, 8599, 'TG'],
  [8600, 8637, 'ZH'], [8638, 8646, 'SG'], [8647, 8714, 'ZH'], [8715, 8739, 'SG'],
  [8740, 8750, 'GL'], [8751, 8751, 'UR'], [8752, 8784, 'GL'], [8785, 8805, 'ZH'],
  [8806, 8808, 'SZ'], [8809, 8825, 'ZH'], [8826, 8832, 'SZ'], [8833, 8833, 'ZH'],
  [8834, 8864, 'SZ'], [8865, 8868, 'GL'], [8869, 8873, 'SG'], [8874, 8874, 'GL'],
  [8875, 8898, 'SG'], [8899, 8904, 'ZH'], [8905, 8905, 'AG'], [8906, 8915, 'ZH'],
  [8916, 8919, 'AG'], [8920, 8955, 'ZH'], [8956, 8967, 'AG'], [8968, 9034, 'SG'],
  [9035, 9035, 'AR'], [9036, 9036, 'SG'], [9037, 9044, 'AR'], [9045, 9050, 'AI'],
  [9051, 9053, 'AR'], [9054, 9054, 'AI'], [9055, 9056, 'AR'], [9057, 9058, 'AI'],
  [9059, 9107, 'AR'], [9108, 9108, 'AI'], [9109, 9112, 'AR'], [9113, 9212, 'SG'],
  [9213, 9225, 'TG'], [9226, 9305, 'SG'], [9306, 9306, 'TG'], [9307, 9313, 'SG'],
  [9314, 9322, 'TG'], [9323, 9323, 'SG'], [9324, 9326, 'TG'], [9327, 9404, 'SG'],
  [9405, 9411, 'AR'], [9412, 9413, 'AI'], [9414, 9425, 'SG'], [9426, 9428, 'AR'],
  [9429, 9484, 'SG'], [9485, 9498, 'FL'], [9499, 9500, 'SG'], [9501, 9508, 'TG'],
  [9509, 9512, 'SG'], [9513, 9517, 'TG'], [9518, 9527, 'SG'], [9528, 9532, 'TG'],
  [9533, 9534, 'SG'], [9535, 9535, 'TG'], [9536, 9536, 'SG'], [9537, 9548, 'TG'],
  [9549, 9552, 'SG'], [9553, 9573, 'TG'], [9574, 9658, 'SG'],
]

// NPA à cheval sur au moins deux cantons (second canton >= 10 % des adresses au
// registre). NPA_RANGES y renvoie le canton majoritaire en nombre d'adresses,
// ce qui peut être faux pour une annonce donnée : la réponse n'est PAS
// déterminable à partir du seul NPA. Quand la source fournit son propre libellé
// de canton et qu'il fait partie des candidats, c'est lui qui tranche.
export const NPA_AMBIGUS: Record<number, string[]> = {
  1290: ['GE', 'VD'],       // Versoix GE / Chavannes-des-Bois VD
  1410: ['VD', 'FR'],       // Thierrens, Correvon VD / Prévondavaux FR
  1534: ['FR', 'VD'],       // Chapelle (Broye) FR / Sassel VD
  1565: ['VD', 'FR'],       // Missy VD / Vallon FR — 50/50
  1595: ['VD', 'FR'],       // Faoug VD / Clavaleyres FR — 50/50
  1608: ['VD', 'FR'],       // Oron-le-Châtel VD / Chapelle (Glâne) FR
  1738: ['BE', 'FR'],       // Sangernboden
  1787: ['FR', 'VD'],       // Môtier (Vully) FR / Mur (Vully) VD
  2345: ['JU', 'BE'],       // Les Breuleux JU / Le Cerneux-Veusil BE
  2748: ['BE', 'JU'],       // Souboz BE / Les Ecorcheresses JU
  2827: ['JU', 'BE', 'SO'], // Mervelier JU / Schelten BE+SO
  3206: ['BE', 'FR'],       // Rizenbach, Ferenbalm BE / Wallenbuch FR
  3801: ['VS', 'BE'],       // Jungfraujoch — Fieschertal VS / Lauterbrunnen BE
  4564: ['SO', 'BE'],       // Obergerlafingen SO / Zielebach BE — 50/50
  5017: ['AG', 'SO'],       // Barmelweid
  6010: ['LU', 'OW'],       // Kriens LU / Pilatus Kulm OW
  6340: ['ZG', 'ZH'],       // Baar ZG / Sihlbrugg ZH
  6356: ['LU', 'SZ'],       // Rigi Kaltbad
  6388: ['NW', 'OW'],       // Grafenort NW / Engelberg OW
  6452: ['UR', 'SZ'],       // Sisikon UR / Riemenstalden SZ
  7315: ['SG', 'GR'],       // Vättis
  8212: ['SH', 'ZH'],       // Neuhausen am Rheinfall SH / Nohl ZH
  8495: ['ZH', 'TG'],       // Schmidrüti
  8525: ['TG', 'ZH'],       // Niederneunforn, Wilen b. Neunforn
  8546: ['TG', 'ZH'],       // Islikon, Kefikon TG
  8640: ['SG', 'SZ'],       // Rapperswil SG / Hurden SZ
  8866: ['GL', 'SG'],       // Ziegelbrücke — Niederurnen GL / Schänis SG
  8872: ['SG', 'GL'],       // Weesen
  9105: ['AR', 'SG'],       // Schönengrund AR / périmètre Neckertal SG
  9442: ['SG', 'AI'],       // Berneck SG / Büriswilen AI
}

// Libellé de canton d'une source → code à 2 lettres. Sert de repli quand le NPA
// est absent, étranger ou hors registre, et d'arbitre sur les NPA ambigus.
export const STATE_MAP: Record<string, string> = {
  'Genève': 'GE', 'Geneva': 'GE', 'Genf': 'GE',
  'Vaud': 'VD', 'Waadt': 'VD',
  'Valais': 'VS', 'Wallis': 'VS',
  'Neuchâtel': 'NE', 'Fribourg': 'FR', 'Freiburg': 'FR',
  'Jura': 'JU', 'Berne': 'BE', 'Bern': 'BE',
  'Zurich': 'ZH', 'Zürich': 'ZH', 'Lucerne': 'LU', 'Luzern': 'LU',
  'Zoug': 'ZG', 'Zug': 'ZG', 'Schwyz': 'SZ', 'Tessin': 'TI', 'Ticino': 'TI',
  'Grisons': 'GR', 'Graubünden': 'GR', 'Bâle-Ville': 'BS', 'Basel-Stadt': 'BS',
  'Bâle-Campagne': 'BL', 'Basel-Landschaft': 'BL', 'Argovie': 'AG', 'Aargau': 'AG',
  'Soleure': 'SO', 'Solothurn': 'SO', 'Thurgovie': 'TG', 'Thurgau': 'TG',
  'Schaffhouse': 'SH', 'Schaffhausen': 'SH', 'Saint-Gall': 'SG', 'St. Gallen': 'SG',
  'Appenzell Rhodes-Extérieures': 'AR', 'Appenzell Ausserrhoden': 'AR',
  'Appenzell Rhodes-Intérieures': 'AI', 'Appenzell Innerrhoden': 'AI',
  'Glaris': 'GL', 'Glarus': 'GL', 'Nidwald': 'NW', 'Nidwalden': 'NW',
  'Obwald': 'OW', 'Obwalden': 'OW', 'Uri': 'UR',
}

// Plus haut NPA suisse au registre : 9658 Wildhaus.
const NPA_MAX = 9658
const NPA_MIN = 1000

/**
 * Code canton à 2 lettres pour un code postal suisse.
 *
 * `state` est le libellé de canton tel que la source le fournit (RealAdvisor le
 * donne sur 100 % de ses annonces ; Flatfox ne le donne pas). Il sert à deux
 * choses : trancher les NPA à cheval sur deux cantons, et rattraper les codes
 * postaux hors registre.
 *
 * Renvoie 'FL' pour le Liechtenstein (9485-9498), qui est desservi par la Poste
 * suisse mais n'est pas un canton — à l'appelant de décider s'il garde la ligne.
 */
export function npaToCanton(postcode: unknown, state?: unknown): string | null {
  const s = typeof state === 'string' ? state.trim() : ''
  const mapped = s ? STATE_MAP[s] ?? null : null
  const z = parseInt(String(postcode ?? '').trim(), 10)

  if (z && z >= NPA_MIN && z <= NPA_MAX) {
    // NPA à cheval : le libellé de la source tranche mieux que la majorité
    // d'adresses, à condition qu'il désigne bien l'un des cantons candidats.
    const candidats = NPA_AMBIGUS[z]
    if (candidats && mapped && candidats.includes(mapped)) return mapped
    for (const [min, max, canton] of NPA_RANGES) {
      if (z >= min && z <= max) return canton
    }
  }

  // NPA absent, non numérique, ou hors registre suisse (code étranger).
  if (mapped) return mapped
  return s || null
}
