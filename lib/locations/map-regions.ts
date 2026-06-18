import { normalizeLocationName } from './display'

export type MapPolygon = [number, number][]

export type MapRegionArea = {
  id: string
  label: string
  aliases: string[]
  area: MapPolygon
}

export const MAP_REGION_AREAS: MapRegionArea[] = [
  {
    id: 'praia-brava',
    label: 'Praia Brava',
    aliases: ['praia brava', 'brava', 'praia dos amores', 'itajai', 'itajaí', 'fazenda itajai'],
    area: [
      [-26.9128, -48.6616],
      [-26.9138, -48.6228],
      [-26.9348, -48.6127],
      [-26.9634, -48.6196],
      [-26.9714, -48.6538],
      [-26.9478, -48.6714],
      [-26.9232, -48.6692],
    ],
  },
  {
    id: 'balneario-camboriu',
    label: 'Balneario Camboriu',
    aliases: [
      'balneario camboriu',
      'balneário camboriú',
      'bc',
      'barra sul',
      'barra norte',
      'centro balneario camboriu',
      'centro bc',
      'pioneiros',
      'nacoes',
      'nações',
      'estrada da rainha',
    ],
    area: [
      [-26.9474, -48.6815],
      [-26.9405, -48.6222],
      [-26.9666, -48.5883],
      [-27.0154, -48.5849],
      [-27.0386, -48.6241],
      [-27.0316, -48.6812],
      [-26.9898, -48.7006],
    ],
  },
  {
    id: 'itapema',
    label: 'Itapema',
    aliases: ['itapema', 'meia praia', 'canto da praia', 'morretes', 'casa branca itapema'],
    area: [
      [-27.0362, -48.6664],
      [-27.0278, -48.5862],
      [-27.0647, -48.5538],
      [-27.1264, -48.5654],
      [-27.1685, -48.6264],
      [-27.1483, -48.6927],
      [-27.0838, -48.7071],
    ],
  },
  {
    id: 'porto-belo',
    label: 'Porto Belo',
    aliases: ['porto belo', 'pereque', 'perequê', 'caixa daco', 'caixa d aco', 'enseada encantada'],
    area: [
      [-27.1038, -48.6385],
      [-27.0776, -48.5664],
      [-27.0965, -48.5039],
      [-27.1508, -48.4851],
      [-27.2007, -48.5336],
      [-27.1994, -48.6109],
      [-27.1546, -48.6597],
    ],
  },
  {
    id: 'camboriu',
    label: 'Camboriu',
    aliases: ['camboriu', 'camboriú', 'tabuleiro', 'santa regina'],
    area: [
      [-26.9487, -48.7851],
      [-26.9477, -48.6812],
      [-27.0121, -48.6657],
      [-27.0725, -48.7128],
      [-27.0718, -48.8293],
      [-27.0064, -48.8506],
    ],
  },
  {
    id: 'bombinhas',
    label: 'Bombinhas',
    aliases: ['bombinhas', 'mariscal', 'canto grande', 'quatro ilhas', 'zimbros', 'praia de bombinhas'],
    area: [
      [-27.1236, -48.5536],
      [-27.1176, -48.4706],
      [-27.1613, -48.3951],
      [-27.2298, -48.4373],
      [-27.2137, -48.5287],
      [-27.1702, -48.5849],
    ],
  },
  {
    id: 'navegantes',
    label: 'Navegantes',
    aliases: ['navegantes', 'gravata', 'gravatá', 'centro navegantes', 'meia praia navegantes'],
    area: [
      [-26.8066, -48.7208],
      [-26.7655, -48.6264],
      [-26.8047, -48.5769],
      [-26.8958, -48.5966],
      [-26.9197, -48.6819],
      [-26.8712, -48.7481],
    ],
  },
  {
    id: 'penha',
    label: 'Penha',
    aliases: ['penha', 'armacao', 'armação', 'praia alegre', 'praia grande penha'],
    area: [
      [-26.7044, -48.6916],
      [-26.6904, -48.5896],
      [-26.7479, -48.5394],
      [-26.8211, -48.5724],
      [-26.8228, -48.6666],
      [-26.7662, -48.7228],
    ],
  },
]

export function findMapRegionByText(value: unknown) {
  const normalized = normalizeLocationName(value)
  if (!normalized) return null

  return MAP_REGION_AREAS.find(region =>
    region.aliases.some(alias => normalized.includes(normalizeLocationName(alias)))
  ) || null
}

export function findMapRegionForSearchParams(params: Pick<URLSearchParams, 'get'>) {
  return findMapRegionByText(params.get('city'))
    || findMapRegionByText(params.get('q'))
    || null
}
