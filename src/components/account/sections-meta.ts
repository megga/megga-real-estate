// Section metadata shared between AccountRail (desktop) and AccountBottomBar (mobile).
// Kept in a non-component file so Vite Fast Refresh stays happy.

import {
  HomeIcon,
  BookmarkIcon,
  HeartIcon,
  MessageIcon,
  UserIcon,
} from './icons'

export type SectionKey = 'listings' | 'searches' | 'favorites' | 'messages' | 'profile'

export interface SectionDef {
  key: SectionKey
  labelKey: string
  icon: (props: { size?: number }) => React.ReactElement
}

export const SECTIONS: SectionDef[] = [
  { key: 'listings', labelKey: 'rail.listings', icon: HomeIcon },
  { key: 'searches', labelKey: 'rail.searches', icon: BookmarkIcon },
  { key: 'favorites', labelKey: 'rail.favorites', icon: HeartIcon },
  { key: 'messages', labelKey: 'rail.messages', icon: MessageIcon },
  { key: 'profile', labelKey: 'rail.profile', icon: UserIcon },
]
