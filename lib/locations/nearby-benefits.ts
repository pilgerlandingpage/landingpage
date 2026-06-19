export type NearbyBenefitLayer = 'beach' | 'school' | 'bank' | 'dining' | 'coffee' | 'health' | 'shopping' | 'marina' | 'park'

export type NearbyBenefitConfig = {
    value: NearbyBenefitLayer
    label: string
    shortLabel: string
    searchLabel: string
    type?: string
    keyword?: string
    color: string
}

export const NEARBY_BENEFIT_LAYERS: NearbyBenefitConfig[] = [
    { value: 'beach', label: 'Praia', shortLabel: 'PR', searchLabel: 'Praias', keyword: 'praia beach orla', color: '#0f8ea8' },
    { value: 'school', label: 'Escolas', shortLabel: 'ES', searchLabel: 'Escolas', type: 'school', keyword: 'escola colegio', color: '#276ef1' },
    { value: 'bank', label: 'Bancos', shortLabel: 'BC', searchLabel: 'Bancos', type: 'bank', keyword: 'banco agencia bancaria', color: '#8a5a15' },
    { value: 'dining', label: 'Gastronomia', shortLabel: 'GT', searchLabel: 'Restaurantes', type: 'restaurant', keyword: 'restaurante gastronomia', color: '#b45309' },
    { value: 'coffee', label: 'Cafes', shortLabel: 'CF', searchLabel: 'Cafes', type: 'cafe', keyword: 'cafe cafeteria', color: '#6f4e37' },
    { value: 'health', label: 'Saude', shortLabel: '+', searchLabel: 'Saude', type: 'hospital', keyword: 'hospital clinica farmacia', color: '#0f766e' },
    { value: 'shopping', label: 'Shopping', shortLabel: 'SH', searchLabel: 'Shopping', type: 'shopping_mall', keyword: 'shopping mercado loja', color: '#7c3aed' },
    { value: 'marina', label: 'Marinas', shortLabel: 'MA', searchLabel: 'Marinas', keyword: 'marina iate clube nautica', color: '#0e7490' },
    { value: 'park', label: 'Parques', shortLabel: 'PQ', searchLabel: 'Parques', type: 'park', keyword: 'parque praca natureza', color: '#2f7d32' },
]

export function getNearbyBenefitConfig(layer: NearbyBenefitLayer) {
    return NEARBY_BENEFIT_LAYERS.find(option => option.value === layer)
}
