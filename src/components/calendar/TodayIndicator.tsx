import { useState, useEffect } from 'react'

const FIRST_HOUR = 8
const PX_PER_HOUR = 64

export default function TodayIndicator() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const hour = now.getHours()
  const minutes = now.getMinutes()

  // Only show during visible hours (8-20)
  if (hour < FIRST_HOUR || hour > 20) return null

  const topPx = (hour - FIRST_HOUR) * PX_PER_HOUR + (minutes / 60) * PX_PER_HOUR

  return (
    <div
      className="absolute left-[60px] right-0 z-30 pointer-events-none"
      style={{ top: `${topPx}px` }}
    >
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-px bg-red-500" />
      </div>
    </div>
  )
}
