export function userFromName(value) {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\p{Surrogate}/gu, '\uFFFD').normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!name) return null;
  return { id: name.toLowerCase().normalize('NFC'), name };
}
