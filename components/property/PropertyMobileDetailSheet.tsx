'use client'

import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

type PropertyMobileDetailSheetProps = {
    media: ReactNode
    children: ReactNode
}

const SNAP_MEDIA_FOCUS = 78
const SNAP_BALANCED = 47
const SNAP_DETAILS_FOCUS = 8
const SNAP_ENTRY = SNAP_MEDIA_FOCUS

export default function PropertyMobileDetailSheet({ media, children }: PropertyMobileDetailSheetProps) {
    const [sheetTop, setSheetTop] = useState(SNAP_ENTRY)
    const [isDragging, setIsDragging] = useState(false)
    const startY = useRef(0)
    const startTop = useRef(SNAP_ENTRY)
    const currentTop = useRef(SNAP_ENTRY)
    const hasDragged = useRef(false)
    const ignoreNextClick = useRef(false)
    const isExpanded = sheetTop <= SNAP_BALANCED

    const snapToNearest = useCallback(() => {
        const snapPoints = [SNAP_DETAILS_FOCUS, SNAP_BALANCED, SNAP_MEDIA_FOCUS]
        const next = snapPoints.reduce((closest, point) => {
            return Math.abs(point - currentTop.current) < Math.abs(closest - currentTop.current) ? point : closest
        }, snapPoints[0])

        currentTop.current = next
        setSheetTop(next)
    }, [])

    const toggleSheet = useCallback(() => {
        const next = currentTop.current <= SNAP_BALANCED ? SNAP_MEDIA_FOCUS : SNAP_DETAILS_FOCUS
        currentTop.current = next
        setSheetTop(next)
    }, [])

    const handlePointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
        startY.current = event.clientY
        startTop.current = sheetTop
        currentTop.current = sheetTop
        hasDragged.current = false
        ignoreNextClick.current = false
        setIsDragging(true)
        event.currentTarget.setPointerCapture?.(event.pointerId)
    }, [sheetTop])

    const handlePointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
        if (!isDragging) return

        const deltaY = event.clientY - startY.current
        if (Math.abs(deltaY) > 6) hasDragged.current = true
        const deltaPercent = (deltaY / Math.max(window.innerHeight, 1)) * 100
        const next = Math.max(SNAP_DETAILS_FOCUS, Math.min(SNAP_MEDIA_FOCUS, startTop.current + deltaPercent))

        currentTop.current = next
        setSheetTop(next)
    }, [isDragging])

    const handlePointerEnd = useCallback((event: PointerEvent<HTMLButtonElement>) => {
        if (!isDragging) return

        setIsDragging(false)
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        if (hasDragged.current) {
            ignoreNextClick.current = true
            snapToNearest()
        }
    }, [isDragging, snapToNearest])

    const handleHandleClick = useCallback(() => {
        if (ignoreNextClick.current) {
            ignoreNextClick.current = false
            return
        }

        toggleSheet()
    }, [toggleSheet])

    const handleHandleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return

        event.preventDefault()
        const next = event.key === 'ArrowUp' ? SNAP_DETAILS_FOCUS : SNAP_MEDIA_FOCUS
        currentTop.current = next
        setSheetTop(next)
    }, [])

    return (
        <section
            className="pmds-wrap"
            aria-label="Experiência mobile do imóvel"
            style={{ '--pmds-sheet-top': `${sheetTop}dvh` } as CSSProperties}
        >
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
                <button
                    type="button"
                    className="pmds-handle"
                    aria-label="Arrastar ficha do imóvel"
                    aria-expanded={isExpanded}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onPointerCancel={handlePointerEnd}
                    onClick={handleHandleClick}
                    onKeyDown={handleHandleKeyDown}
                >
                    <span className="pmds-handle-track" aria-hidden="true" />
                </button>
                <div className="pmds-scroll">
                    {children}
                </div>
            </div>
        </section>
    )
}
