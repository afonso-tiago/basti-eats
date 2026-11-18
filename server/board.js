export const timeZone = process.env.BOARD_TIME_ZONE || 'Europe/Berlin';
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function boardDay(date = new Date()) {
  const parts = Object.fromEntries(dateFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
