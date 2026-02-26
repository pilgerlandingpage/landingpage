'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { List, Map as MapIcon, GripHorizontal } from 'lucide-react'

interface SearchViewsProps {
    children: React.ReactNode
    map: React.ReactNode
}

// Bottom sheet snap points (percentage of screen height from top)
const SNAP_FULL_MAP = 85    // Sheet at bottom: 85% from top = only 15% visible (handle + peek)
const SNAP_HALF = 50        // Sheet at middle: 50/50 split
const SNAP_FULL_LIST = 8    // Sheet at top: only 8% from top = almost full list

export default function SearchViews({ children, map }: SearchViewsProps) {
    const [sheetPosition, setSheetPosition] = useState(SNAP_HALF) // Start at half
    const [isDragging, setIsDragging] = useState(false)
    const sheetRef = useRef<HTMLDivElement>(null)
    const startY = useRef(0)
    const startPosition = useRef(SNAP_HALF)
    const currentTranslate = useRef(SNAP_HALF)

    // Touch handlers for bottom sheet
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0]
        startY.current = touch.clientY
        startPosition.current = sheetPosition
        setIsDragging(true)
    }, [sheetPosition])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging) return
        const touch = e.touches[0]
        const deltaY = touch.clientY - startY.current
        const windowHeight = window.innerHeight
        const deltaPercent = (deltaY / windowHeight) * 100
        const newPosition = Math.max(SNAP_FULL_LIST, Math.min(SNAP_FULL_MAP, startPosition.current + deltaPercent))
        currentTranslate.current = newPosition
        setSheetPosition(newPosition)
    }, [isDragging])

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false)
        const pos = currentTranslate.current
        // Snap to nearest point
        const snapPoints = [SNAP_FULL_LIST, SNAP_HALF, SNAP_FULL_MAP]
        let closest = snapPoints[0]
        let minDist = Math.abs(pos - snapPoints[0])
        for (const sp of snapPoints) {
            const dist = Math.abs(pos - sp)
            if (dist < minDist) {
                minDist = dist
                closest = sp
            }
        }
        setSheetPosition(closest)
        currentTranslate.current = closest
    }, [])

    return (
        <>
            <style>{`
                /* ====== DESKTOP LAYOUT ====== */
                .sv-main {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                    width: 100%;
                    background: #f7f7f5;
                }
                .sv-list-desktop {
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(0,0,0,0.15) transparent;
                    display: none;
                }
                .sv-list-desktop::-webkit-scrollbar { width: 6px; }
                .sv-list-desktop::-webkit-scrollbar-track { background: transparent; }
                .sv-list-desktop::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 20px; }
                .sv-list-inner {
                    padding: 20px 20px;
                }
                .sv-map-desktop {
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                    transform: translate3d(0,0,0);
                    isolation: isolate;
                    z-index: 1;
                    display: none;
                }

                /* ====== MOBILE LAYOUT (bottom sheet) ====== */
                .sv-mobile-container {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                }
                .sv-mobile-map {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                }
                .sv-mobile-sheet {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10;
                    background: #fff;
                    border-top-left-radius: 20px;
                    border-top-right-radius: 20px;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .sv-sheet-handle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 10px 0 6px;
                    cursor: grab;
                    touch-action: none;
                    flex-shrink: 0;
                    user-select: none;
                    -webkit-user-select: none;
                }
                .sv-sheet-handle-bar {
                    width: 40px;
                    height: 5px;
                    background: #d1d1d1;
                    border-radius: 100px;
                }
                .sv-sheet-content {
                    flex: 1;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    -webkit-overflow-scrolling: touch;
                    padding: 0 16px 80px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(0,0,0,0.1) transparent;
                }
                .sv-sheet-content::-webkit-scrollbar { width: 4px; }
                .sv-sheet-content::-webkit-scrollbar-track { background: transparent; }
                .sv-sheet-content::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 20px; }

                /* ====== DESKTOP breakpoints ====== */
                @media (min-width: 1024px) {
                    .sv-mobile-container { display: none; }
                    .sv-main {
                        padding: 24px;
                        gap: 24px;
                    }
                    .sv-list-desktop {
                        display: block;
                        width: 52%;
                        min-width: 480px;
                        max-width: 780px;
                    }
                    .sv-list-inner {
                        padding: 20px 16px 20px 0;
                    }
                    .sv-map-desktop {
                        display: block;
                        border-radius: 20px;
                        border: 1px solid #e8e5e0;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.08);
                    }
                }
                @media (min-width: 1280px) {
                    .sv-main {
                        padding: 32px;
                        gap: 32px;
                    }
                    .sv-list-desktop {
                        max-width: 780px;
                    }
                }
                @media (min-width: 1024px) {
                    .sv-mobile-container { display: none !important; }
                }
                @media (max-width: 1023px) {
                    .sv-main > .sv-list-desktop,
                    .sv-main > .sv-map-desktop { display: none !important; }
                    .sv-mobile-container { display: flex !important; }
                }
            `}</style>

            <main className="sv-main">
                {/* ======= DESKTOP: side-by-side ======= */}
                <div className="sv-list-desktop">
                    <div className="sv-list-inner">
                        {children}
                    </div>
                </div>
                <div className="sv-map-desktop">
                    {map}
                </div>

                {/* ======= MOBILE: map + bottom sheet ======= */}
                <div className="sv-mobile-container">
                    {/* Map always behind */}
                    <div className="sv-mobile-map">
                        {map}
                    </div>

                    {/* Draggable bottom sheet */}
                    <div
                        ref={sheetRef}
                        className="sv-mobile-sheet"
                        style={{
                            top: `${sheetPosition}%`,
                            transition: isDragging ? 'none' : 'top 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                    >
                        {/* Handle */}
                        <div
                            className="sv-sheet-handle"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div className="sv-sheet-handle-bar" />
                        </div>

                        {/* Scrollable content */}
                        <div className="sv-sheet-content">
                            {children}
                        </div>
                    </div>
                </div>
            </main>
        </>
    )
}
