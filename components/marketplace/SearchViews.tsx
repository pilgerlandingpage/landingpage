'use client'

import { useState, useRef, useCallback, type CSSProperties } from 'react'

interface SearchViewsProps {
    children: React.ReactNode
    map: React.ReactNode
    overlay?: React.ReactNode
    previewOpen?: boolean
}

const SNAP_FULL_MAP = 85
const SNAP_HALF = 50
const SNAP_FULL_LIST = 8

export default function SearchViews({ children, map, overlay, previewOpen = false }: SearchViewsProps) {
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
                .sv-wrap {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                    background: #f3f0ea;
                    height: 100%;
                    min-height: 0;
                }

                .sv-map {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 1;
                    background: #111;
                }

                .sv-wrap:has(.map-options-open) .sv-map {
                    z-index: 50;
                }

                .sv-wrap:has(.map-options-open) .sv-panel {
                    pointer-events: none;
                }

                .sv-panel {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10;
                    background:
                        linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,247,243,0.98));
                    border: 1px solid rgba(201,169,110,0.16);
                    border-bottom: 0;
                    border-top-left-radius: 22px;
                    border-top-right-radius: 22px;
                    box-shadow:
                        0 -18px 44px rgba(18,18,18,0.18),
                        0 -1px 0 rgba(255,255,255,0.8) inset;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    backdrop-filter: blur(18px);
                }
                .sv-handle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 9px 0 7px;
                    cursor: grab;
                    touch-action: none;
                    flex-shrink: 0;
                    user-select: none;
                    -webkit-user-select: none;
                }
                .sv-handle:active {
                    cursor: grabbing;
                }
                .sv-handle-bar {
                    width: 42px;
                    height: 5px;
                    background: linear-gradient(90deg, #d7c29a, #b8945f);
                    border-radius: 100px;
                    box-shadow: 0 1px 8px rgba(184,148,95,0.2);
                }
                .sv-scroll {
                    flex: 1;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    -webkit-overflow-scrolling: touch;
                    padding: 0 16px 82px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(184,148,95,0.34) transparent;
                }
                .sv-scroll::-webkit-scrollbar { width: 4px; }
                .sv-scroll::-webkit-scrollbar-track { background: transparent; }
                .sv-scroll::-webkit-scrollbar-thumb {
                    background: rgba(184,148,95,0.34);
                    border-radius: 20px;
                }

                @media (min-width: 1024px) {
                    .sv-wrap {
                        flex-direction: row;
                        padding: 28px;
                        gap: 28px;
                        height: 100%;
                        min-height: 0;
                        background:
                            linear-gradient(180deg, #f7f5f0 0%, #eee9df 100%);
                    }
                    .sv-panel {
                        position: relative;
                        top: auto !important;
                        left: auto;
                        right: auto;
                        bottom: auto;
                        width: 43%;
                        min-width: 500px;
                        max-width: 735px;
                        flex-shrink: 0;
                        background: transparent;
                        border-radius: 0;
                        border: 0;
                        box-shadow: none;
                        backdrop-filter: none;
                        overflow: hidden;
                        transition: none !important;
                        scrollbar-width: thin;
                        scrollbar-color: rgba(0,0,0,0.15) transparent;
                    }
                    .sv-panel::-webkit-scrollbar { width: 6px; }
                    .sv-panel::-webkit-scrollbar-track { background: transparent; }
                    .sv-panel::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 20px; }
                    .sv-handle { display: none; }
                    .sv-scroll {
                        padding: 4px 16px 22px 4px;
                        overflow-y: auto;
                        overflow-x: hidden;
                    }
                    .sv-map {
                        position: relative;
                        top: auto;
                        left: auto;
                        right: auto;
                        bottom: auto;
                        flex: 1;
                        min-width: 0;
                        border-radius: 22px;
                        border: 1px solid rgba(35,31,26,0.08);
                        box-shadow:
                            0 18px 48px rgba(30,25,18,0.16),
                            0 0 0 1px rgba(255,255,255,0.78) inset;
                        overflow: hidden;
                    }
                }
                @media (min-width: 1280px) {
                    .sv-wrap {
                        padding: 32px;
                        gap: 32px;
                    }
                    .sv-panel { max-width: 720px; }
                }

                .sv-map .leaflet-container {
                    width: 100% !important;
                    height: 100% !important;
                }
                .sv-overlay {
                    position: absolute;
                    inset: 0;
                    z-index: 40;
                    pointer-events: none;
                }
                .sv-overlay > * {
                    pointer-events: auto;
                }
                @media (max-width: 1023px) {
                    .sv-wrap.is-preview-open .sv-panel {
                        background: transparent;
                        border-color: transparent;
                        box-shadow: none;
                        pointer-events: none;
                        backdrop-filter: none;
                        -webkit-backdrop-filter: none;
                    }
                    .sv-wrap.is-preview-open .sv-handle,
                    .sv-wrap.is-preview-open .sv-scroll {
                        opacity: 0;
                        pointer-events: none;
                        visibility: hidden;
                    }
                }
            `}</style>

            <main className={`sv-wrap${previewOpen ? ' is-preview-open' : ''}`} style={{ '--sv-sheet-top': `${sheetPosition}dvh` } as CSSProperties}>
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
                {overlay && (
                    <div className="sv-overlay">
                        {overlay}
                    </div>
                )}
            </main>
        </>
    )
}
