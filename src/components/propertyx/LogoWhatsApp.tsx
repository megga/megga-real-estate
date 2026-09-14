/**
 * LogoWhatsApp — le logo WhatsApp que le CRM montre sur un événement WhatsApp : la bulle
 * blanche sur son carré vert en dégradé.
 *
 * Fourni par Julien le 14.09.2026 (« rajoute le logo WhatsApp, celui que je te donne ;
 * prends juste la partie qui est verte ») : de son SVG ne sont gardés que les deux tracés
 * du logo — ni le fond blanc, ni la mention d'auteur. La `viewBox` est recadrée sur le
 * carré vert (104,155 → 395,844), qui remplit donc tout le cadre qu'on lui donne.
 *
 * ⚠ Le dégradé porte un identifiant PAR INSTANCE (`useId`) : la cloche et le journal
 * montrent des dizaines de logos, et un `url(#…)` partagé pointerait vers le premier
 * défini — qui peut vivre dans un écran d'onglet caché.
 */
import { useId } from 'react'
import { WHATSAPP_DEGRADE } from './whatsapp'

/** Le logo, carré, à la taille demandée (px). Décoratif : le texte voisin dit le canal. */
export default function LogoWhatsApp({ taille }: { taille: number }) {
  const degrade = `wa-${useId().replace(/:/g, '')}`
  return (
    <svg width={taille} height={taille} viewBox="104.155 97.155 291.689 291.69" aria-hidden focusable="false" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={degrade} gradientUnits="userSpaceOnUse" x1="250" y1="97.1555" x2="250" y2="388.8445">
          <stop offset="0" stopColor={WHATSAPP_DEGRADE[0]} />
          <stop offset="1" stopColor={WHATSAPP_DEGRADE[1]} />
        </linearGradient>
      </defs>
      <path fillRule="evenodd" clipRule="evenodd" fill={`url(#${degrade})`} d="M347.655,388.845H152.344c-26.504,0-48.189-21.685-48.189-48.189V145.344c0-26.504,21.685-48.189,48.189-48.189h195.311c26.504,0,48.189,21.685,48.189,48.189v195.311C395.844,367.159,374.159,388.845,347.655,388.845z" />
      <path fillRule="evenodd" clipRule="evenodd" fill="#fff" d="M349.445,240.442c0,53.499-43.712,96.879-97.633,96.879c-17.124,0-33.212-4.373-47.198-12.055l-54.059,17.179l17.621-51.976c-8.892-14.602-14.005-31.726-14.005-50.026c0-53.51,43.711-96.887,97.641-96.887C305.733,143.555,349.445,186.932,349.445,240.442L349.445,240.442zM251.812,158.986c-45.275,0-82.092,36.535-82.092,81.456c0,17.814,5.804,34.325,15.635,47.758l-10.251,30.245l31.54-10.022c12.958,8.502,28.485,13.466,45.167,13.466c45.256,0,82.083-36.538,82.083-81.448C333.895,195.521,297.068,158.986,251.812,158.986L251.812,158.986zM301.115,262.756c-0.605-0.992-2.202-1.586-4.586-2.773c-2.395-1.185-14.168-6.936-16.359-7.723c-2.191-0.79-3.798-1.188-5.384,1.185c-1.597,2.376-6.185,7.726-7.585,9.312c-1.392,1.588-2.785,1.782-5.179,0.594c-2.398-1.185-10.113-3.702-19.251-11.781c-7.11-6.304-11.914-14.071-13.317-16.447c-1.389-2.373-0.138-3.657,1.047-4.842c1.08-1.069,2.397-2.773,3.594-4.154c1.199-1.392,1.597-2.387,2.395-3.972c0.798-1.586,0.401-2.967-0.204-4.155c-0.594-1.185-5.384-12.872-7.381-17.632c-1.983-4.746-3.981-4.568-5.384-4.568c-1.392,0-3.976,0.414-3.976,0.414s-4.798,0.594-6.988,2.97c-2.191,2.373-8.373,8.124-8.373,19.8c0,11.685,8.569,22.983,9.765,24.557c1.199,1.588,16.552,26.35,40.886,35.858c24.334,9.505,24.334,6.334,28.723,5.934c4.381-0.387,14.157-5.74,16.154-11.287C301.708,268.496,301.708,263.74,301.115,262.756L301.115,262.756zM301.115,262.756" />
    </svg>
  )
}
