// MEGGA CRM Sugar v2 — Icon component
// 1:1 port from the Claude Design bundle (crm-shell.jsx CRMIcon)

import type { ReactNode } from 'react'

export type CrmIconName =
  | 'search' | 'plus' | 'today' | 'dash' | 'contacts' | 'pipeline' | 'matching'
  | 'bien' | 'chat' | 'cal' | 'support' | 'kyc' | 'docs' | 'auto' | 'moon'
  | 'sun' | 'cog' | 'chevronD' | 'chevronR' | 'chevronL' | 'chevronUD'
  | 'spark' | 'bolt' | 'phone' | 'mail' | 'msg' | 'check' | 'x' | 'eye'
  | 'risk' | 'flag' | 'drag' | 'filter' | 'arrowR' | 'home' | 'file'
  | 'download' | 'layers' | 'bell' | 'share' | 'star' | 'send'

interface CRMIconProps {
  name: CrmIconName
  size?: number
  stroke?: string
  fill?: string
  strokeWidth?: number
}

const PATHS: Record<CrmIconName, ReactNode> = {
  search:   <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  plus:     <><path d="M12 5v14M5 12h14"/></>,
  today:    <><path d="M3 13c4-1 6-3 9-9 3 6 5 8 9 9-4 1-6 3-9 9-3-6-5-8-9-9Z"/></>,
  dash:     <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
  contacts: <><circle cx="9" cy="8" r="3.5"/><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c.4-2 1.5-3 3-3s2.6 1 3 3"/></>,
  pipeline: <><path d="M4 6h6v4H4zM14 4h6v4h-6zM14 12h6v4h-6zM14 20h6"/><path d="M10 8h4M14 14h-4v6h4"/></>,
  matching: <><path d="M14 4h6v6"/><path d="M10 20H4v-6"/><path d="M20 4 4 20"/><path d="M14 14l6 6"/><path d="M4 10 10 4"/></>,
  bien:     <><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></>,
  chat:     <><path d="M21 12a8 8 0 1 1-3.4-6.6L21 4l-1 4.4A8 8 0 0 1 21 12Z"/></>,
  cal:      <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
  support:  <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 2"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></>,
  kyc:      <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></>,
  docs:     <><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6M9 9h2"/></>,
  auto:     <><path d="m13 3-7 11h5l-1 7 7-11h-5l1-7Z"/></>,
  moon:     <><path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/></>,
  sun:      <><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/></>,
  cog:      <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z"/></>,
  chevronD: <><path d="m6 9 6 6 6-6"/></>,
  chevronR: <><path d="m9 6 6 6-6 6"/></>,
  chevronL: <><path d="m15 6-6 6 6 6"/></>,
  chevronUD:<><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></>,
  spark:    <><path d="m12 4 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z"/></>,
  bolt:     <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></>,
  phone:    <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9Z"/></>,
  mail:     <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  msg:      <><path d="M21 12a8 8 0 1 1-3.4-6.6L21 4l-1 4.4A8 8 0 0 1 21 12Z"/></>,
  check:    <><path d="m5 13 4 4 10-12"/></>,
  x:        <><path d="m6 6 12 12M6 18 18 6"/></>,
  eye:      <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  risk:     <><path d="M12 4 2 20h20L12 4Z"/><path d="M12 10v5M12 18v.4"/></>,
  flag:     <><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></>,
  drag:     <><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></>,
  filter:   <><path d="M3 5h18M6 12h12M10 19h4"/></>,
  arrowR:   <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  home:     <><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></>,
  file:     <><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 21h14"/></>,
  layers:   <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></>,
  bell:     <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
  share:    <><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8 11 8-4M8 13l8 4"/></>,
  star:     <><path d="m12 3 2.6 6 6.4.6-4.8 4.4 1.4 6.4L12 17l-5.6 3.4 1.4-6.4L3 9.6 9.4 9 12 3Z"/></>,
  send:     <><path d="M22 3 11 14"/><path d="M22 3l-7 18-4-8-8-4 19-6Z"/></>,
}

export default function CRMIcon({
  name,
  size = 16,
  stroke = 'currentColor',
  fill = 'none',
  strokeWidth = 1.6,
}: CRMIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name] || null}
    </svg>
  )
}
