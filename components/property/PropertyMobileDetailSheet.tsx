'use client'

import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from 'react'

type PropertyMobileDetailSheetProps = {
    media: ReactNode
    children: ReactNode
}

const SNAP_MEDIA_FOCUS = 64
const SNAP_BALANCED = 47
const SNAP_DETAILS_FOCUS = 8

export default function PropertyMobileDetailSheet({ media, children }: PropertyMobileDetailSheetProps) {
    const [sheetTop, setSheetTop] = useState(SNAP_BALANCED)
    const [isDragging, setIsDragging] = useState(false)
    const startY = useRef(0)
    const startTop = useRef(SNAP_BALANCED)
    const currentTop = useRef(SNAP_BALANCED)

    const snapToNearest = useCallback(() => {
        const snapPoints = [SNAP_DETAILS_FOCUS, SNAP_BALANCED, SNAP_MEDIA_FOCUS]
        const next = snapPoints.reduce((closest, point) => {
            return Math.abs(point - currentTop.current) < Math.abs(closest - currentTop.current) ? point : closest
        }, snapPoints[0])

        currentTop.current = next
        setSheetTop(next)
    }, [])

    const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
        startY.current = event.clientY
        startTop.current = sheetTop
        currentTop.current = sheetTop
        setIsDragging(true)
        event.currentTarget.setPointerCapture?.(event.pointerId)
    }, [sheetTop])

    const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return

        const deltaY = event.clientY - startY.current
        const deltaPercent = (deltaY / Math.max(window.innerHeight, 1)) * 100
        const next = Math.max(SNAP_DETAILS_FOCUS, Math.min(SNAP_MEDIA_FOCUS, startTop.current + deltaPercent))

        currentTop.current = next
        setSheetTop(next)
    }, [isDragging])

    const handlePointerEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return

        setIsDragging(false)
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        snapToNearest()
    }, [isDragging, snapToNearest])

    return (
        <section className="pmds-wrap" aria-label="Experiência mobile do imóvel">
            <div className="pmds-media">
                {media}
            </div>
            <div
                className="pmds-panel"
                style={{
                    top: `${sheetTop}%`,
                    transition: isDragging ? 'none' : 'top 0.34s cubic-bezier(0.22, 1, 0.36, 1)',
                }}
            >
                <div
                    className="pmds-handle"
                    role="slider"
                    aria-label="Arrastar ficha do imóvel"
                    aria-valuemin={SNAP_DETAILS_FOCUS}
                    aria-valuemax={SNAP_MEDIA_FOCUS}
                    aria-valuenow={Math.round(sheetTop)}
                    tabIndex={0}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onPointerCancel={handlePointerEnd}
                >
                    <span />
                </div>
                <div className="pmds-scroll">
                    {children}
                </div>
            </div>
        </section>
    )
}
