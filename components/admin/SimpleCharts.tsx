'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'

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

function buildAreaPath(points: Array<{ x: number; y: number }>, baseline: number) {
    if (points.length === 0) return ''
    const line = buildPath(points)
    const last = points[points.length - 1]
    const first = points[0]
    return `${line} L ${last.x.toFixed(2)} ${baseline.toFixed(2)} L ${first.x.toFixed(2)} ${baseline.toFixed(2)} Z`
}

function shortenLabel(value: unknown, maxLength = 16) {
    const label = String(value || '')
    return label.length > maxLength ? `${label.slice(0, maxLength - 1)}...` : label
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
                <defs>
                    {series.map(item => (
                        <linearGradient key={item.key} id={`line-fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={item.color} stopOpacity="0.22" />
                            <stop offset="72%" stopColor={item.color} stopOpacity="0.04" />
                            <stop offset="100%" stopColor={item.color} stopOpacity="0" />
                        </linearGradient>
                    ))}
                </defs>

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

                {seriesPoints.map(item => (
                    <path
                        key={`${item.key}-area`}
                        className="simple-chart-area"
                        d={buildAreaPath(item.points, pad.top + plotHeight)}
                        fill={`url(#line-fill-${item.key})`}
                    />
                ))}

                {seriesPoints.map((item, seriesIndex) => (
                    <g key={item.key}>
                        <path
                            className="simple-chart-line-glow"
                            d={buildPath(item.points)}
                            fill="none"
                            stroke={item.color}
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                        />
                        <path
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
                        {item.points.map((point, index) => (
                            <circle
                                key={`${item.key}-${index}`}
                                className="simple-chart-dot"
                                cx={point.x}
                                cy={point.y}
                                r={index === item.points.length - 1 ? 3.8 : 2.4}
                                fill="var(--bg-card)"
                                stroke={item.color}
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                            />
                        ))}
                    </g>
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
    valueFormatter = compactNumber,
}: {
    data: Array<{ name: string; value: number }>
    colors: string[]
    height?: number
    valueFormatter?: (value: number) => string
}) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null)
    const total = data.reduce((sum, item) => sum + toNumber(item.value), 0)
    const orderedData = [...data].sort((a, b) => toNumber(b.value) - toNumber(a.value))
    const radius = 52
    const strokeWidth = 24
    const circumference = 2 * Math.PI * radius
    const activeItem = activeIndex == null ? null : data[activeIndex]
    const segments = data.map((item, index) => {
        const previousOffset = data
            .slice(0, index)
            .reduce((sum, row) => sum + (toNumber(row.value) / Math.max(total, 1)) * circumference, 0)
        const segment = (toNumber(item.value) / Math.max(total, 1)) * circumference
        return { item, segment, dashOffset: -previousOffset }
    })

    if (total <= 0) {
        return (
            <div className="simple-chart-empty" style={{ height }}>
                Sem dados para exibir
            </div>
        )
    }

    return (
        <div className="simple-donut-frame simple-donut-frame-rich" style={{ height }} onMouseLeave={() => setActiveIndex(null)}>
            <div className="simple-donut-wrap">
                <svg className="simple-donut-svg" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth={strokeWidth} />
                    {segments.map(({ item, segment, dashOffset }, index) => {
                        return (
                            <circle
                                key={`${item.name}-${index}`}
                                className="simple-donut-segment"
                                cx="80"
                                cy="80"
                                r={radius}
                                fill="none"
                                stroke={colors[index % colors.length]}
                                strokeWidth={strokeWidth}
                                strokeDasharray={`${Math.max(0, segment - 2)} ${circumference}`}
                                strokeLinecap="butt"
                                transform="rotate(-90 80 80)"
                                onMouseEnter={() => setActiveIndex(index)}
                                onTouchStart={() => setActiveIndex(index)}
                                style={{
                                    '--donut-offset': dashOffset,
                                    '--donut-start-offset': dashOffset + circumference,
                                    animationDelay: `${index * 70}ms`,
                                } as CSSProperties}
                            />
                        )
                    })}
                </svg>
                <div className="simple-donut-hole" />
                <div className="simple-donut-center">
                    <strong>{valueFormatter(total)}</strong>
                    <span>Total</span>
                </div>
                {activeItem && (
                    <div className="simple-donut-tooltip">
                        <strong>{activeItem.name}</strong>
                        <span>{valueFormatter(toNumber(activeItem.value))}</span>
                    </div>
                )}
            </div>
            <div className="simple-donut-legend simple-donut-legend-rich">
                {orderedData.slice(0, 6).map((item, index) => {
                    const originalIndex = data.findIndex(row => row.name === item.name)
                    const color = colors[Math.max(originalIndex, 0) % colors.length]
                    const percent = Math.round((toNumber(item.value) / Math.max(total, 1)) * 100)
                    return (
                    <span key={`${item.name}-${index}`}>
                        <i style={{ background: color }} />
                        <b>{shortenLabel(item.name, 14)}</b>
                        <em>{percent}%</em>
                    </span>
                    )
                })}
            </div>
        </div>
    )
}

export function SimpleBarChart({
    data,
    color = '#c9a96e',
    name = 'Valor',
    height = 260,
    layout = 'vertical',
    valueFormatter = compactNumber,
}: {
    data: Array<{ name: string; value: number }>
    color?: string
    name?: string
    height?: number
    layout?: 'vertical' | 'horizontal'
    valueFormatter?: (value: number) => string
}) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null)
    const width = 360
    const svgHeight = 210
    const maxValue = Math.max(1, ...data.map(item => toNumber(item.value)))
    const activeItem = activeIndex == null ? null : data[activeIndex]

    if (data.length === 0) {
        return (
            <div className="simple-chart-empty" style={{ height }}>
                Sem dados para exibir
            </div>
        )
    }

    if (layout === 'horizontal') {
        const pad = { top: 12, right: 18, bottom: 12, left: 118 }
        const rowHeight = Math.max(18, (svgHeight - pad.top - pad.bottom) / Math.max(data.length, 1))
        const barHeight = Math.min(12, rowHeight * 0.58)
        const plotWidth = width - pad.left - pad.right

        return (
            <div className="simple-chart-frame" style={{ height }} onMouseLeave={() => setActiveIndex(null)}>
                <svg viewBox={`0 0 ${width} ${svgHeight}`} preserveAspectRatio="none" className="simple-chart-svg">
                    {data.map((item, index) => {
                        const value = toNumber(item.value)
                        const barWidth = (value / maxValue) * plotWidth
                        const y = pad.top + index * rowHeight + (rowHeight - barHeight) / 2
                        return (
                            <g key={`${item.name}-${index}`} onMouseEnter={() => setActiveIndex(index)} onTouchStart={() => setActiveIndex(index)}>
                                <text x={pad.left - 8} y={y + barHeight * 0.75} textAnchor="end" fontSize="8.5" fill="#8a8f98">
                                    {shortenLabel(item.name, 18)}
                                </text>
                                <rect x={pad.left} y={y} width={plotWidth} height={barHeight} rx="4" fill="rgba(148,163,184,0.12)" />
                                <rect className="simple-chart-bar simple-chart-bar-horizontal" x={pad.left} y={y} width={barWidth} height={barHeight} rx="4" fill={color} style={{ animationDelay: `${index * 45}ms` }} />
                                <text x={Math.min(pad.left + barWidth + 8, width - pad.right)} y={y + barHeight * 0.75} fontSize="8.5" fill="#475569" fontWeight="700">
                                    {valueFormatter(value)}
                                </text>
                            </g>
                        )
                    })}
                </svg>
                {activeItem && <SimpleBarTooltip item={activeItem} name={name} valueFormatter={valueFormatter} />}
            </div>
        )
    }

    const pad = { top: 14, right: 12, bottom: 38, left: 36 }
    const plotWidth = width - pad.left - pad.right
    const plotHeight = svgHeight - pad.top - pad.bottom
    const slotWidth = plotWidth / Math.max(data.length, 1)
    const barWidth = Math.max(10, Math.min(28, slotWidth * 0.55))

    return (
        <div className="simple-chart-frame" style={{ height }} onMouseLeave={() => setActiveIndex(null)}>
            <svg viewBox={`0 0 ${width} ${svgHeight}`} preserveAspectRatio="none" className="simple-chart-svg">
                {[0, 0.5, 1].map(step => {
                    const y = pad.top + plotHeight * step
                    return <line key={step} x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(148,163,184,0.22)" strokeDasharray="3 3" />
                })}
                {data.map((item, index) => {
                    const value = toNumber(item.value)
                    const barHeight = (value / maxValue) * plotHeight
                    const x = pad.left + index * slotWidth + (slotWidth - barWidth) / 2
                    const y = pad.top + plotHeight - barHeight
                    return (
                        <g key={`${item.name}-${index}`} onMouseEnter={() => setActiveIndex(index)} onTouchStart={() => setActiveIndex(index)}>
                            <rect className="simple-chart-bar" x={x} y={y} width={barWidth} height={barHeight} rx="5" fill={color} style={{ animationDelay: `${index * 45}ms` }} />
                            <text x={x + barWidth / 2} y={Math.max(10, y - 5)} textAnchor="middle" fontSize="8" fill="#475569" fontWeight="800">
                                {valueFormatter(value)}
                            </text>
                            <text x={x + barWidth / 2} y={svgHeight - 14} textAnchor="middle" fontSize="8" fill="#8a8f98">
                                {shortenLabel(item.name, 8)}
                            </text>
                        </g>
                    )
                })}
            </svg>
            {activeItem && <SimpleBarTooltip item={activeItem} name={name} valueFormatter={valueFormatter} />}
        </div>
    )
}

function SimpleBarTooltip({
    item,
    name,
    valueFormatter,
}: {
    item: { name: string; value: number }
    name: string
    valueFormatter: (value: number) => string
}) {
    return (
        <div className="simple-bar-tooltip">
            <strong>{item.name}</strong>
            <span>{name}: {valueFormatter(toNumber(item.value))}</span>
        </div>
    )
}
