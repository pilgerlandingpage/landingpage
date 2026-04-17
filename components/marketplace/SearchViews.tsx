'use client'

import { useState, useRef, useCallback } from 'react'

interface SearchViewsProps {
    children: React.ReactNode
    map: React.ReactNode
}

const SNAP_FULL_MAP = 85
const SNAP_HALF = 50
const SNAP_FULL_LIST = 8

export default function SearchViews({ children, map }: SearchViewsProps) {
    const [sheetPosition, setSheetPosition] = useState(SNAP_HALF)
    const [isDragging, setIsDragging] = useState(false)
    const sheetRef = useRef<HTMLDivElement>(null)
    const startY = useRef(0)
    const startPosition = useRef(SNAP_HALF)
    const currentTranslate = useRef(SNAP_HALF)

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
                /* ===== WRAPPER ===== */
                .sv-wrap {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                    background: #f7f7f5;
                    /* Explicit height calculation — doesn't depend on parent flex chain */
                    height: calc(100vh - 57px);  /* fallback: 100vh minus mobile header */
                    height: calc(100dvh - 57px); /* preferred: dynamic viewport height */
                }

                /* ===== MAP ===== */
                .sv-map {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    z-index: 1;
                }

                /* ===== CONTENT PANEL (bottom sheet on mobile) ===== */
                .sv-panel {
                    position: absolute;
                    left: 0; right: 0; bottom: 0;
                    z-index: 10;
                    background: #fff;
                    border-top-left-radius: 20px;
                    border-top-right-radius: 20px;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .sv-handle {
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
                .sv-handle-bar {
                    width: 40px; height: 5px;
                    background: #d1d1d1;
                    border-radius: 100px;
                }
                .sv-scroll {
                    flex: 1;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    -webkit-overflow-scrolling: touch;
                    padding: 0 16px 80px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(0,0,0,0.1) transparent;
                }
                .sv-scroll::-webkit-scrollbar { width: 4px; }
                .sv-scroll::-webkit-scrollbar-track { background: transparent; }
                .sv-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 20px; }

                /* ===== DESKTOP (>=1024px) ===== */
                @media (min-width: 1024px) {
                    .sv-wrap {
                        flex-direction: row;
                        padding: 24px;
                        gap: 24px;
                        height: calc(100vh - 65px);
                        height: calc(100dvh - 65px);
                    }
                    /* Panel becomes left sidebar */
                    .sv-panel {
                        position: relative;
                        top: auto !important;
                        left: auto; right: auto; bottom: auto;
                        width: 52%;
                        min-width: 480px;
                        max-width: 780px;
                        flex-shrink: 0;
                        background: transparent;
                        border-radius: 0;
                        box-shadow: none;
                        overflow-y: auto;
                        transition: none !important;
                        scrollbar-width: thin;
                        scrollbar-color: rgba(0,0,0,0.15) transparent;
                    }
                    .sv-panel::-webkit-scrollbar { width: 6px; }
                    .sv-panel::-webkit-scrollbar-track { background: transparent; }
                    .sv-panel::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 20px; }
                    /* Hide drag handle */
                    .sv-handle { display: none; }
                    /* Adjust scroll padding */
                    .sv-scroll {
                        padding: 20px 16px 20px 0;
                        overflow-y: visible;
                    }
                    /* Map becomes right panel */
                    .sv-map {
                        position: relative;
                        top: auto; left: auto; right: auto; bottom: auto;
                        flex: 1;
                        min-width: 0;
                        border-radius: 20px;
                        border: 1px solid #e8e5e0;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.08);
                        overflow: hidden;
                    }
                }
                @media (min-width: 1280px) {
                    .sv-wrap { padding: 32px; gap: 32px; }
                    .sv-panel { max-width: 780px; }
                }

                /* Force leaflet containers */
                .sv-map .leaflet-container {
                    width: 100% !important;
                    height: 100% !important;
                }
            `}</style>

            <main className="sv-wrap">
                {/* Content panel: bottom sheet (mobile) / left sidebar (desktop) */}
                <div
                    ref={sheetRef}
                    className="sv-panel"
                    style={{
                        top: `${sheetPosition}%`,
                        transition: isDragging ? 'none' : 'top 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                >
                    <div
                        className="sv-handle"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div className="sv-handle-bar" />
                    </div>
                    <div className="sv-scroll">
                        {children}
                    </div>
                </div>

                {/* Map: fullscreen (mobile) / right panel (desktop) */}
                <div className="sv-map">
                    {map}
                </div>
            </main>
        </>
    )
}
