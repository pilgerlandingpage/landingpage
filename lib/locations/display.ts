export function normalizeLocationName(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function displayLocationName(value: unknown) {
  const text = String(value || '')
  if (normalizeLocationName(text) === 'itajai') return 'Praia Brava'
  return text
}

export function searchLocationName(value: unknown) {
  const text = String(value || '')
  if (normalizeLocationName(text) === 'praia brava') return 'Itajaí'
  return text
}

export function replaceItajaiWithPraiaBrava(value: unknown) {
  return String(value || '')
    .replace(/Itajaí/g, 'Praia Brava')
    .replace(/Itajai/g, 'Praia Brava')
    .replace(/ItajaÃ­/g, 'Praia Brava')
    .replace(/itajai/g, 'praia brava')
}
