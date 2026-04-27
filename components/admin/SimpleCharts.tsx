'use client'

import { useState } from 'react'

type ChartRow = Record<string, string | number | null | undefined>

export interface SimpleChartSeries {
    key: string
    name: string
    color: string
}

function toNumber(value: unknown) {
    const parsed = Number(value || 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function compactNumber(value: number) {
    return new Intl.NumberFormat('pt-BR', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value)
}

function buildPath(points: Array<{ x: number; y: number }>) {
    if (points.length === 0) return ''
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
}

export function SimpleLineChart({
    data,
    series,
    height = 260,
    valueFormatter = compactNumber,
}: {
    data: ChartRow[]
    series: SimpleChartSeries[]
    height?: number
    valueFormatter?: (value: number) => string
}) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null)
    const width = 360
    const svgHeight = 210
    const pad = { top: 14, right: 12, bottom: 28, left: 44 }
    const plotWidth = width - pad.left - pad.right
    const plotHeight = svgHeight - pad.top - pad.bottom
    const values = data.flatMap(row => series.map(item => toNumber(row[item.key])))
    const maxValue = Math.max(1, ...values)
    const roundedMax = maxValue * 1.08
    const labelIndexes = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])
    const seriesPoints = series.map(item => ({
        ...item,
        points: data.map((row, index) => {
            const x = pad.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth)
            const y = pad.top + (1 - toNumber(row[item.key]) / roundedMax) * plotHeight
            return { x, y, value: toNumber(row[item.key]) }
        }),
    }))

    const activePoint = activeIndex == null
        ? null
        : {
            x: pad.left + (data.length === 1 ? plotWidth / 2 : (activeIndex / (data.length - 1)) * plotWidth),
            y: Math.min(...seriesPoints.map(item => item.points[activeIndex]?.y ?? pad.top + plotHeight)),
            row: data[activeIndex],
        }

    const updateActiveIndex = (clientX: number, currentTarget: SVGSVGElement) => {
        const rect = currentTarget.getBoundingClientRect()
        const rawX = ((clientX - rect.left) / Math.max(rect.width, 1)) * width
        const ratio = Math.max(0, Math.min(1, (rawX - pad.left) / plotWidth))
        setActiveIndex(Math.round(ratio * (data.length - 1)))
    }

    if (data.length === 0) {
        return (
            <div className="simple-chart-empty" style={{ height }}>
                Sem dados para exibir
            </div>
        )
    }

    return (
        <div className="simple-chart-frame" style={{ height }} onMouseLeave={() => setActiveIndex(null)}>
            <svg
                viewBox={`0 0 ${width} ${svgHeight}`}
                preserveAspectRatio="none"
                className="simple-chart-svg"
                onMouseMove={event => updateActiveIndex(event.clientX, event.currentTarget)}
                onTouchMove={event => {
                    const touch = event.touches[0]
                    if (touch) updateActiveIndex(touch.clientX, event.currentTarget)
                }}
                onTouchEnd={() => setActiveIndex(null)}
            >
                {[0, 0.25, 0.5, 0.75, 1].map(step => {
                    const y = pad.top + plotHeight * step
                    const value = roundedMax * (1 - step)
                    return (
                        <g key={step}>
                            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(148,163,184,0.25)" strokeDasharray="3 3" />
                            <text x={pad.left - 7} y={y + 3} textAnchor="end" fontSize="8" fill="#8a8f98">
                                {compactNumber(value)}
                            </text>
                        </g>
                    )
                })}

                {data.map((row, index) => {
                    if (!labelIndexes.has(index)) return null
                    const x = pad.left + (data.length === 1 ? 0 : (index / (data.length - 1)) * plotWidth)
                    return (
                        <text key={index} x={x} y={svgHeight - 8} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} fontSize="9" fill="#8a8f98">
                            {String(row.label || '')}
                        </text>
                    )
                })}

                {seriesPoints.map((item, seriesIndex) => (
                        <path
                            key={item.key}
                            className="simple-chart-line"
                            d={buildPath(item.points)}
                            fill="none"
                            stroke={item.color}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            style={{ animationDelay: `${seriesIndex * 90}ms` }}
                        />
                ))}

                {activePoint && (
                    <g className="simple-chart-active-layer">
                        <line x1={activePoint.x} x2={activePoint.x} y1={pad.top} y2={pad.top + plotHeight} stroke="rgba(15,23,42,0.28)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                        {seriesPoints.map(item => {
                            const point = item.points[activeIndex!]
                            if (!point) return null
                            return (
                                <circle
                                    key={item.key}
                                    cx={point.x}
                                    cy={point.y}
                                    r="4"
                                    fill="var(--bg-card)"
                                    stroke={item.color}
                                    strokeWidth="3"
                                    vectorEffect="non-scaling-stroke"
                                />
                            )
                        })}
                    </g>
                )}
            </svg>
            {activePoint && (
                <div
                    className="simple-chart-tooltip"
                    style={{
                        left: `${(activePoint.x / width) * 100}%`,
                        top: `${Math.max(8, (activePoint.y / svgHeight) * 100)}%`,
                        transform: activePoint.x > width * 0.62 ? 'translate(-100%, -105%)' : 'translate(8px, -105%)',
                    }}
                >
                    <strong>{String(activePoint.row.label || '')}</strong>
                    {seriesPoints.map(item => (
                        <span key={item.key}>
                            <i style={{ background: item.color }} /> {item.name}: {valueFormatter(toNumber(activePoint.row[item.key]))}
                        </span>
                    ))}
                </div>
            )}
            <div className="simple-chart-legend">
                {series.map(item => (
                    <span key={item.key}>
                        <i style={{ background: item.color }} /> {item.name}
                    </span>
                ))}
            </div>
        </div>
    )
}

export function SimpleDonutChart({
    data,
    colors,
    height = 260,
}: {
    data: Array<{ name: string; value: number }>
    colors: string[]
    height?: number
}) {
    const total = data.reduce((sum, item) => sum + toNumber(item.value), 0)
    let cursor = 0
    const gradient = total > 0
        ? data.map((item, index) => {
            const value = toNumber(item.value)
            const start = (cursor / total) * 100
            cursor += value
            const end = (cursor / total) * 100
            const color = colors[index % colors.length]
            return `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`
        }).join(', ')
        : '#e5e7eb 0% 100%'

    if (total <= 0) {
        return (
            <div className="simple-chart-empty" style={{ height }}>
                Sem dados para exibir
            </div>
        )
    }

    return (
        <div className="simple-donut-frame" style={{ height }}>
            <div className="simple-donut" style={{ background: `conic-gradient(${gradient})` }}>
                <div />
            </div>
            <div className="simple-donut-legend">
                {data.map((item, index) => (
                    <span key={item.name}>
                        <i style={{ background: colors[index % colors.length] }} /> {item.name}
                    </span>
                ))}
            </div>
        </div>
    )
}
