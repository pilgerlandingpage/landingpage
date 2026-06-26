type GeoProperty = {
    id?: string | number | null
    latitude?: number | string | null
    longitude?: number | string | null
}

function toCoordinate(value: number | string | null | undefined) {
    if (typeof value === 'string') return Number(value.replace(',', '.'))
    return Number(value)
}

function isInsideServiceArea(lat: number, lng: number) {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -30.5 &&
        lat <= -25.0 &&
        lng >= -54.5 &&
        lng <= -47.0
    )
}

function isValidWorldLatLng(lat: number, lng: number) {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    )
}

export function getRecommendationLatLng(property: GeoProperty | null | undefined): [number, number] | null {
    if (!property) return null

    const lat = toCoordinate(property.latitude)
    const lng = toCoordinate(property.longitude)

    if (isInsideServiceArea(lat, lng)) return [lat, lng]
    if (isInsideServiceArea(lng, lat)) return [lng, lat]
    if (isValidWorldLatLng(lat, lng)) return [lat, lng]
    if (isValidWorldLatLng(lng, lat)) return [lng, lat]
    return null
}

function distanceInMeters(from: [number, number], to: [number, number]) {
    const earthRadius = 6371000
    const toRadians = (value: number) => value * Math.PI / 180
    const fromLat = toRadians(from[0])
    const toLat = toRadians(to[0])
    const deltaLat = toRadians(to[0] - from[0])
    const deltaLng = toRadians(to[1] - from[1])
    const a = Math.sin(deltaLat / 2) ** 2
        + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2

    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function orderPropertiesBySmoothGeoPath<T extends GeoProperty>(
    properties: T[],
    anchorProperty?: GeoProperty | null
) {
    if (properties.length <= 2) return properties

    const anchorId = anchorProperty?.id != null ? String(anchorProperty.id) : null
    const anchorLatLng = getRecommendationLatLng(anchorProperty)
    const mapped = properties.map((property, index) => ({
        index,
        latLng: getRecommendationLatLng(property),
        property,
    }))
    const withCoords = mapped.filter((item): item is typeof item & { latLng: [number, number] } => Boolean(item.latLng))
    const withoutCoords = mapped.filter(item => !item.latLng)

    if (withCoords.length <= 2) return properties

    const remaining = [...withCoords]
    const ordered: T[] = []

    let currentIndex = anchorId
        ? remaining.findIndex(item => String(item.property.id) === anchorId)
        : -1

    if (currentIndex < 0 && anchorLatLng) {
        currentIndex = remaining.reduce((bestIndex, item, index) => {
            const best = remaining[bestIndex]
            const distance = distanceInMeters(anchorLatLng, item.latLng)
            const bestDistance = distanceInMeters(anchorLatLng, best.latLng)
            if (distance < bestDistance) return index
            if (distance === bestDistance && item.index < best.index) return index
            return bestIndex
        }, 0)
    }

    if (currentIndex < 0) currentIndex = 0

    let current = remaining.splice(currentIndex, 1)[0]
    ordered.push(current.property)

    while (remaining.length) {
        const nextIndex = remaining.reduce((bestIndex, item, index) => {
            const best = remaining[bestIndex]
            const distance = distanceInMeters(current.latLng, item.latLng)
            const bestDistance = distanceInMeters(current.latLng, best.latLng)
            if (distance < bestDistance) return index
            if (distance === bestDistance && item.index < best.index) return index
            return bestIndex
        }, 0)

        current = remaining.splice(nextIndex, 1)[0]
        ordered.push(current.property)
    }

    return [...ordered, ...withoutCoords.map(item => item.property)]
}
