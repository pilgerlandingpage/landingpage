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
  if (normalizeLocationName(text) === 'praia brava') return 'Itajai'
  return text
}

export function replaceItajaiWithPraiaBrava(value: unknown) {
  return String(value || '')
    .replace(/Itaja(?:í|i|Ã­|ÃƒÂ­)/g, 'Praia Brava')
    .replace(/ITAJA(?:Í|I|Ã�|ÃƒÂ�)/g, 'PRAIA BRAVA')
    .replace(/itaj(?:aí|ai|aã­|aãƒâ­)/g, 'praia brava')
}
