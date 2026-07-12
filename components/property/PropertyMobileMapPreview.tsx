'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Layers, MapPin, Navigation, X } from 'lucide-react'
import PropertyLocationMap, { type PropertyLocationMapProperty } from '@/components/property/PropertyLocationMap'

type MobileLocationMode = 'map' | 'street'

type Props = {
    property: PropertyLocationMapProperty
    latLng: [number, number]
}

const locationPreviewItems: Array<{
    mode: MobileLocationMode
    label: string
    actionLabel: string
    buttonLabel: string
    icon: 'map' | 'street'
}> = [
    { mode: 'map', label: 'Mapa', actionLabel: 'Abrir mapa em tela cheia', buttonLabel: 'Ver mapa', icon: 'map' },
    { mode: 'street', label: 'Street View', actionLabel: 'Abrir Street View em tela cheia', buttonLabel: 'Abrir', icon: 'street' },
]

function PreviewIcon({ icon }: { icon: 'map' | 'street' }) {
    if (icon === 'street') return <Navigation size={15} />
    return <Layers size={15} />
}

function StaticLocationPreview({ mode, latLng }: { mode: MobileLocationMode; latLng: [number, number] }) {
    const coordinate = `${latLng[0].toFixed(3)}, ${latLng[1].toFixed(3)}`

    return (
        <div className={`plp-mobile-location-preview-static plp-mobile-location-preview-static--${mode}`}>
            {mode === 'street' ? (
                <>
                    <span className="plp-mobile-location-preview-sky" />
                    <span className="plp-mobile-location-preview-horizon" />
                    <span className="plp-mobile-location-preview-road">
                        <span />
                        <span />
                    </span>
                </>
            ) : (
                <>
                    <span className="plp-mobile-location-preview-grid" />
                    <span className="plp-mobile-location-preview-route plp-mobile-location-preview-route--a" />
                    <span className="plp-mobile-location-preview-route plp-mobile-location-preview-route--b" />
                    <span className="plp-mobile-location-preview-block plp-mobile-location-preview-block--a" />
                    <span className="plp-mobile-location-preview-block plp-mobile-location-preview-block--b" />
                    <span className="plp-mobile-location-preview-block plp-mobile-location-preview-block--c" />
                </>
            )}
            <span className="plp-mobile-location-preview-pin" aria-hidden="true">
                <MapPin size={18} />
            </span>
            <span className="plp-mobile-location-preview-coordinate">{coordinate}</span>
        </div>
    )
}

export default function PropertyMobileMapPreview({ property, latLng }: Props) {
    const [activeMode, setActiveMode] = useState<MobileLocationMode | null>(null)

    const closeModal = useCallback(() => {
        setActiveMode(null)
    }, [])

    useEffect(() => {
        if (!activeMode) return

        document.body.classList.add('plp-mobile-map-modal-open')
        return () => {
            document.body.classList.remove('plp-mobile-map-modal-open')
        }
    }, [activeMode])

    const modal = activeMode ? (
        <div
            className={`plp-mobile-map-modal plp-mobile-map-modal--${activeMode}`}
            role="dialog"
            aria-modal="true"
            aria-label={activeMode === 'street' ? 'Street View' : 'Mapa'}
        >
            <button type="button" className="plp-mobile-map-modal-close" onClick={closeModal} aria-label="Fechar">
                <X size={22} />
            </button>
            <div className="plp-mobile-map-modal-body">
                <PropertyLocationMap
                    property={property}
                    latLng={latLng}
                    initialView={activeMode === 'street' ? 'street' : 'map'}
                    initialStreetInteractive={activeMode === 'street'}
                    allowedViews={activeMode === 'street' ? ['street'] : ['map']}
                    showViewControl={false}
                    showNearbyBenefits={activeMode === 'map'}
                />
            </div>
        </div>
    ) : null

    return (
        <>
            <section className="plp-mobile-media-item plp-mobile-location-strip" aria-label="Mapa e Street View do entorno">
                {locationPreviewItems.map((item) => (
                    <article
                        className={`plp-mobile-location-preview plp-mobile-location-preview--${item.mode}`}
                        key={item.mode}
                    >
                        <span className="plp-mobile-map-label">
                            <PreviewIcon icon={item.icon} />
                            {item.label}
                        </span>
                        <div className="plp-mobile-location-preview-media" aria-hidden="true">
                            <StaticLocationPreview mode={item.mode} latLng={latLng} />
                        </div>
                        <button
                            type="button"
                            className="plp-mobile-location-preview-hit"
                            onClick={() => setActiveMode(item.mode)}
                            aria-label={item.actionLabel}
                        >
                            <span>
                                <PreviewIcon icon={item.icon} />
                                {item.buttonLabel}
                            </span>
                        </button>
                    </article>
                ))}
            </section>

            {modal && createPortal(modal, document.body)}
        </>
    )
}
