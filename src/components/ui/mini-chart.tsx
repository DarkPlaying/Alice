"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface MiniChartProps {
  data: { label: string; value: number; color?: string; updatedAt?: string }[]
  color?: string
  glowColor?: string
  className?: string
}

export function MiniChart({ data, color = "#22c55e", glowColor, className }: MiniChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [displayValue, setDisplayValue] = useState<number | null>(null)
  const [displayLabel, setDisplayLabel] = useState<string | null>(null)
  const [displayDate, setDisplayDate] = useState<string | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [mounted, setMounted] = useState(false)
  const maxValue = Math.max(...data.map((d) => d.value), 1)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const handleContainerEnter = () => { if (selectedIndex === null) setIsHovering(true) }
  const handleContainerLeave = () => {
    if (selectedIndex === null) setIsHovering(false)
    setHoveredIndex(null)
    setTimeout(() => { if (selectedIndex === null) { setDisplayValue(null); setDisplayLabel(null); setDisplayDate(null) } }, 150)
  }

  return (
    <div
      onMouseEnter={handleContainerEnter}
      onMouseLeave={handleContainerLeave}
      className={cn(
        "group relative w-full p-5 rounded-2xl bg-[#0a0a0c] border border-white/[0.08] transition-all duration-500 hover:border-white/[0.12] flex flex-col gap-3",
        className
      )}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s ease-out, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <span className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase">Activity</span>
        </div>
        <div className="relative h-8 flex items-center">
          <span
            className={cn(
              "text-xl font-bold tabular-nums transition-all duration-300 ease-out",
              (isHovering || selectedIndex !== null) && displayValue !== null ? "text-white" : "text-gray-500"
            )}
          >
            {displayValue !== null ? displayValue : ""}
            {displayLabel !== null && (
              <span className="text-xs font-normal text-gray-500 ml-1.5">
                {displayLabel}
              </span>
            )}
          </span>
          {displayDate !== null && (
            <span className="ml-3 text-xs font-mono text-gray-400">
              {displayDate}
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end justify-center gap-[40px] h-72 px-2 overflow-x-auto">
        {data.map((item, index) => {
          const barColor = item.color || color
          const heightPx = (item.value / maxValue) * 288
          const isHovered = hoveredIndex === index
          const isSelected = selectedIndex === index
          const isAnyHovered = hoveredIndex !== null
          const isNeighbor = hoveredIndex !== null && (index === hoveredIndex - 1 || index === hoveredIndex + 1)

          return (
            <div
              key={item.label + index}
              className="relative flex flex-col items-center justify-end h-full shrink-0"
              style={{
                width: `${Math.max(100 / data.length - 4, 40)}px`,
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity 0.5s ease-out ${index * 0.08}s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.08}s`,
              }}
              onMouseEnter={() => {
                setHoveredIndex(index)
                setDisplayValue(item.value)
                setDisplayLabel(item.label)
                setDisplayDate(item.updatedAt || null)
              }}
              onClick={() => setSelectedIndex(prev => (prev === index ? null : index))}
            >
              {/* Tooltip */}
              <div
                className={cn(
                  "absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-white text-black text-xs font-bold transition-all duration-200 whitespace-nowrap z-10",
                  isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                )}
              >
                {item.value}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rotate-45" />
              </div>

              {/* Bar */}
              <div
                className="w-full rounded-full cursor-pointer origin-bottom"
                style={{
                  height: `${heightPx}px`,
                  maxWidth: '44px',
                  backgroundColor: barColor,
                  opacity: mounted ? (isSelected ? 1 : selectedIndex !== null ? 0.12 : isHovered ? 1 : isAnyHovered ? 0.12 : 0.35) : 0,
                  boxShadow: (isSelected || (selectedIndex === null && isHovered)) ? `0 0 20px ${glowColor || barColor}90, 0 0 45px ${glowColor || barColor}50` : "none",
                  transform: mounted ? "scaleX(1) scaleY(1)" : "scaleX(1) scaleY(0)",
                  transition: `opacity 0.4s ease-out ${index * 0.08}s, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.08}s, box-shadow 0.3s ease-out`,
                }}
              />

              {/* Label */}
              <span
                className={cn(
                  "text-sm font-medium mt-2 transition-all duration-300 max-w-[80px] truncate",
                  isHovered ? "text-white" : "text-gray-600"
                )}
                title={item.label}
              >
                {item.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Hover date footer */}
      <div className="h-4 flex items-center justify-center">
        {displayDate !== null && (
          <span className="text-[10px] font-mono text-gray-500">
            Last updated: {displayDate}
          </span>
        )}
      </div>

      {/* Glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at bottom, ${color}06, transparent 70%)`,
        }}
      />
    </div>
  )
}
