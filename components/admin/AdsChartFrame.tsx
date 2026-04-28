'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'

interface AdsChartFrameProps {
    height?: number
    minWidth?: number
    className?: string
    children: (size: { width: number; height: number; isCompact: boolean }) => ReactNode
}

export default function AdsChartFrame({
    height = 300,
    minWidth = 280,
    className = '',
    children,
}: AdsChartFrameProps) {
    const frameRef = useRef<HTMLDivElement | null>(null)
    const [width, setWidth] = useState(minWidth)

    useEffect(() => {
        const frame = frameRef.current
        if (!frame) return

        const updateWidth = () => {
            setWidth(Math.max(minWidth, Math.floor(frame.clientWidth || minWidth)))
        }

        updateWidth()

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateWidth)
            return () => window.removeEventListener('resize', updateWidth)
        }

        const observer = new ResizeObserver(updateWidth)
        observer.observe(frame)
        return () => observer.disconnect()
    }, [minWidth])

    return (
        <div ref={frameRef} className={`admin-chart-frame ads-chart-frame ${className}`.trim()} style={{ height }}>
            {children({ width, height, isCompact: width < 420 })}
        </div>
    )
}
