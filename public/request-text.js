export const maxRequestLength = 200;

export function requestTextKey(text) {
  return text.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
}
