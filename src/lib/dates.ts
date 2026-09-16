const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const year = (d: Date) => d.getUTCFullYear();
export const monthYear = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const longDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** "AUG 2025", "JUN–AUG 2025", "2023–2025" or the dateText override. */
export function dateRange(date: Date, endDate?: Date, dateText?: string): string {
  if (dateText) return dateText;
  if (!endDate) return monthYear(date);
  if (year(date) === year(endDate)) {
    if (date.getUTCMonth() === endDate.getUTCMonth()) return monthYear(date);
    return `${MONTHS[date.getUTCMonth()]}–${MONTHS[endDate.getUTCMonth()]} ${year(date)}`;
  }
  return `${monthYear(date)} – ${monthYear(endDate)}`;
}
export const readingTime = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 230));
