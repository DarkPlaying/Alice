"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface PieSegment {
  label: string
  value: number
  color: string
  glowColor?: string
}

interface PieChartProps {
  segments: PieSegment[]
  innerSegments?: PieSegment[]
  size?: number
  thickness?: number
  className?: string
  onSelect?: (segment: PieSegment | null, total: number) => void
}

export function PieChart({ segments, innerSegments, size = 380, thickness = 18, className, onSelect }: PieChartProps) {
  const [hoveredLayer, setHoveredLayer] = useState<'outer' | 'inner' | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<{ layer: 'outer' | 'inner'; index: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const outerTotal = segments.reduce((a, s) => a + s.value, 0)
  const innerTotal = innerSegments?.reduce((a, s) => a + s.value, 0) ?? 0

  if (outerTotal === 0) return null

  const centerX = size / 2
  const centerY = size / 2

  // Outer ring dimensions — thinner (32px default)
  const outerMargin = 8
  const outerRingOuter = size / 2 - outerMargin
  const outerRingInner = outerRingOuter - thickness

  // Gap between rings
  const ringGap = 30

  // Inner ring dimensions — solid filled circle
  const innerRingOuter = outerRingOuter - ringGap
  const innerRingInner = 2

  // Segment gap angle (spacing between slices)
  const segmentGap = 0.05 // radians

  const getArcPath = (startAngle: number, endAngle: number, outerR: number, innerR: number) => {
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    const x1 = centerX + outerR * Math.cos(startAngle)
    const y1 = centerY + outerR * Math.sin(startAngle)
    const x2 = centerX + outerR * Math.cos(endAngle)
    const y2 = centerY + outerR * Math.sin(endAngle)
    const x3 = centerX + innerR * Math.cos(endAngle)
    const y3 = centerY + innerR * Math.sin(endAngle)
    const x4 = centerX + innerR * Math.cos(startAngle)
    const y4 = centerY + innerR * Math.sin(startAngle)
    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`
  }

  const getCentroid = (startAngle: number, endAngle: number, r: number) => {
    const midAngle = (startAngle + endAngle) / 2
    return {
      x: centerX + r * Math.cos(midAngle),
      y: centerY + r * Math.sin(midAngle),
    }
  }

  // Build outer arcs
  let outerCumulative = -Math.PI / 2
  const outerArcs = segments.map((seg, i) => {
    const angle = outerTotal > 0 ? (seg.value / outerTotal) * 2 * Math.PI : 0
    const startAngle = outerCumulative + segmentGap / 2
    const endAngle = outerCumulative + angle - segmentGap / 2
    outerCumulative += angle

    const isHovered = hoveredLayer === 'outer' && hoveredIndex === i
    const isSelected = selectedIndex?.layer === 'outer' && selectedIndex.index === i
    const isAnySelected = selectedIndex !== null
    const expand = isHovered || isSelected ? 5 : 0
    const midR = (outerRingOuter + outerRingInner) / 2
    const centroid = getCentroid(startAngle, endAngle, midR)

    return {
      ...seg,
      startAngle,
      endAngle,
      path: getArcPath(startAngle, endAngle, outerRingOuter + expand, outerRingInner - expand / 2),
      centroid,
      isHovered,
      isSelected,
      opacity: isAnySelected && !(selectedIndex?.layer === 'outer' && selectedIndex.index === i) ? 0.2 : isHovered ? 0.95 : 0.7,
      index: i,
      percentage: outerTotal > 0 ? Math.round((seg.value / outerTotal) * 100) : 0,
    }
  })

  // Build inner arcs
  let innerCumulative = -Math.PI / 2
  const innerArcs = innerSegments?.map((seg, i) => {
    const angle = innerTotal > 0 ? (seg.value / innerTotal) * 2 * Math.PI : 0
    const startAngle = innerCumulative + segmentGap / 2
    const endAngle = innerCumulative + angle - segmentGap / 2
    innerCumulative += angle

    const isHovered = hoveredLayer === 'inner' && hoveredIndex === i
    const isSelected = selectedIndex?.layer === 'inner' && selectedIndex.index === i
    const isAnySelected = selectedIndex !== null
    const expand = isHovered || isSelected ? 3 : 0
    const midR = (innerRingOuter + innerRingInner) / 2
    const centroid = getCentroid(startAngle, endAngle, midR)

    return {
      ...seg,
      startAngle,
      endAngle,
      path: getArcPath(startAngle, endAngle, innerRingOuter + expand, innerRingInner - expand / 2),
      centroid,
      isHovered,
      isSelected,
      opacity: isAnySelected && !(selectedIndex?.layer === 'inner' && selectedIndex.index === i) ? 0.2 : isHovered ? 0.9 : 0.65,
      index: i,
      percentage: innerTotal > 0 ? Math.round((seg.value / innerTotal) * 100) : 0,
    }
  }) ?? []

  const activeSegment = selectedIndex
    ? selectedIndex.layer === 'outer'
      ? segments[selectedIndex.index]
      : innerSegments?.[selectedIndex.index]
    : null

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      {/* Glass container */}
      <div
        className="relative rounded-3xl border border-white/[0.06] overflow-hidden"
        style={{
          width: size + 40,
          height: size + 40,
          background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.04) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.02) 0%, transparent 50%), rgba(0,0,0,0.5)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
        }}
      >
        {/* Inner glow ring */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 50%)',
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <svg width={size} height={size} style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'scale(1) rotate(0deg)' : 'scale(0.7) rotate(-30deg)',
            transition: 'opacity 0.6s ease-out, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            {/* Glass defs */}
            <defs>
              <filter id="glass-blur">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
              </filter>
              <linearGradient id="glass-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="white" stopOpacity="0.08" />
                <stop offset="50%" stopColor="white" stopOpacity="0" />
                <stop offset="100%" stopColor="white" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {/* Outer ring */}
            {outerArcs.map((arc) => (
              <g key={`outer-${arc.label}`}>
                {/* Glass segment fill */}
                <path
                  d={arc.path}
                  fill={arc.color}
                  opacity={arc.opacity}
                  className="cursor-pointer transition-all duration-300 ease-out"
                  style={{
                    filter: arc.isHovered || arc.isSelected
                      ? `drop-shadow(0 0 20px ${arc.glowColor || arc.color}70) drop-shadow(0 0 6px ${arc.glowColor || arc.color}40)`
                      : 'none',
                  }}
                  onMouseEnter={() => { setHoveredLayer('outer'); setHoveredIndex(arc.index); onSelect?.(segments[arc.index], outerTotal); }}
                  onMouseLeave={() => { 
                    setHoveredLayer(null); 
                    setHoveredIndex(null); 
                    const activeSeg = selectedIndex 
                      ? (selectedIndex.layer === 'outer' ? segments[selectedIndex.index] : innerSegments?.[selectedIndex.index])
                      : null;
                    onSelect?.(activeSeg || null, selectedIndex?.layer === 'inner' ? innerTotal : outerTotal); 
                  }}
                  onClick={() => {
                    const next = selectedIndex?.layer === 'outer' && selectedIndex.index === arc.index
                      ? null
                      : { layer: 'outer' as const, index: arc.index }
                    setSelectedIndex(next)
                    onSelect?.(next ? segments[next.index] : null, outerTotal)
                  }}
                />
                {/* Glass sheen overlay */}
                <path
                  d={arc.path}
                  fill="url(#glass-sheen)"
                  opacity={arc.opacity * 0.5}
                  className="pointer-events-none"
                />
                {/* Label — only show on hover/select, curved along arc */}
                {(arc.isHovered || arc.isSelected) && arc.endAngle - arc.startAngle > 0.2 && (
                  <>
                    <defs>
                      <path
                        id={`arc-${arc.label}`}
                        d={(() => {
                          const midR = (outerRingOuter + outerRingInner) / 2
                          const largeArc = arc.endAngle - arc.startAngle > Math.PI ? 1 : 0
                          const x1 = centerX + midR * Math.cos(arc.startAngle)
                          const y1 = centerY + midR * Math.sin(arc.startAngle)
                          const x2 = centerX + midR * Math.cos(arc.endAngle)
                          const y2 = centerY + midR * Math.sin(arc.endAngle)
                          return `M ${x1} ${y1} A ${midR} ${midR} 0 ${largeArc} 1 ${x2} ${y2}`
                        })()}
                        fill="none"
                      />
                    </defs>
                    <text
                      className="pointer-events-none select-none transition-opacity duration-200"
                      fill="rgba(255,255,255,0.9)"
                      fontSize={9}
                      fontWeight={700}
                      letterSpacing="0.05em"
                    >
                      <textPath
                        href={`#arc-${arc.label}`}
                        startOffset="50%"
                        textAnchor="middle"
                      >
                        {arc.label}
                      </textPath>
                    </text>
                  </>
                )}
              </g>
            ))}

            {/* Inner ring */}
            {innerArcs.map((arc) => (
              <g key={`inner-${arc.label}`}>
                <path
                  d={arc.path}
                  fill={arc.color}
                  opacity={arc.opacity}
                  className="cursor-pointer transition-all duration-300 ease-out"
                  style={{
                    filter: arc.isHovered || arc.isSelected
                      ? `drop-shadow(0 0 14px ${arc.glowColor || arc.color}60)`
                      : 'none',
                  }}
                  onMouseEnter={() => { setHoveredLayer('inner'); setHoveredIndex(arc.index); onSelect?.(innerSegments![arc.index], innerTotal); }}
                  onMouseLeave={() => { 
                    setHoveredLayer(null); 
                    setHoveredIndex(null); 
                    const activeSeg = selectedIndex 
                      ? (selectedIndex.layer === 'outer' ? segments[selectedIndex.index] : innerSegments?.[selectedIndex.index])
                      : null;
                    onSelect?.(activeSeg || null, selectedIndex?.layer === 'inner' ? innerTotal : outerTotal); 
                  }}
                  onClick={() => {
                    const next = selectedIndex?.layer === 'inner' && selectedIndex.index === arc.index
                      ? null
                      : { layer: 'inner' as const, index: arc.index }
                    setSelectedIndex(next)
                    onSelect?.(next && innerSegments ? innerSegments[next.index] : null, innerTotal)
                  }}
                />
                <path
                  d={arc.path}
                  fill="url(#glass-sheen)"
                  opacity={arc.opacity * 0.4}
                  className="pointer-events-none"
                />
                {(arc.isHovered || arc.isSelected) && arc.endAngle - arc.startAngle > 0.3 && arc.label !== 'WINS' && arc.label !== 'LOSSES' && (
                  <>
                    <defs>
                      <path
                        id={`inner-arc-${arc.label}`}
                        d={(() => {
                          const midR = (innerRingOuter + innerRingInner) / 2 + 28
                          const largeArc = arc.endAngle - arc.startAngle > Math.PI ? 1 : 0
                          const x1 = centerX + midR * Math.cos(arc.startAngle)
                          const y1 = centerY + midR * Math.sin(arc.startAngle)
                          const x2 = centerX + midR * Math.cos(arc.endAngle)
                          const y2 = centerY + midR * Math.sin(arc.endAngle)
                          return `M ${x1} ${y1} A ${midR} ${midR} 0 ${largeArc} 1 ${x2} ${y2}`
                        })()}
                        fill="none"
                      />
                    </defs>
                    <text
                      className="pointer-events-none select-none transition-opacity duration-200"
                      fill="rgba(255,255,255,0.85)"
                      fontSize={10}
                      fontWeight={600}
                      letterSpacing="0.15em"
                    >
                      <textPath
                        href={`#inner-arc-${arc.label}`}
                        startOffset="50%"
                        textAnchor="middle"
                      >
                        {arc.label}
                      </textPath>
                    </text>
                  </>
                )}
              </g>
            ))}
          </svg>
        </div>

        {/* Center - total or selected/hovered percentage */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredIndex !== null && hoveredLayer ? (
            <>
              <span className="text-5xl font-black text-white tabular-nums leading-none">
                {(() => {
                  const arc = hoveredLayer === 'outer' ? outerArcs[hoveredIndex] : innerArcs[hoveredIndex]
                  if (!arc) return '0.0'
                  const denom = hoveredLayer === 'inner' ? innerTotal : outerTotal
                  return denom > 0 ? ((arc.value / denom) * 100).toFixed(1) : '0.0'
                })()}%
              </span>
              <span className="text-xs font-mono text-white/50 uppercase tracking-[0.15em] mt-1.5">
                {hoveredLayer === 'outer' ? outerArcs[hoveredIndex]?.label : innerArcs[hoveredIndex]?.label}
              </span>
            </>
          ) : activeSegment ? (
            <>
              <span className="text-5xl font-black text-white tabular-nums leading-none">
                {(() => {
                  const denom = selectedIndex?.layer === 'inner' ? innerTotal : outerTotal
                  return denom > 0 ? ((activeSegment.value / denom) * 100).toFixed(1) : '0.0'
                })()}%
              </span>
              <span className="text-xs font-mono text-white/50 uppercase tracking-[0.15em] mt-1.5">
                {activeSegment.label}
              </span>
            </>
          ) : (
            <>
              <span className="text-5xl font-black text-white tabular-nums leading-none">
                {outerTotal}
              </span>
              <span className="text-xs font-mono text-white/40 uppercase tracking-[0.15em] mt-1.5">
                TOTAL
              </span>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
