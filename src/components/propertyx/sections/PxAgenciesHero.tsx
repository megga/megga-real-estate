// MEGGA Marketplace — Property X "Agences" page Hero section.
// Inspiré de PxPropertiesHero (node 9552:21438) :
// container dark neutral700 rounded-24 + badge eyebrow + H1 + paragraph
// + browser pill (search + canton select) overlapping bottom.

import { useTranslation } from 'react-i18next'
import { PX, PxFigmaIcon } from '..'

const CANTONS = [
  '', 'GE', 'VD', 'VS', 'NE', 'FR', 'BE', 'JU', 'BS', 'BL',
  'AG', 'SO', 'ZH', 'LU', 'ZG', 'SZ', 'NW', 'OW', 'UR', 'GL',
  'SH', 'TG', 'AR', 'AI', 'SG', 'GR', 'TI',
] as const

const CANTON_LABELS: Record<string, string> = {
  AG: 'Argovie', AI: 'Appenzell RI', AR: 'Appenzell RE', BE: 'Berne', BL: 'Bâle-Campagne',
  BS: 'Bâle-Ville', FR: 'Fribourg', GE: 'Genève', GL: 'Glaris', GR: 'Grisons', JU: 'Jura',
  LU: 'Lucerne', NE: 'Neuchâtel', NW: 'Nidwald', OW: 'Obwald', SG: 'Saint-Gall',
  SH: 'Schaffhouse', SO: 'Soleure', SZ: 'Schwytz', TG: 'Thurgovie', TI: 'Tessin',
  UR: 'Uri', VD: 'Vaud', VS: 'Valais', ZG: 'Zoug', ZH: 'Zurich',
}

interface PxAgenciesHeroProps {
  search: string
  onSearchChange: (value: string) => void
  canton: string
  onCantonChange: (value: string) => void
  totalCount: number | null
}

// Badge dark "Annuaire" — bg neutral600, cercle neutral500 + icône home, texte blanc
// Pattern identique à AllPropertiesBadgeDark de PxPropertiesHero.
function DirectoryBadgeDark({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral600,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral500,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-about-user" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral100,
      }}>{label}</span>
    </span>
  )
}

const selectFieldStyle: React.CSSProperties = {
  background: PX.neutral200,
  width: 280,
  height: 52,
  minHeight: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 6,
  paddingBottom: 6,
  position: 'relative',
  borderTopRightRadius: PX.radius.pill,
  borderBottomRightRadius: PX.radius.pill,
}

const placeholderStyle: React.CSSProperties = {
  fontFamily: PX.font.display,
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.25,
  letterSpacing: '-0.48px',
  background: 'transparent',
  border: 0,
  outline: 'none',
  appearance: 'none',
  cursor: 'pointer',
  flex: 1,
  paddingRight: 8,
}

export default function PxAgenciesHero({
  search,
  onSearchChange,
  canton,
  onCantonChange,
  totalCount,
}: PxAgenciesHeroProps) {
  const { t } = useTranslation('directory')

  // Subtitle utilise la même clé que l'ancienne page : agencies.subtitle
  const countLabel = totalCount != null ? totalCount.toLocaleString('fr-CH') : '—'

  return (
    <section style={{
      paddingTop: 24,
      paddingLeft: 24,
      paddingRight: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: '100%',
      position: 'relative',
      zIndex: 3,
    }}>
      {/* Container dark : bg-neutral700 rounded-24 pt-110 pb-90 */}
      <div style={{
        background: PX.neutral700,
        borderRadius: PX.radius.large,
        paddingTop: 110,
        paddingBottom: 90,
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '100%',
          paddingLeft: 24,
          paddingRight: 24,
        }}>
          <DirectoryBadgeDark label={t('agencies.eyebrow', 'Annuaire')} />

          {/* Title : 72/110% */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 16,
          }}>
            <h1 style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 72,
              fontWeight: 500,
              lineHeight: 1.10,
              letterSpacing: '-2.16px',
              color: PX.neutral100,
              textAlign: 'center',
              maxWidth: 854.75,
            }}>
              {t('agencies.title')}
            </h1>
          </div>

          {/* Paragraph : pt-16 pb-32, w-562 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 16,
            paddingBottom: 32,
          }}>
            <p style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
              textAlign: 'center',
              maxWidth: 562,
            }}>
              {t('agencies.subtitle', { count: countLabel })}
            </p>
          </div>
        </div>

        {/* Browser : absolute bottom -48, white pill rounded-48 */}
        <div style={{
          position: 'absolute',
          bottom: -48,
          left: '50%',
          transform: 'translateX(-50%)',
          background: PX.neutral100,
          borderRadius: 48,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          boxShadow: PX.shadow.small,
          maxWidth: 'calc(100% - 48px)',
        }}>
          {/* Search input : 400×52 left pill */}
          <div style={{
            background: PX.neutral200,
            width: 400,
            height: 52,
            minHeight: 52,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 16,
            paddingRight: 6,
            paddingTop: 6,
            paddingBottom: 6,
            borderTopLeftRadius: PX.radius.pill,
            borderBottomLeftRadius: PX.radius.pill,
            position: 'relative',
          }}>
            <input
              type="text"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={t('agencies.searchPlaceholder')}
              aria-label={t('agencies.searchPlaceholder')}
              style={{
                ...placeholderStyle,
                color: search ? PX.neutral700 : PX.neutral500,
                paddingRight: 52,
                cursor: 'text',
              }}
            />
            <span
              aria-hidden
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 40,
                height: 40,
                borderRadius: PX.radius.pill,
                background: PX.neutral700,
                color: PX.neutral100,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <PxFigmaIcon name="search" size={22} color={PX.neutral100} />
            </span>
          </div>

          {/* Canton select : 280×52 right pill */}
          <div style={selectFieldStyle}>
            <select
              value={canton}
              onChange={e => onCantonChange(e.target.value)}
              aria-label={t('filterCanton')}
              style={{
                ...placeholderStyle,
                color: canton ? PX.neutral700 : PX.neutral500,
              }}
            >
              {CANTONS.map(c => (
                <option key={c || 'all'} value={c}>
                  {c ? `${CANTON_LABELS[c] || c} (${c})` : t('agencies.allCantons')}
                </option>
              ))}
            </select>
            <PxFigmaIcon name="chevron-down" size={16} color={PX.neutral500} />
          </div>
        </div>
      </div>
    </section>
  )
}
