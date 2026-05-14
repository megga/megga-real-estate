/**
 * Smoke test pour src/lib/figma-catalog.ts
 * Exerce chaque helper avec des cas connus + cas non mappé.
 * Run : npx tsx scripts/test-figma-catalog.ts
 */

import {
  resolveIconForVariant,
  summarizeFigmaNode,
  listAllMappings,
  FIGMA_ICON_VARIANT_MAP,
  FIGMA_COMPONENT_MAP,
  FIGMA_BADGE_MAP,
  FIGMA_PAGE_MAP,
} from '../src/lib/figma-catalog'

let pass = 0
let fail = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    console.log(`  ✓ ${label}`)
    pass++
  } else {
    console.log(`  ✗ ${label}`)
    console.log(`      expected: ${JSON.stringify(expected)}`)
    console.log(`      got:      ${JSON.stringify(actual)}`)
    fail++
  }
}

console.log('\n━━━ Test 1 : resolveIconForVariant ━━━')
check('Small Icon/V25 → star', resolveIconForVariant('Small Icon/V25'), 'star')
check('Small Icon/V28 → user', resolveIconForVariant('Small Icon/V28'), 'user')
check('Small Icon/V36 → home', resolveIconForVariant('Small Icon/V36'), 'home')
check('Small Icon/V51 → bulb', resolveIconForVariant('Small Icon/V51'), 'bulb')
check('Small Icon/V99 → undefined (non mappé)', resolveIconForVariant('Small Icon/V99'), undefined)

console.log('\n━━━ Test 2 : summarizeFigmaNode ━━━')
// Page mappée
const pageRes = summarizeFigmaNode('9552:21435')
console.log(`  → Page /about : "${pageRes}"`)
check('Page contient PropertyXAboutPage', pageRes.includes('PropertyXAboutPage'), true)

// Composant mappé
const compRes = summarizeFigmaNode('4908:36278')
console.log(`  → PxButton : "${compRes}"`)
check('Composant contient PxButton', compRes.includes('PxButton'), true)

// Badge mappé
const badgeRes = summarizeFigmaNode('11757:34421')
console.log(`  → Badge "Nos valeurs" : "${badgeRes}"`)
check('Badge contient iconName="star"', badgeRes.includes('iconName="star"'), true)
check('Badge contient text="Nos valeurs"', badgeRes.includes('Nos valeurs'), true)

// Badge invert
const badgeInvertRes = summarizeFigmaNode('11763:17450')
console.log(`  → Badge "Nos bureaux" : "${badgeInvertRes}"`)
check('Badge invert contient le flag invert', badgeInvertRes.includes('invert'), true)

// Node non mappé
const unmappedRes = summarizeFigmaNode('99999:99999')
console.log(`  → Node inconnu : "${unmappedRes}"`)
check('Node inconnu signalé comme "non mappé"', unmappedRes.includes('non mappé'), true)

console.log('\n━━━ Test 3 : listAllMappings ━━━')
const counts = listAllMappings()
console.log(`  Counts : ${JSON.stringify(counts)}`)
check('iconVariants > 0', counts.iconVariants > 0, true)
check('components >= 4', counts.components >= 4, true)
check('badges = 5', counts.badges, 5)
check('pages = 1', counts.pages, 1)

console.log('\n━━━ Test 4 : intégrité des maps ━━━')
check('FIGMA_ICON_VARIANT_MAP a 8 entrées',
  Object.keys(FIGMA_ICON_VARIANT_MAP).length, 8)
check('FIGMA_COMPONENT_MAP a 4 composants',
  Object.keys(FIGMA_COMPONENT_MAP).length, 4)
check('FIGMA_BADGE_MAP a 5 badges',
  Object.keys(FIGMA_BADGE_MAP).length, 5)
check('FIGMA_PAGE_MAP a 1 page',
  Object.keys(FIGMA_PAGE_MAP).length, 1)

// Cas réel : un node Figma de la maquette About que j'ai migrée
console.log('\n━━━ Test 5 : scénario réel — migration future ━━━')
console.log('Simulons : "je migre une nouvelle page Figma qui réutilise le badge Nos valeurs"')
const realBadge = summarizeFigmaNode('11757:34421')
console.log(`  → Code à utiliser : ${realBadge}`)
check('Le code suggéré est utilisable tel quel',
  realBadge.startsWith('→ <EyebrowBadge'), true)

console.log(`\n━━━ Résultat : ${pass} pass / ${fail} fail ━━━\n`)
process.exit(fail > 0 ? 1 : 0)
