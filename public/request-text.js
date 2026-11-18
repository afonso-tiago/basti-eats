export function requestTextKey(text) {
  return text.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
}
